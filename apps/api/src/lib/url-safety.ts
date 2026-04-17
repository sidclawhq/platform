/**
 * Shared URL safety / SSRF guard.
 *
 * Used by:
 *   - routes/webhooks.ts      (validate at endpoint-creation time + /test endpoint)
 *   - services/webhook-service.ts (re-validate at delivery time; redirect: manual)
 *   - services/policy-conditions.ts (webhook_check condition)
 *
 * Rules (fail-closed):
 *   1. Only http: / https: URLs. In production, https: only unless explicitly allowed.
 *   2. Reject literal private / loopback / metadata IPs (IPv4 and IPv6, including
 *      Teredo, 2001:db8::/32, IPv4-compatible, and expanded v4-mapped forms).
 *   3. Reject numeric-encoded IPv4 (decimal 2130706433, octal leading-zero, hex).
 *   4. Reject reserved TLDs: .internal, .local, .lan, .onion, .test, .example,
 *      .invalid, .home.arpa, .intranet, .corp, .home, .private.
 *   5. Resolve the hostname via DNS and reject if the resolved address is private —
 *      prevents DNS rebinding. The resolved IP is returned to the caller so it
 *      can be pinned on the subsequent fetch, closing the TOCTOU window.
 *   6. `safeFetch` uses a custom https.Agent whose `createConnection` dials the
 *      pre-resolved (pinned) IP while preserving SNI/Host headers. Redirects are
 *      treated as failures (a compliant endpoint would not 3xx us into a private
 *      network).
 *
 * The resolution step uses `dns.lookup` (not `dns.resolve`) so OS-level hosts/NSS
 * resolution is respected, matching what `fetch()` would see if we let it do its
 * own lookup.
 */

import { lookup } from 'node:dns/promises';
import { isIPv4, isIPv6 } from 'node:net';
import * as http from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';

export class UrlSafetyError extends Error {
  constructor(message: string, public readonly reason: string) {
    super(message);
    this.name = 'UrlSafetyError';
  }
}

export interface ValidateUrlOptions {
  /** Allow http:// and http://localhost in development. Default true for webhook creation, false for production delivery. */
  allowHttpInDev?: boolean;
  /** Skip DNS resolution — useful when caller has already pinned an IP. Default false. */
  skipDnsResolve?: boolean;
  /** Override NODE_ENV for testing. */
  env?: string;
}

export interface SafeUrlResult {
  /** Parsed URL. */
  url: URL;
  /** Resolved IP to pin the subsequent socket dial to (null when skipDnsResolve=true or hostname is a literal IP — see `literalIp`). */
  pinnedIp: string | null;
  /** IP family (4 or 6) for the pinned IP. */
  pinnedFamily: 4 | 6 | null;
  /** True if hostname was already a literal IP (so "pinning" is tautological). */
  literalIp: boolean;
}

/**
 * Validate a URL against the SSRF guard. Returns the parsed URL plus the
 * resolved IP (if DNS was performed) so callers can pin the subsequent fetch
 * to the same address — closing the TOCTOU window between lookup and dial.
 */
