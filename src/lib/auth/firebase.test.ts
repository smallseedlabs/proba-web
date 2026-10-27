import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseAuthClient, toAuthError, type IdentityProvider, type IdentityUser } from './firebase';
import { HubSessionApi } from './hub';
import { AuthError, type Session } from './types';

const CONFIG = { apiKey: 'k', authDomain: 'proba.firebaseapp.com', projectId: 'proba', appId: 'app' };
const SESSION: Session = { token: 'hub-token', user: { id: 'u', email: 'ana@acme.com', name: 'Ana' }, workspaces: [] };

function firebaseError(code: string) {
  return Object.assign(new Error(code), { code });
}

function user(tokens: string[] = ['id-1', 'id-2']): IdentityUser & { getIdToken: ReturnType<typeof vi.fn> } {
  let i = 0;
  return { getIdToken: vi.fn(async () => tokens[Math.min(i++, tokens.length - 1)]) };
}

function setup(identity: Partial<IdentityProvider> = {}, exchange = vi.fn().mockResolvedValue(SESSION)) {
  const signedIn = user();
  const provider: IdentityProvider = {
    signInWithPassword: vi.fn().mockResolvedValue(signedIn),
    signInWithGoogle: vi.fn().mockResolvedValue(signedIn),
    sendPasswordReset: vi.fn().mockResolvedValue(undefined),
    currentUser: vi.fn().mockResolvedValue(signedIn),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...identity,
  };
  const hub = new HubSessionApi({ apiBaseUrl: 'http://hub.test' });
  vi.spyOn(hub, 'exchange').mockImplementation(exchange);
  const logout = vi.spyOn(hub, 'logout').mockResolvedValue(undefined);
  const loadIdentity = vi.fn().mockResolvedValue(provider);
  const client = new FirebaseAuthClient({ firebase: CONFIG, hub, loadIdentity });
  return { client, provider, exchange, logout, loadIdentity, signedIn };
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('FirebaseAuthClient', () => {
  it('signs in with email/password and exchanges the ID token for a Hub session', async () => {
    const { client, provider, exchange, loadIdentity } = setup();
    await expect(client.signIn({ email: 'ana@acme.com', password: 'pw' })).resolves.toBe(SESSION);
    expect(loadIdentity).toHaveBeenCalledWith(CONFIG);
    expect(provider.signInWithPassword).toHaveBeenCalledWith('ana@acme.com', 'pw');
    expect(exchange).toHaveBeenCalledWith('id-1');
  });

  it('continues with Google', async () => {
    const { client, provider, exchange } = setup();
    await expect(client.signInWithGoogle()).resolves.toBe(SESSION);
    expect(provider.signInWithGoogle).toHaveBeenCalled();
    expect(exchange).toHaveBeenCalledWith('id-1');
  });

  it.each([
    ['auth/invalid-credential', 'invalid_credentials'],
    ['auth/wrong-password', 'invalid_credentials'],
    ['auth/too-many-requests', 'rate_limited'],
    ['auth/user-disabled', 'account_disabled'],
    ['auth/network-request-failed', 'network'],
    ['auth/popup-closed-by-user', 'cancelled'],
    ['auth/popup-blocked', 'popup_blocked'],
    ['auth/unauthorized-domain', 'unavailable'],
    ['auth/something-new', 'unknown'],
  ])('maps Firebase %s to %s', async (code, expected) => {
    const { client, exchange } = setup({ signInWithPassword: vi.fn().mockRejectedValue(firebaseError(code)) });
    await expect(client.signIn({ email: 'a@b.co', password: 'x' })).rejects.toMatchObject({ code: expected });
    expect(exchange).not.toHaveBeenCalled();
  });

  it('signs out of Firebase when the Hub refuses the session', async () => {
    const { client, provider } = setup({}, vi.fn().mockRejectedValue(new AuthError('not_allowed')));
    await expect(client.signInWithGoogle()).rejects.toMatchObject({ code: 'not_allowed' });
    expect(provider.signOut).toHaveBeenCalled();
  });

  it('forces one ID token refresh when the Hub finds the token expired, then gives up', async () => {
    const exchange = vi
      .fn()
      .mockRejectedValueOnce(new AuthError('session_expired'))
      .mockResolvedValueOnce(SESSION);
    const { client, signedIn } = setup({}, exchange);
    await expect(client.signIn({ email: 'a@b.co', password: 'x' })).resolves.toBe(SESSION);
    expect(signedIn.getIdToken).toHaveBeenNthCalledWith(1);
    expect(signedIn.getIdToken).toHaveBeenNthCalledWith(2, true);
    expect(exchange).toHaveBeenNthCalledWith(2, 'id-2');

    const always = vi.fn().mockRejectedValue(new AuthError('session_expired'));
    const second = setup({}, always);
    await expect(second.client.signIn({ email: 'a@b.co', password: 'x' })).rejects.toMatchObject({
      code: 'session_expired',
    });
    expect(always).toHaveBeenCalledTimes(2);
  });

  describe('refresh', () => {
    it('gets a fresh ID token from the current Firebase user and a new Hub session', async () => {
      const { client, exchange, provider } = setup();
      await expect(client.refresh()).resolves.toBe(SESSION);
      expect(provider.currentUser).toHaveBeenCalled();
      expect(exchange).toHaveBeenCalledWith('id-1');
    });

    it('requires signing in again when there is no Firebase user', async () => {
      const { client, exchange } = setup({ currentUser: vi.fn().mockResolvedValue(null) });
      await expect(client.refresh()).rejects.toMatchObject({ code: 'session_expired' });
      expect(exchange).not.toHaveBeenCalled();
    });

    it('requires signing in again (and signs out of Firebase) when the token cannot be refreshed', async () => {
      const broken = { getIdToken: vi.fn().mockRejectedValue(firebaseError('auth/user-token-expired')) };
      const { client, provider } = setup({ currentUser: vi.fn().mockResolvedValue(broken) });
      await expect(client.refresh()).rejects.toMatchObject({ code: 'session_expired' });
      expect(broken.getIdToken).toHaveBeenCalledTimes(1);
      expect(provider.signOut).toHaveBeenCalled();
    });

    it('keeps the Firebase user on network errors', async () => {
      const { client, provider } = setup({}, vi.fn().mockRejectedValue(new AuthError('network')));
      await expect(client.refresh()).rejects.toMatchObject({ code: 'network' });
      expect(provider.signOut).not.toHaveBeenCalled();
    });
  });

  it('hands out the Firebase ID token for services that verify it themselves, refreshing on request', async () => {
    const { client, signedIn } = setup();
    await expect(client.getIdToken()).resolves.toBe('id-1');
    expect(signedIn.getIdToken).toHaveBeenLastCalledWith(false);
    await expect(client.getIdToken(true)).resolves.toBe('id-2');
    expect(signedIn.getIdToken).toHaveBeenLastCalledWith(true);
  });

  it('has no ID token when nobody is signed in', async () => {
    const { client } = setup({ currentUser: vi.fn().mockResolvedValue(null) });
    await expect(client.getIdToken()).rejects.toMatchObject({ code: 'session_expired' });
  });

  it('restores a Firebase user after a reload, or returns null', async () => {
    await expect(setup().client.restore()).resolves.toBe(SESSION);
    await expect(setup({ currentUser: vi.fn().mockResolvedValue(null) }).client.restore()).resolves.toBeNull();
    await expect(
      setup({}, vi.fn().mockRejectedValue(new AuthError('not_allowed'))).client.restore()
    ).resolves.toBeNull();
  });

  it('sends password reset emails without revealing unknown accounts', async () => {
    const { client, provider } = setup();
    await client.sendPasswordReset('ana@acme.com');
    expect(provider.sendPasswordReset).toHaveBeenCalledWith('ana@acme.com');

    const unknown = setup({ sendPasswordReset: vi.fn().mockRejectedValue(firebaseError('auth/user-not-found')) });
    await expect(unknown.client.sendPasswordReset('x@acme.com')).resolves.toBeUndefined();

    const limited = setup({ sendPasswordReset: vi.fn().mockRejectedValue(firebaseError('auth/too-many-requests')) });
    await expect(limited.client.sendPasswordReset('x@acme.com')).rejects.toMatchObject({ code: 'rate_limited' });
  });

  it('signs out of the Hub and Firebase', async () => {
    const { client, provider, logout } = setup();
    await client.signOut(SESSION);
    expect(logout).toHaveBeenCalledWith(SESSION);
    expect(provider.signOut).toHaveBeenCalled();
  });

  it('is unavailable (without loading Firebase) when the web config is missing', async () => {
    const hub = new HubSessionApi({ apiBaseUrl: 'http://hub.test' });
    const loadIdentity = vi.fn();
    const client = new FirebaseAuthClient({ firebase: null, hub, loadIdentity });
    await expect(client.signIn({ email: 'a@b.co', password: 'x' })).rejects.toMatchObject({ code: 'unavailable' });
    await expect(client.signInWithGoogle()).rejects.toMatchObject({ code: 'unavailable' });
    await expect(client.restore()).resolves.toBeNull();
    await expect(client.refresh()).rejects.toMatchObject({ code: 'session_expired' });
    expect(loadIdentity).not.toHaveBeenCalled();
  });

  it('toAuthError passes AuthErrors through', () => {
    const error = new AuthError('network');
    expect(toAuthError(error)).toBe(error);
    expect(toAuthError('weird').code).toBe('unknown');
  });
});
