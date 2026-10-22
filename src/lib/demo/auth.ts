import { AuthError, type AuthClient, type Credentials, type Session } from '../auth/types';

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  const name = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
  return name || 'Workspace member';
}

/**
 * Local development auth client used with demo data. Any well-formed email and a
 * password of at least 8 characters signs in; anything shorter is rejected so
 * the error state can be exercised without a Hub.
 */
export class DemoAuthClient implements AuthClient {
  constructor(private readonly latencyMs = 600) {}

  async signIn({ email, password }: Credentials): Promise<Session> {
    await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    if (password.length < 8) {
      throw new AuthError('invalid_credentials');
    }
    return this.session(email);
  }

  async signInWithGoogle(): Promise<Session> {
    await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    return this.session('alex.morgan@northwindoutdoor.com');
  }

  async sendPasswordReset(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
  }

  async refresh(): Promise<Session> {
    throw new AuthError('session_expired');
  }

  async restore(): Promise<Session | null> {
    return null;
  }

  private session(email: string): Session {
    return {
      token: 'local-session',
      user: { id: 'u-local', email, name: nameFromEmail(email), role: 'Workspace admin' },
      workspaces: [
        { id: 'northwind', name: 'Northwind Outdoor' },
        { id: 'harbor', name: 'Harbor & Pine' },
      ],
    };
  }

  async signOut(): Promise<void> {
    // Nothing to revoke locally.
  }
}
