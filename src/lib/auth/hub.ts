import { AuthError, type Session, type Workspace } from './types';

interface HubSessionResponse {
  token?: string;
  user?: { id?: string; email?: string; name?: string; role?: string };
  workspaces?: Workspace[];
  expiresAt?: string;
}

export interface HubSessionApiOptions {
  apiBaseUrl: string;
  fetchImpl?: typeof fetch;
}

/** Hub error codes from POST /v1/auth/session that have a dedicated message. */
const HUB_ERRORS: Record<string, AuthError['code']> = {
  token_expired: 'session_expired',
  invalid_token: 'session_expired',
  not_allowed: 'not_allowed',
  email_not_verified: 'email_not_verified',
  email_required: 'not_allowed',
  account_conflict: 'account_exists',
  rate_limited: 'rate_limited',
};

/**
 * proba-hub session API: POST /v1/auth/session { idToken } exchanges a
 * Firebase ID token for a revocable Hub session { token, user, workspaces,
 * expiresAt }; POST /v1/auth/logout revokes it.
 */
export class HubSessionApi {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HubSessionApiOptions) {
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
  }

  private url(path: string): string {
    return new URL(path, this.options.apiBaseUrl).toString();
  }

  async exchange(idToken: string): Promise<Session> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.url('/v1/auth/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ idToken }),
      });
    } catch {
      throw new AuthError('network');
    }

    if (!response.ok) {
      let error: string | undefined;
      try {
        error = ((await response.json()) as { error?: string }).error;
      } catch {
        // Non-JSON error body.
      }
      const mapped = error ? HUB_ERRORS[error] : undefined;
      if (mapped) throw new AuthError(mapped);
      if (response.status === 429) throw new AuthError('rate_limited');
      if (response.status === 401) throw new AuthError('session_expired');
      if (response.status === 403) throw new AuthError('not_allowed');
      if (response.status === 404 || response.status >= 500) throw new AuthError('unavailable');
      throw new AuthError('unknown');
    }

    let body: HubSessionResponse;
    try {
      body = (await response.json()) as HubSessionResponse;
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
      // The Hub returns a single default workspace today; keep a fallback.
      workspaces:
        body.workspaces && body.workspaces.length > 0 ? body.workspaces : [{ id: 'default', name: 'My workspace' }],
      expiresAt: body.expiresAt,
    };
  }

  /** Revoke the Hub session. Best effort: never throws. */
  async logout(session: Session): Promise<void> {
    try {
      await this.fetchImpl(this.url('/v1/auth/logout'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      });
    } catch {
      // The local session is always cleared.
    }
  }
}
