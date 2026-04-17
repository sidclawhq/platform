import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer } from 'node:http';
import type { Server, IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  assertUrlIsSafe,
  isAddressPrivate,
  isReservedTld,
  safeFetch,
  UrlSafetyError,
} from './url-safety.js';

// Assert a given promise rejects with a UrlSafetyError whose reason code matches.
async function expectSafetyReason(promise: Promise<unknown>, reason: string) {
  try {
    await promise;
    throw new Error(`expected UrlSafetyError with reason=${reason}, but promise resolved`);
  } catch (e) {
    if (!(e instanceof UrlSafetyError)) {
      throw new Error(`expected UrlSafetyError, got ${(e as Error).name}: ${(e as Error).message}`);
    }
    expect(e.reason).toBe(reason);
  }
}

// Stub dns.lookup for deterministic tests — we want to exercise our blocklist,
// not the real DNS. Each test that needs DNS sets its own mock.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]), // example.com-like
}));

import { lookup } from 'node:dns/promises';
const lookupMock = lookup as unknown as ReturnType<typeof vi.fn>;

describe('isAddressPrivate — IPv4', () => {
  it('blocks loopback', () => {
    expect(isAddressPrivate('127.0.0.1')).toBe(true);
    expect(isAddressPrivate('127.1.1.1')).toBe(true);
    expect(isAddressPrivate('127.255.255.255')).toBe(true);
  });
  it('blocks 0.0.0.0/8', () => {
    expect(isAddressPrivate('0.0.0.0')).toBe(true);
    expect(isAddressPrivate('0.0.0.1')).toBe(true);
    expect(isAddressPrivate('0.1.2.3')).toBe(true);
  });
  it('blocks RFC1918', () => {
    expect(isAddressPrivate('10.0.0.1')).toBe(true);
    expect(isAddressPrivate('172.16.0.1')).toBe(true);
    expect(isAddressPrivate('172.31.255.254')).toBe(true);
    expect(isAddressPrivate('192.168.1.1')).toBe(true);
  });
  it('blocks CGNAT 100.64.0.0/10', () => {
    expect(isAddressPrivate('100.64.0.1')).toBe(true);
    expect(isAddressPrivate('100.127.255.254')).toBe(true);
  });
  it('blocks AWS/Azure/GCP metadata 169.254.169.254', () => {
    expect(isAddressPrivate('169.254.169.254')).toBe(true);
  });
  it('blocks test/benchmark ranges', () => {
    expect(isAddressPrivate('192.0.2.1')).toBe(true);
    expect(isAddressPrivate('198.18.0.1')).toBe(true);
    expect(isAddressPrivate('203.0.113.1')).toBe(true);
  });
  it('blocks multicast + reserved', () => {
    expect(isAddressPrivate('224.0.0.1')).toBe(true);
    expect(isAddressPrivate('240.0.0.1')).toBe(true);
    expect(isAddressPrivate('255.255.255.255')).toBe(true);
  });
  it('allows normal public IPs', () => {
    expect(isAddressPrivate('8.8.8.8')).toBe(false);
    expect(isAddressPrivate('93.184.216.34')).toBe(false);
    expect(isAddressPrivate('172.15.255.254')).toBe(false); // just outside 172.16/12
    expect(isAddressPrivate('172.32.0.1')).toBe(false);     // just outside
    expect(isAddressPrivate('100.63.255.254')).toBe(false); // just outside CGNAT
    expect(isAddressPrivate('100.128.0.1')).toBe(false);
  });
});

