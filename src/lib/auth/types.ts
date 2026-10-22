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

/** A Hub session: the revocable token proba-hub issues after sign-in. */
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
  | 'invalid_email'
  | 'rate_limited'
  | 'account_disabled'
  | 'account_exists'
  | 'not_allowed'
  | 'email_not_verified'
  | 'popup_blocked'
  | 'cancelled'
  | 'session_expired'
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
  invalid_email: 'Enter a valid email address, for example name@company.com.',
  rate_limited: 'Too many sign-in attempts. Please wait a few minutes and try again.',
  account_disabled: 'This account has been disabled. Contact your workspace administrator.',
  account_exists:
    'An account already exists for this email address. Sign in with your email and password instead.',
  not_allowed: "This account doesn't have access to Proba. Contact your workspace administrator.",
  email_not_verified: 'Verify your email address, then sign in again.',
  popup_blocked: 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.',
  cancelled: 'Sign-in was cancelled.',
  session_expired: 'Your session has expired. Please sign in again.',
  unavailable: 'Sign-in is temporarily unavailable. Please try again shortly or contact your administrator.',
  network: "We couldn't reach Proba. Check your connection and try again.",
  unknown: 'Something went wrong while signing you in. Please try again.',
};

/**
 * Authentication for proba-web. The UI depends only on this interface so the
 * identity provider behind it can change without touching any screen.
 */
export interface AuthClient {
  /** Email and password sign-in. */
  signIn(credentials: Credentials): Promise<Session>;
  /** "Continue with Google". Rejects with AuthError('cancelled') if the user closes the window. */
  signInWithGoogle(): Promise<Session>;
  /** Email a password reset link. Resolves whether or not the account exists. */
  sendPasswordReset(email: string): Promise<void>;
  /**
   * Obtain a new Hub session from the current identity (after the Hub rejected
   * the old one). Rejects with AuthError('session_expired') when the user must
   * sign in again.
   */
  refresh(): Promise<Session>;
  /** Resume a signed-in identity after a reload, or null if there is none. */
  restore(): Promise<Session | null>;
  /** Revoke the Hub session (when given) and sign out of the identity provider. */
  signOut(session: Session | null): Promise<void>;
}
