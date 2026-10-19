export interface Workspace {
  id: string;
  name: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role?: string;
}

export interface Session {
  token: string;
  user: SessionUser;
  workspaces: Workspace[];
  expiresAt?: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'rate_limited'
  | 'unavailable'
  | 'network'
  | 'unknown';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string = AUTH_ERROR_MESSAGES[code]
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  invalid_credentials: 'The email or password you entered is incorrect.',
  rate_limited: 'Too many sign-in attempts. Please wait a minute and try again.',
  unavailable: 'Sign-in is temporarily unavailable. Please try again shortly or contact your administrator.',
  network: "We couldn't reach Proba. Check your connection and try again.",
  unknown: 'Something went wrong while signing you in. Please try again.',
};

/**
 * Authentication against proba-hub. The UI depends only on this interface so
 * the transport behind it (Hub REST, SSO, a local development stub) can change
 * without touching any screen.
 */
export interface AuthClient {
  signIn(credentials: Credentials): Promise<Session>;
  signOut(session: Session): Promise<void>;
}