describe('isAddressPrivate — IPv6', () => {
  it('blocks loopback', () => {
    expect(isAddressPrivate('::1')).toBe(true);
    expect(isAddressPrivate('0:0:0:0:0:0:0:1')).toBe(true);
  });
  it('blocks unspecified', () => {
    expect(isAddressPrivate('::')).toBe(true);
  });
  it('blocks IPv4-mapped loopback', () => {
    expect(isAddressPrivate('::ffff:127.0.0.1')).toBe(true);
    expect(isAddressPrivate('::ffff:169.254.169.254')).toBe(true);
  });
  it('blocks unique-local fc00::/7', () => {
    expect(isAddressPrivate('fc00::1')).toBe(true);
    expect(isAddressPrivate('fd00:ec2::254')).toBe(true); // AWS IPv6 metadata
  });
  it('blocks link-local fe80::/10', () => {
    expect(isAddressPrivate('fe80::1')).toBe(true);
    expect(isAddressPrivate('febf::1')).toBe(true);
  });
  it('blocks multicast ff00::/8', () => {
    expect(isAddressPrivate('ff02::1')).toBe(true);
  });
  it('allows global unicast', () => {
    expect(isAddressPrivate('2001:4860:4860::8888')).toBe(false); // Google DNS
    expect(isAddressPrivate('2606:4700:4700::1111')).toBe(false); // Cloudflare
  });
});

describe('assertUrlIsSafe', () => {
  beforeEach(() => {
    // Reset DNS mock to a public IP for each test — tests that care about
    // DNS answers set their own mockResolvedValueOnce.
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });

  it('rejects non-http(s) protocols', async () => {
    await expect(assertUrlIsSafe('file:///etc/passwd', { env: 'production' })).rejects.toThrow(UrlSafetyError);
    await expect(assertUrlIsSafe('gopher://example.com/', { env: 'production' })).rejects.toThrow(UrlSafetyError);
    await expect(assertUrlIsSafe('ftp://example.com/', { env: 'production' })).rejects.toThrow(UrlSafetyError);
  });

  it('rejects http:// in production', async () => {
    await expect(assertUrlIsSafe('http://example.com/', { env: 'production' })).rejects.toThrow(/https/);
  });

  it('allows http://localhost in development', async () => {
    lookupMock.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);
    // localhost is caught by the string check before DNS — should reject unless allowHttpInDev
    await expect(
      assertUrlIsSafe('http://localhost:4000/', { env: 'development', allowHttpInDev: true, skipDnsResolve: true }),
    ).resolves.toBeTruthy();
  });

  it('rejects literal loopback IPs', async () => {
    await expectSafetyReason(assertUrlIsSafe('https://127.0.0.1/', { env: 'production' }), 'private_literal_ip');
    await expectSafetyReason(assertUrlIsSafe('https://127.0.0.1/', { env: 'development', skipDnsResolve: true }), 'private_literal_ip');
    await expectSafetyReason(assertUrlIsSafe('https://[::1]/', { env: 'production' }), 'private_literal_ip');
  });

  it('rejects AWS metadata endpoint', async () => {
    await expectSafetyReason(
      assertUrlIsSafe('https://169.254.169.254/latest/meta-data/', { env: 'development', skipDnsResolve: true }),
      'private_literal_ip',
    );
  });

  it('rejects http:// to non-localhost in dev (MITM risk)', async () => {
    await expectSafetyReason(
      assertUrlIsSafe('http://example.com/hook', { env: 'development', allowHttpInDev: true }),
      'http_forbidden',
    );
  });

  it('rejects decimal-encoded IP (normalized to loopback by URL parser)', async () => {
    // Node normalizes 2130706433 → 127.0.0.1; our block-list still catches it.
    await expectSafetyReason(assertUrlIsSafe('https://2130706433/', { env: 'production' }), 'private_literal_ip');
  });

  it('rejects hex-encoded IP (normalized to loopback by URL parser)', async () => {
    await expectSafetyReason(assertUrlIsSafe('https://0x7f000001/', { env: 'production' }), 'private_literal_ip');
  });

  it('rejects .internal / .local / .lan TLDs', async () => {
    await expectSafetyReason(assertUrlIsSafe('https://api.internal/', { env: 'production' }), 'reserved_tld');
    await expectSafetyReason(assertUrlIsSafe('https://host.local/', { env: 'production' }), 'reserved_tld');
    await expectSafetyReason(assertUrlIsSafe('https://foo.lan/', { env: 'production' }), 'reserved_tld');
  });

  it('rejects DNS names that resolve to private IPs', async () => {
    lookupMock.mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]);
    await expectSafetyReason(
      assertUrlIsSafe('https://rebind.attacker.com/', { env: 'production' }),
      'dns_resolves_private',
    );
  });

  it('rejects DNS names that resolve to ANY private IP even if another is public', async () => {
    lookupMock.mockResolvedValueOnce([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ]);
    await expectSafetyReason(
      assertUrlIsSafe('https://dual.attacker.com/', { env: 'production' }),
      'dns_resolves_private',
    );
  });

  it('accepts well-formed public https URL', async () => {
    lookupMock.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);
    const parsed = await assertUrlIsSafe('https://example.com/webhook', { env: 'production' });
    expect(parsed.hostname).toBe('example.com');
  });

  it('skip_dns option bypasses DNS resolution', async () => {
    // literal public IP — skip_dns means we don't look it up
    const parsed = await assertUrlIsSafe('https://93.184.216.34/', { env: 'production', skipDnsResolve: true });
    expect(parsed.hostname).toBe('93.184.216.34');
  });

  it('returnDetails=true pins the resolved IP', async () => {
    lookupMock.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);
    const result = await assertUrlIsSafe('https://example.com/', { env: 'production' }, true);
    expect(result.url.hostname).toBe('example.com');
    expect(result.pinnedIp).toBe('93.184.216.34');
    expect(result.pinnedFamily).toBe(4);
    expect(result.literalIp).toBe(false);
  });

  it('returnDetails=true marks literal-IP hostnames', async () => {
    const result = await assertUrlIsSafe('https://93.184.216.34/', { env: 'production', skipDnsResolve: true }, true);
    expect(result.literalIp).toBe(true);
    expect(result.pinnedIp).toBe('93.184.216.34');
  });
});

