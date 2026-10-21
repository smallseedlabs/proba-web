import { describe, it, expect, vi } from 'vitest';
import { HubSessionApi } from './hub';
import { AuthError } from './types';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('HubSessionApi', () => {
  it('exchanges a Firebase ID token for a Hub session', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        token: 'hub-token',
        user: { id: 'u1', email: 'ana@acme.com', name: 'Ana Ruiz' },
        expiresAt: '2030-01-01T00:00:00Z',
      })
    );
    const hub = new HubSessionApi({ apiBaseUrl: 'https://hub.example.com', fetchImpl });

    const session = await hub.exchange('firebase-id-token');

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://hub.example.com/v1/auth/session',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ idToken: 'firebase-id-token' }) })
    );
    expect(session).toEqual({
      token: 'hub-token',
      user: { id: 'u1', email: 'ana@acme.com', name: 'Ana Ruiz', role: undefined },
      workspaces: [{ id: 'default', name: 'My workspace' }],
      expiresAt: '2030-01-01T00:00:00Z',
    });
  });

  it.each([
    [401, { error: 'token_expired' }, 'session_expired'],
    [401, { error: 'invalid_token' }, 'session_expired'],
    [403, { error: 'not_allowed' }, 'not_allowed'],
    [403, { error: 'email_not_verified' }, 'email_not_verified'],
    [409, { error: 'account_conflict' }, 'account_exists'],
    [429, { error: 'rate_limited' }, 'rate_limited'],
    [503, { error: 'auth_not_configured' }, 'unavailable'],
    [404, {}, 'unavailable'],
    [500, {}, 'unavailable'],
    [400, { error: 'invalid_request' }, 'unknown'],
  ])('maps HTTP %i %j to %s', async (status, body, code) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(status, body));
    const hub = new HubSessionApi({ apiBaseUrl: 'http://localhost:3000', fetchImpl });
    await expect(hub.exchange('t')).rejects.toMatchObject({ code });
  });

  it('reports network failures', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const hub = new HubSessionApi({ apiBaseUrl: 'http://localhost:3000', fetchImpl });
    const error = await hub.exchange('t').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthError);
    expect((error as AuthError).code).toBe('network');
  });

  it('rejects malformed success responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { user: { id: 'u1' } }));
    const hub = new HubSessionApi({ apiBaseUrl: 'http://localhost:3000', fetchImpl });
    await expect(hub.exchange('t')).rejects.toMatchObject({ code: 'unknown' });
  });

  it('logs out with the Hub bearer token and never throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('offline'));
    const hub = new HubSessionApi({ apiBaseUrl: 'http://localhost:3000', fetchImpl });
    await expect(
      hub.logout({ token: 't', user: { id: 'u', email: 'a@b.co', name: 'A' }, workspaces: [] })
    ).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3000/v1/auth/logout',
      expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer t' } })
    );
  });
});
