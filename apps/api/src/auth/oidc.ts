import * as client from 'openid-client';

let oidcConfig: client.Configuration | null = null;

export async function getOIDCConfig(): Promise<client.Configuration> {
  if (oidcConfig) return oidcConfig;

  const issuerUrl = new URL(process.env['OIDC_ISSUER']!);
  oidcConfig = await client.discovery(
    issuerUrl,
    process.env['OIDC_CLIENT_ID']!,
    process.env['OIDC_CLIENT_SECRET']!,
  );

  return oidcConfig;
}

export async function generateAuthParams(): Promise<{
  state: string;
  codeVerifier: string;
  codeChallenge: string;
}> {
  const state = client.randomState();
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  return { state, codeVerifier, codeChallenge };
}
