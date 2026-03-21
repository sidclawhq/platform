import * as oidcClient from 'openid-client';

let googleConfig: oidcClient.Configuration | null = null;

export class GoogleProvider {
  constructor(
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string
  ) {}

  private async getConfig(): Promise<oidcClient.Configuration> {
    if (googleConfig) return googleConfig;

    googleConfig = await oidcClient.discovery(
      new URL('https://accounts.google.com'),
      this.clientId,
      this.clientSecret,
    );

    return googleConfig;
  }

  async getAuthorizationUrl(state: string, codeVerifier: string): Promise<string> {
    const config = await this.getConfig();

    const codeChallenge = await oidcClient.calculatePKCECodeChallenge(codeVerifier);

    const url = oidcClient.buildAuthorizationUrl(config, {
      redirect_uri: this.redirectUri,
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return url.href;
  }

  async exchangeCode(
    code: string,
    state: string,
    codeVerifier: string,
    requestUrl: URL
  ): Promise<{ email: string; name: string; sub: string }> {
    const config = await this.getConfig();

    const tokens = await oidcClient.authorizationCodeGrant(config, requestUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState: state,
    });

    const claims = tokens.claims();
    if (!claims) {
      throw new Error('Google OIDC: no claims in token');
    }

    const email = claims.email as string | undefined;
    const name = (claims.name as string | undefined) ?? email ?? 'Unknown';

    if (!email) {
      throw new Error('Google OIDC: no email in claims');
    }

    return { email, name, sub: claims.sub as string };
  }
}