export async function assertUrlIsSafe(
  raw: string,
  options?: ValidateUrlOptions,
): Promise<URL>;
export async function assertUrlIsSafe(
  raw: string,
  options: ValidateUrlOptions,
  returnDetails: true,
): Promise<SafeUrlResult>;
export async function assertUrlIsSafe(
  raw: string,
  options: ValidateUrlOptions = {},
  returnDetails = false,
): Promise<URL | SafeUrlResult> {
  const env = options.env ?? process.env.NODE_ENV ?? 'development';
  const isDev = env !== 'production';
  const allowHttpDev = options.allowHttpInDev ?? true;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new UrlSafetyError('Invalid URL', 'invalid_url');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new UrlSafetyError(
      `URL protocol must be http or https, got ${parsed.protocol}`,
      'bad_protocol',
    );
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
  const lowerHostname = hostname.toLowerCase();
  const isLocalhostFamily =
    lowerHostname === 'localhost' ||
    lowerHostname.endsWith('.localhost') ||
    lowerHostname === 'ip6-localhost';

  // http:// allowed only for localhost in dev with allowHttpInDev — every
  // other http:// is rejected. Prevents MITM on real traffic while keeping
  // the dev loop usable.
  if (parsed.protocol === 'http:' && !(isDev && allowHttpDev && isLocalhostFamily)) {
    throw new UrlSafetyError(
      'URL must use https:// (http:// is only allowed for localhost in development)',
      'http_forbidden',
    );
  }

  // 1. Block numeric-encoded IPv4 (decimal, octal, hex). "Octal" here means
  //    a plain integer literal like 2130706433 — the dotted-octal case
  //    (0177.0.0.1) is handled below inside isIPv4Private where any octet
  //    with a leading zero + length > 1 is treated as private (fail-closed).
  if (/^\d+$/.test(hostname)) {
    throw new UrlSafetyError(
      'URL hostname is a decimal-encoded IP; use dotted-quad notation',
      'numeric_encoded_ip',
    );
  }
  if (/^0x[0-9a-f]+$/i.test(hostname)) {
    throw new UrlSafetyError('URL hostname is a hex-encoded IP', 'hex_encoded_ip');
  }

  // 1b. Dotted-quad IPv4 with any leading-zero octet: ambiguous parse
  //     (some resolvers read 0177 as octal = 127). Fail closed.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    const octetsRaw = hostname.split('.');
    for (const o of octetsRaw) {
      if (o.length > 1 && o.startsWith('0')) {
        throw new UrlSafetyError(
          `URL hostname contains an octal-looking octet (${o}); some resolvers parse this as an octal IP`,
          'private_literal_ip',
        );
      }
    }
  }

  // 2. If hostname is already a literal IP, block-list immediately
  if (isIPv4(hostname) || isIPv6(hostname)) {
    if (isAddressPrivate(hostname)) {
      throw new UrlSafetyError(
        `URL points at a private / loopback / metadata address: ${hostname}`,
        'private_literal_ip',
      );
    }
    return returnDetails
      ? {
          url: parsed,
          pinnedIp: hostname,
          pinnedFamily: isIPv4(hostname) ? 4 : 6,
          literalIp: true,
        }
      : parsed;
  }

  // 3. Localhost handling — by now, if http + localhost got here, we're in
  // dev + allowHttpInDev. Short-circuit (DNS would fail the private check).
  if (isLocalhostFamily) {
    if (!(isDev && allowHttpDev)) {
      throw new UrlSafetyError('URL hostname is localhost', 'localhost_host');
    }
    return returnDetails
      ? { url: parsed, pinnedIp: null, pinnedFamily: null, literalIp: false }
      : parsed;
  }
  if (isReservedTld(lowerHostname)) {
    throw new UrlSafetyError(`URL hostname uses a reserved TLD: ${lowerHostname}`, 'reserved_tld');
  }

  // 4. DNS rebinding guard — resolve and check every returned address.
  //    Capture the first usable address as the pinned IP for the caller.
  let pinnedIp: string | null = null;
  let pinnedFamily: 4 | 6 | null = null;
  if (!options.skipDnsResolve) {
    let resolved: Array<{ address: string; family: number }>;
    try {
      resolved = await lookup(hostname, { all: true, verbatim: true });
    } catch (e) {
      throw new UrlSafetyError(
        `URL hostname failed to resolve: ${(e as Error).message}`,
        'dns_lookup_failed',
      );
    }
    for (const entry of resolved) {
      if (isAddressPrivate(entry.address)) {
        throw new UrlSafetyError(
          `URL hostname ${hostname} resolves to private address ${entry.address}`,
          'dns_resolves_private',
        );
      }
    }
    const first = resolved[0];
    if (first) {
      pinnedIp = first.address;
      pinnedFamily = first.family === 6 ? 6 : 4;
    }
  }

  return returnDetails
    ? { url: parsed, pinnedIp, pinnedFamily, literalIp: false }
    : parsed;
}

/**
 * Is the given hostname a reserved / internal TLD?
 * Exposed for unit tests.
 */
export function isReservedTld(lowerHostname: string): boolean {
  // RFC 6761 / RFC 8375 / common internal conventions.
  // .localhost is handled separately (isLocalhostFamily) so it's not included here.
  const reservedSuffixes = [
    '.internal',
    '.local',
    '.lan',
    '.onion', // Tor
    '.test', // RFC 6761
    '.example', // RFC 6761
    '.invalid', // RFC 6761
    '.home.arpa', // RFC 8375 — must come before `.arpa` would-be catch-all
    '.intranet',
    '.corp',
    '.home',
    '.private',
  ];
  // Exact matches (host == "example", "corp" etc. with no dots) and suffix matches.
  const exactMatches = new Set([
    'internal',
    'local',
    'lan',
    'onion',
    'test',
    'example',
    'invalid',
    'intranet',
    'corp',
    'home',
    'private',
  ]);
  if (exactMatches.has(lowerHostname)) return true;
  return reservedSuffixes.some((s) => lowerHostname.endsWith(s));
}