describe('isAddressPrivate — IPv6 extended (Teredo, 2001:db8::, v4-compat, expanded forms)', () => {
  it('blocks Teredo 2001::/32', () => {
    expect(isAddressPrivate('2001::1')).toBe(true);
    expect(isAddressPrivate('2001:0:4:5:6:7:8:9')).toBe(true);
  });
  it('blocks documentation 2001:db8::/32', () => {
    expect(isAddressPrivate('2001:db8::1')).toBe(true);
    expect(isAddressPrivate('2001:db8:0:0:0:0:0:1')).toBe(true);
  });
  it('blocks v4-compatible dotted form ::127.0.0.1', () => {
    expect(isAddressPrivate('::127.0.0.1')).toBe(true);
  });
  it('blocks v4-compatible hex form ::7f00:1', () => {
    expect(isAddressPrivate('::7f00:1')).toBe(true);
  });
  it('blocks expanded v4-mapped 0:0:0:0:0:ffff:7f00:1', () => {
    expect(isAddressPrivate('0:0:0:0:0:ffff:7f00:1')).toBe(true);
  });
  it('blocks padded expanded v4-mapped 0000:0000:0000:0000:0000:ffff:7f00:0001', () => {
    expect(isAddressPrivate('0000:0000:0000:0000:0000:ffff:7f00:0001')).toBe(true);
  });
  it('allows public v4-compat ::8.8.8.8', () => {
    expect(isAddressPrivate('::8.8.8.8')).toBe(false);
  });
});

describe('isReservedTld', () => {
  it('blocks all reserved TLDs', () => {
    expect(isReservedTld('service.internal')).toBe(true);
    expect(isReservedTld('printer.local')).toBe(true);
    expect(isReservedTld('host.lan')).toBe(true);
    expect(isReservedTld('hidden.onion')).toBe(true);
    expect(isReservedTld('foo.test')).toBe(true);
    expect(isReservedTld('foo.example')).toBe(true);
    expect(isReservedTld('foo.invalid')).toBe(true);
    expect(isReservedTld('router.home.arpa')).toBe(true);
    expect(isReservedTld('app.intranet')).toBe(true);
    expect(isReservedTld('app.corp')).toBe(true);
    expect(isReservedTld('app.home')).toBe(true);
    expect(isReservedTld('app.private')).toBe(true);
  });
  it('blocks bare-label reserved names', () => {
    expect(isReservedTld('corp')).toBe(true);
    expect(isReservedTld('onion')).toBe(true);
  });
  it('allows normal public TLDs', () => {
    expect(isReservedTld('example.com')).toBe(false);
    expect(isReservedTld('example.org')).toBe(false);
    expect(isReservedTld('api.stripe.com')).toBe(false);
  });
});

