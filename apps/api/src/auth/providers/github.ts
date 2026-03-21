export interface GitHubUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
}

export class GitHubProvider {
  constructor(
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string
  ) {}

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'read:user user:email',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  async exchangeCode(code: string): Promise<string> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub token exchange failed: ${response.status}`);
    }

    const data = (await response.json()) as { access_token?: string; error?: string };
    if (data.error || !data.access_token) {
      throw new Error(`GitHub token exchange error: ${data.error ?? 'no access_token'}`);
    }

    return data.access_token;
  }

  async getUser(accessToken: string): Promise<GitHubUser> {
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!userResponse.ok) {
      throw new Error(`GitHub user API failed: ${userResponse.status}`);
    }

    const userData = (await userResponse.json()) as {
      id: number;
      name: string | null;
      login: string;
      email: string | null;
      avatar_url: string;
    };

    let email = userData.email;

    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (emailsResponse.ok) {
        const emails = (await emailsResponse.json()) as Array<{
          email: string;
          primary: boolean;
          verified: boolean;
        }>;
        const primary = emails.find(e => e.primary && e.verified);
        email = primary?.email ?? emails[0]?.email ?? null;
      }
    }

    if (!email) {
      throw new Error('Could not retrieve email from GitHub');
    }

    return {
      id: String(userData.id),
      name: userData.name ?? userData.login,
      email,
      avatar_url: userData.avatar_url,
    };
  }
}