/**
 * Is the given literal IP (v4 or v6) in a private / loopback / metadata range?
 * Exposed for unit tests.
 */
export function isAddressPrivate(addr: string): boolean {
  if (isIPv4(addr)) return isIPv4Private(addr);
  if (isIPv6(addr)) return isIPv6Private(addr);
  return false;
}

function isIPv4Private(addr: string): boolean {
  const octetsRaw = addr.split('.');
  // Any octet with a leading zero + length > 1 is ambiguous (octal) — fail closed.
  for (const o of octetsRaw) {
    if (o.length > 1 && o.startsWith('0')) return true;
  }
  const octets = octetsRaw.map((n) => parseInt(n, 10));
  if (octets.length !== 4 || octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // malformed — fail closed
  }
  const a = octets[0] ?? 0;
  const b = octets[1] ?? 0;
  // 0.0.0.0/8 — current network
  if (a === 0) return true;
  // 127.0.0.0/8 — loopback
  if (a === 127) return true;
  // 10.0.0.0/8 — private
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 — link-local + AWS/Azure/GCP metadata
  if (a === 169 && b === 254) return true;
  // 100.64.0.0/10 — CGNAT
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 192.0.0.0/24, 192.0.2.0/24, 198.18.0.0/15, 198.51.100.0/24, 203.0.113.0/24 — TEST-NET / benchmarking
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51) return true;
  if (a === 203 && b === 0) return true;
  // 224.0.0.0/4 — multicast
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 — reserved
  if (a >= 240) return true;
  // 255.255.255.255 — broadcast (caught by a>=240 above, keep comment for clarity)
  return false;
}