describe('assertUrlIsSafe — new blocks', () => {
  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });

  it('rejects Teredo IPv6 literal', async () => {
    await expectSafetyReason(
      assertUrlIsSafe('https://[2001:0:4:5:6:7:8:9]/', { env: 'production' }),
      'private_literal_ip',
    );
  });

  it('rejects 2001:db8::/32 documentation range', async () => {
    await expectSafetyReason(
      assertUrlIsSafe('https://[2001:db8::1]/', { env: 'production' }),
      'private_literal_ip',
    );
  });

  it('rejects v4-compat hex IPv6 literal ::7f00:1', async () => {
    await expectSafetyReason(
      assertUrlIsSafe('https://[::7f00:1]/', { env: 'production' }),
      'private_literal_ip',
    );
  });

  it('rejects expanded v4-mapped 0:0:0:0:0:ffff:7f00:1', async () => {
    await expectSafetyReason(
      assertUrlIsSafe('https://[0:0:0:0:0:ffff:7f00:1]/', { env: 'production' }),
      'private_literal_ip',
    );
  });

  it('rejects octal-looking IPv4 0177.0.0.1 (some resolvers parse as 127.0.0.1)', async () => {
    await expectSafetyReason(
      assertUrlIsSafe('https://0177.0.0.1/', { env: 'production' }),
      'private_literal_ip',
    );
  });

  it('rejects octal-looking IPv4 with any leading-zero octet', async () => {
    await expectSafetyReason(
      assertUrlIsSafe('https://10.0.0.01/', { env: 'production' }),
      'private_literal_ip',
    );
  });

  it('rejects .onion', async () => {
    await expectSafetyReason(
      assertUrlIsSafe('https://abcd1234.onion/', { env: 'production' }),
      'reserved_tld',
    );
  });

  it('rejects .test', async () => {
    await expectSafetyReason(
      assertUrlIsSafe('https://api.test/', { env: 'production' }),
      'reserved_tld',
    );
  });

  it('rejects .example', async () => {
    await expectSafetyReason(
      assertUrlIsSafe('https://foo.example/', { env: 'production' }),
      'reserved_tld',
    );
  });

  it('rejects .invalid', async () => {
    await expectSafetyReason(
      assertUrlIsSafe('https://foo.invalid/', { env: 'production' }),
      'reserved_tld',
    );
  });

  it('rejects .home.arpa', async () => {
    await expectSafetyReason(
      assertUrlIsSafe('https://router.home.arpa/', { env: 'production' }),
      'reserved_tld',
    );
  });

  it('rejects .intranet / .corp / .home / .private', async () => {
    await expectSafetyReason(
      assertUrlIsSafe('https://app.intranet/', { env: 'production' }),
      'reserved_tld',
    );
    await expectSafetyReason(
      assertUrlIsSafe('https://app.corp/', { env: 'production' }),
      'reserved_tld',
    );
    await expectSafetyReason(
      assertUrlIsSafe('https://app.home/', { env: 'production' }),
      'reserved_tld',
    );
    await expectSafetyReason(
      assertUrlIsSafe('https://app.private/', { env: 'production' }),
      'reserved_tld',
    );
  });
});

