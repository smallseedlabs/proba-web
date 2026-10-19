import { AuthError, type AuthClient, type Credentials, type Session, type Workspace } from './types';

interface HubLoginResponse {
  token?: string;
  user?: { id?: string; email?: string; name?: string; role?: string };
  workspaces?: Workspace[];
  expiresAt?: string;
}

export interface HubAuthClientOptions {
  apiBaseUrl: string;
  /** Sign-in endpoint, POST { email, password } -> { token, user, workspaces? }. */
  loginPath?: string;
  /** Sign-out endpoint, POST with the bearer token. Best effort. */
  logoutPath?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Auth client for proba-hub.
 *
 * NOTE: proba-hub does not yet expose a password sign-in endpoint (it only has
 * a development-only email login). This client targets the contract the UI
 * needs: POST /v1/auth/login and POST /v1/auth/logout. The path is
 * configurable through AUTH_LOGIN_PATH until the Hub ships the endpoint.
 */
export class HubAuthClient implements AuthClient {
  private readonly loginPath: string;
  private readonly logoutPath: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HubAuthClientOptions) {
    this.loginPath = options.loginPath ?? '/v1/auth/login';
    this.logoutPath = options.logoutPath ?? '/v1/auth/logout';
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
  }

  async signIn({ email, password }: Credentials): Promise<Session> {
    let response: Response;
    try {
      response = await this.fetchImpl(new URL(this.loginPath, this.options.apiBaseUrl).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new AuthError('network');
    }

    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new AuthError('invalid_credentials');
    }
    if (response.status === 429) throw new AuthError('rate_limited');
    if (response.status === 404 || response.status === 501 || response.status >= 500) {
      throw new AuthError('unavailable');
    }
    if (!response.ok) throw new AuthError('unknown');

    let body: HubLoginResponse;
    try {
      body = (await response.json()) as HubLoginResponse;
    } catch {
      throw new AuthError('unknown');
    }

    if (!body.token || !body.user?.id || !body.user.email) {
      throw new AuthError('unknown');
    }

    const name = body.user.name || body.user.email.split('@')[0];
    return {
      token: body.token,
      user: { id: body.user.id, email: body.user.email, name, role: body.user.role },
      // Workspaces are not modelled by the Hub yet; fall back to a single one.
      workspaces:
        body.workspaces && body.workspaces.length > 0
          ? body.workspaces
          : [{ id: 'default', name: 'My workspace' }],
      expiresAt: body.expiresAt,
    };
  }

  async signOut(session: Session): Promise<void> {
    try {
      await this.fetchImpl(new URL(this.logoutPath, this.options.apiBaseUrl).toString(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
        credentials: 'include',
      });
    } catch {
      // Sign-out is best effort: the local session is always cleared.
    }
  }
}