function isIPv6Private(addr: string): boolean {
  // Normalize: lowercase, strip per-group leading zeros so 0000:ffff:... matches 0:ffff:...
  // We only strip leading zeros in hex groups (not in a dotted-quad trailer).
  const lower = addr.toLowerCase();
  const normalized = lower.replace(
    /(^|:)0+([0-9a-f])/g,
    (_match, sep: string, digit: string) => `${sep}${digit}`,
  );

  // Loopback ::1
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;

  // Unspecified ::
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

  // IPv4-mapped: ::ffff:x.x.x.x (dotted-quad trailer)
  const v4MappedMatch = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (v4MappedMatch && v4MappedMatch[1]) {
    return isIPv4Private(v4MappedMatch[1]);
  }
  // IPv4-compatible (deprecated but still routable): ::x.x.x.x
  const v4CompatMatch = /^::(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (v4CompatMatch && v4CompatMatch[1]) {
    return isIPv4Private(v4CompatMatch[1]);
  }
  // Expanded v4-mapped: 0:0:0:0:0:ffff:x.x.x.x
  const v4MappedExpanded = /^(?:0:){5}ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (v4MappedExpanded && v4MappedExpanded[1]) {
    return isIPv4Private(v4MappedExpanded[1]);
  }
  // Expanded v4-compatible: 0:0:0:0:0:0:x.x.x.x
  const v4CompatExpanded = /^(?:0:){6}(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (v4CompatExpanded && v4CompatExpanded[1]) {
    return isIPv4Private(v4CompatExpanded[1]);
  }

  // Hex-form IPv4-embedded (mapped or compatible). Parse the trailing two
  // 16-bit groups as a 32-bit IPv4. Covers:
  //   ::ffff:7f00:1        (v4-mapped hex)
  //   ::7f00:1             (v4-compatible hex — deprecated but still routed)
  //   0:0:0:0:0:ffff:7f00:1 (expanded hex)
  //   0:0:0:0:0:0:7f00:1    (expanded v4-compatible hex)
  const v4EmbeddedHex = tryParseHexEmbeddedV4(normalized);
  if (v4EmbeddedHex && isIPv4Private(v4EmbeddedHex)) return true;

  // Unique local fc00::/7 (fc00:: - fdff::)
  if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return true;

  // Link-local fe80::/10
  if (/^fe[89ab][0-9a-f]:/.test(normalized)) return true;

  // Multicast ff00::/8
  if (/^ff[0-9a-f]{2}:/.test(normalized)) return true;

  // Site-local (deprecated) fec0::/10 — still worth blocking
  if (/^fe[cdef][0-9a-f]:/.test(normalized)) return true;

  // 2001::/32 — Teredo tunneling. The first 32 bits are 2001:0000, which in
  // compact form appears as `2001:0:...` (the second group collapses any
  // leading-zero 16-bit value). Block the whole /32.
  if (/^2001:0*(:|$)/.test(normalized)) return true;

  // 2001:db8::/32 — documentation / example range (RFC 3849)
  if (/^2001:0*db8:/.test(normalized) || normalized === '2001:db8::') return true;

  // 2002::/16 — 6to4 — embedded v4 check
  if (/^2002:/.test(normalized)) {
    const groups = normalized.split(':');
    if (groups.length >= 3 && groups[1] && groups[2]) {
      const high = parseInt(groups[1], 16);
      const low = parseInt(groups[2], 16);
      if (!Number.isNaN(high) && !Number.isNaN(low)) {
        const v4 = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
        if (isIPv4Private(v4)) return true;
      }
    }
  }

  return false;
}

/**
 * Attempt to parse the trailing two hex 16-bit groups of a v4-mapped or
 * v4-compatible IPv6 address into a dotted-quad IPv4 string. Returns null if
 * the address doesn't match either of those shapes.
 */
function tryParseHexEmbeddedV4(normalized: string): string | null {
  // Shapes:
  //   ::ffff:HHHH:HHHH            v4-mapped hex
  //   ::HHHH:HHHH                 v4-compatible hex (6 leading zero groups)
  //   0:0:0:0:0:ffff:HHHH:HHHH    expanded v4-mapped hex
  //   0:0:0:0:0:0:HHHH:HHHH       expanded v4-compatible hex
  const patterns = [
    /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/,
    /^::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/, // v4-compatible hex — but must not match plain ::HH where HH is a normal addr. Acceptable: ::1 (loopback) is handled above, so here we treat any ::AAAA:BBBB as potentially-embedded.
    /^(?:0:){5}ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/,
    /^(?:0:){6}([0-9a-f]{1,4}):([0-9a-f]{1,4})$/,
  ];
  for (const re of patterns) {
    const m = re.exec(normalized);
    if (m && m[1] && m[2]) {
      const high = parseInt(m[1], 16);
      const low = parseInt(m[2], 16);
      if (!Number.isNaN(high) && !Number.isNaN(low)) {
        return `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
      }
    }
  }
  return null;
}


/**
 * Build an http.Agent / https.Agent that dials a pre-resolved (pinned) IP
 * instead of re-resolving the hostname at socket time. Host/TLS SNI use the
 * original hostname so virtual hosts + TLS cert validation still work.
 *
 * This closes the TOCTOU window between assertUrlIsSafe's dns.lookup and the
 * actual socket dial — without it, an attacker's authoritative DNS can return
 * a public IP for the check and a private IP for the real fetch (TTL=0).
 */
function buildPinnedAgent(protocol: string, pinnedIp: string, pinnedFamily: 4 | 6): http.Agent | https.Agent {
  const AgentCtor = protocol === 'https:' ? https.Agent : http.Agent;
  class PinnedAgent extends (AgentCtor as unknown as typeof https.Agent) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createConnection(options: any, callback?: (err: Error | null, socket: net.Socket) => void): net.Socket {
      const hostHeader = typeof options.host === 'string' ? options.host : '';
      // Preserve SNI / Host for TLS. The IP is what we actually dial.
      const mergedOptions = {
        ...options,
        host: pinnedIp,
        // hostname is used by https.Agent to derive servername — preserve original for SNI
        servername: options.servername ?? hostHeader,
        family: pinnedFamily,
        lookup: (_hostname: string, _opts: unknown, cb: (err: Error | null, addr: string, family: number) => void) => {
          cb(null, pinnedIp, pinnedFamily);
        },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (super.createConnection as any)(mergedOptions, callback);
    }
  }
  return new PinnedAgent({ keepAlive: false });
}


export interface SafeFetchOptions extends RequestInit {
  /** Timeout in ms. Defaults to 10_000. An AbortSignal in init takes precedence. */
  timeoutMs?: number;
  /** Pass-through to assertUrlIsSafe (allowHttpInDev, env). */
  validateOptions?: ValidateUrlOptions;
}

/**
 * Fetch helper that:
 *   1. Runs assertUrlIsSafe (with IP pinning) to reject private targets.
 *   2. Pins the socket dial to the resolved IP so DNS rebinding is impossible
 *      between lookup and dial.
 *   3. Uses `redirect: 'manual'` and throws UrlSafetyError on 3xx responses.
 *
 * Callers MUST use this instead of raw fetch() for any user-supplied URL.
 */
export async function safeFetch(url: string, init: SafeFetchOptions = {}): Promise<Response> {
  const { timeoutMs, validateOptions, ...rest } = init;
  const details = await assertUrlIsSafe(url, validateOptions ?? {}, true);

  // If DNS was skipped (hostname was a literal IP or localhost-in-dev), we dial
  // normally. For literal IPs, "pinning" is tautological — URL.hostname is the IP.
  const port =
    details.url.port !== ''
      ? Number(details.url.port)
      : details.url.protocol === 'https:' ? 443 : 80;

  let response: Response;
  const controller = new AbortController();
  const userSignal = rest.signal;
  const onUserAbort = () => controller.abort();
  if (userSignal) {
    if (userSignal.aborted) controller.abort();
    else userSignal.addEventListener('abort', onUserAbort, { once: true });
  }
  const timeout = setTimeout(() => controller.abort(), timeoutMs ?? 10_000);

  let agent: http.Agent | https.Agent | undefined;
  try {
    if (details.pinnedIp && details.pinnedFamily && !details.literalIp) {
      agent = buildPinnedAgent(details.url.protocol, details.pinnedIp, details.pinnedFamily);
    }

    // Node's global fetch (undici) does not accept a classic http.Agent via
    // `agent` or `dispatcher` without undici being importable. When we have a
    // pinned IP from DNS, use the low-level http/https module which DOES honor
    // our custom Agent and closes the TOCTOU gap. For literal-IP targets we
    // fall back to the global fetch (no DNS = no TOCTOU).
    if (agent) {
      response = await doPinnedFetch(details.url, rest, agent, port, controller.signal);
    } else {
      response = await fetch(url, { ...rest, signal: controller.signal, redirect: 'manual' });
    }
  } finally {
    clearTimeout(timeout);
    if (userSignal) userSignal.removeEventListener('abort', onUserAbort);
    // Agents with keepAlive: false close sockets on their own; nothing to do.
  }

  if (response.status >= 300 && response.status < 400) {
    throw new UrlSafetyError(
      `URL returned a redirect (${response.status}); redirects are not followed for SSRF safety`,
      'redirect_blocked',
    );
  }
  return response;
}

/**
 * Perform an HTTP(S) request using the pinned Agent and adapt it to a
 * fetch-like Response. We implement the minimal surface our callers use:
 *   - method, headers, body (string | Buffer)
 *   - signal (AbortSignal)
 *   - response.ok / status / headers / text() / json()
 *
 * We deliberately do not follow redirects — safeFetch treats 3xx as failure.
 */
function doPinnedFetch(
  parsedUrl: URL,
  init: RequestInit,
  agent: http.Agent | https.Agent,
  port: number,
  signal: AbortSignal,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const method = (init.method ?? 'GET').toUpperCase();
    const headers: Record<string, string> = {};
    if (init.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => { headers[k] = v; });
      } else if (Array.isArray(init.headers)) {
        for (const pair of init.headers) {
          if (pair[0] != null && pair[1] != null) headers[pair[0]] = pair[1];
        }
      } else {
        Object.assign(headers, init.headers as Record<string, string>);
      }
    }
    // Ensure Host header matches original hostname so virtual hosting works.
    // http.request does this by default when `host` option is the hostname —
    // and our Agent already dials the pinned IP, so it's correct by default.

    const body = init.body;
    let bodyBuffer: Buffer | null = null;
    if (typeof body === 'string') bodyBuffer = Buffer.from(body);
    else if (body instanceof Uint8Array) bodyBuffer = Buffer.from(body);
    else if (body != null) {
      reject(new Error('safeFetch: unsupported body type (use string or Uint8Array)'));
      return;
    }

    if (bodyBuffer && !Object.keys(headers).some((h) => h.toLowerCase() === 'content-length')) {
      headers['Content-Length'] = String(bodyBuffer.length);
    }

    const requester = parsedUrl.protocol === 'https:' ? https.request : http.request;
    const req = requester(
      {
        method,
        host: parsedUrl.hostname,
        port,
        path: parsedUrl.pathname + parsedUrl.search,
        headers,
        agent,
        // Disable automatic redirect follow at the node-level (http.request
        // doesn't follow anyway — this is explicit).
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const responseHeaders = new Headers();
          for (const [k, v] of Object.entries(res.headers)) {
            if (v == null) continue;
            if (Array.isArray(v)) for (const vv of v) responseHeaders.append(k, vv);
            else responseHeaders.set(k, String(v));
          }
          const status = res.statusCode ?? 0;
          // Build a minimal Response-like object (spec-compatible enough for callers).
          const response = new Response(buffer, {
            status,
            statusText: res.statusMessage ?? '',
            headers: responseHeaders,
          });
          resolve(response);
        });
        res.on('error', reject);
      },
    );

    req.on('error', reject);

    const onAbort = () => {
      req.destroy(new Error('aborted'));
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });

    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}