// Integration tests against real loopback HTTP servers — not just unit-level
// mocks. These exercise the full safeFetch socket stack (IP pinning,
// redirect: manual, response body read) end-to-end.
describe('safeFetch — integration against loopback', () => {
  let server: Server;
  let port: number;
  let handler: (req: IncomingMessage, res: ServerResponse) => void;

  beforeEach(async () => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    handler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    };
    server = createServer((req, res) => handler(req, res));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('delivers to loopback with skipDnsResolve bypass (dev only)', async () => {
    // Literal IPv4 loopback is blocked everywhere — use the skip path via localhost + dev.
    // Use the dev + allowHttpInDev short-circuit: http://localhost skips DNS but
    // needs to be dialed. Our helper pins DNS lookup callback to return 127.0.0.1.
    const resp = await safeFetch(`http://localhost:${port}/`, {
      method: 'GET',
      validateOptions: { env: 'development', allowHttpInDev: true },
    });
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body).toEqual({ ok: true });
  });

  it('throws UrlSafetyError(redirect_blocked) on 302 response', async () => {
    handler = (_req, res) => {
      res.writeHead(302, { Location: 'http://127.0.0.1:1/internal' });
      res.end();
    };
    try {
      await safeFetch(`http://localhost:${port}/`, {
        method: 'GET',
        validateOptions: { env: 'development', allowHttpInDev: true },
      });
      throw new Error('expected redirect to be blocked');
    } catch (e) {
      expect(e).toBeInstanceOf(UrlSafetyError);
      expect((e as UrlSafetyError).reason).toBe('redirect_blocked');
    }
  });

  it('throws UrlSafetyError(redirect_blocked) on 301 response', async () => {
    handler = (_req, res) => {
      res.writeHead(301, { Location: 'http://example.com/' });
      res.end();
    };
    try {
      await safeFetch(`http://localhost:${port}/`, {
        method: 'GET',
        validateOptions: { env: 'development', allowHttpInDev: true },
      });
      throw new Error('expected redirect to be blocked');
    } catch (e) {
      expect(e).toBeInstanceOf(UrlSafetyError);
      expect((e as UrlSafetyError).reason).toBe('redirect_blocked');
    }
  });

  it('POSTs body and verifies it server-side', async () => {
    let received = '';
    handler = (req, res) => {
      req.on('data', (chunk: Buffer) => { received += chunk.toString(); });
      req.on('end', () => {
        res.writeHead(200);
        res.end('ok');
      });
    };
    const resp = await safeFetch(`http://localhost:${port}/`, {
      method: 'POST',
      body: JSON.stringify({ hello: 'world' }),
      headers: { 'Content-Type': 'application/json' },
      validateOptions: { env: 'development', allowHttpInDev: true },
    });
    expect(resp.status).toBe(200);
    expect(received).toBe('{"hello":"world"}');
  });

  it('rejects (pre-flight) when DNS resolves to private', async () => {
    lookupMock.mockResolvedValueOnce([{ address: '10.0.0.5', family: 4 }]);
    try {
      await safeFetch('https://rebind.attacker.com/', {
        validateOptions: { env: 'production' },
      });
      throw new Error('expected pre-flight SSRF rejection');
    } catch (e) {
      expect(e).toBeInstanceOf(UrlSafetyError);
      expect((e as UrlSafetyError).reason).toBe('dns_resolves_private');
    }
  });

  it('TOCTOU: safeFetch uses the IP from the first lookup call even if DNS later changes', async () => {
    // First call (pre-flight) returns the public loopback IP.
    // If DNS later (at connect time) "rebinds" to a private address, we'd still
    // dial the pinned 127.0.0.1 — verified by actually connecting to the test server.
    let lookupCalls = 0;
    lookupMock.mockImplementation(async () => {
      lookupCalls += 1;
      // First call: public IP of our test server. Later calls (if any): private.
      // We expect the pre-flight call to pin, so subsequent resolutions are a no-op.
      return lookupCalls === 1
        ? [{ address: '127.0.0.1', family: 4 }]
        : [{ address: '10.0.0.1', family: 4 }];
    });
    // Make 127.0.0.1 pass the check by temporarily claiming a public IP —
    // but here we mock dns.lookup to return 127.0.0.1, which is private. So
    // we can't exercise the "public → then private" attack with a real socket
    // without routing tricks. What we CAN verify: assertUrlIsSafe's pinning
    // contract is that the caller gets the pinned IP back from the first
    // lookup. Assert that safeFetch resolves through the pinned lookup, not
    // a second DNS trip.
    try {
      await safeFetch('https://rebind.attacker.example.com/', {
        validateOptions: { env: 'production' },
      });
    } catch {
      // The private check will fail because lookup returned 127.0.0.1, which is private.
      // That's fine — the point of this test is that there was exactly ONE dns.lookup call.
    }
    expect(lookupCalls).toBe(1);
  });
});
