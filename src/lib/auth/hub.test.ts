import { describe, it, expect, vi } from 'vitest';
import { HubAuthClient } from './hub';
import { AuthError } from './types';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('HubAuthClient', () => {
  it('posts credentials to the configured login path and returns a session', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, { token: 'tok', user: { id: 'u1', email: 'ana@acme.com', name: 'Ana Ruiz' } })
    );
    const client = new HubAuthClient({ apiBaseUrl: 'https://hub.example.com', fetchImpl });

    const session = await client.signIn({ email: 'ana@acme.com', password: 'secret-pass' });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://hub.example.com/v1/auth/login',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'ana@acme.com', password: 'secret-pass' }) })
    );
    expect(session.token).toBe('tok');
    expect(session.user.name).toBe('Ana Ruiz');
    expect(session.workspaces).toEqual([{ id: 'default', name: 'My workspace' }]);
  });

  it.each([
    [401, 'invalid_credentials'],
    [400, 'invalid_credentials'],
    [429, 'rate_limited'],
    [404, 'unavailable'],
    [503, 'unavailable'],
  ])('maps HTTP %i to %s', async (status, code) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(status, {}));
    const client = new HubAuthClient({ apiBaseUrl: 'http://localhost:3000', fetchImpl });
    await expect(client.signIn({ email: 'a@b.co', password: 'x' })).rejects.toMatchObject({ code });
  });

  it('reports network failures', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const client = new HubAuthClient({ apiBaseUrl: 'http://localhost:3000', fetchImpl });
    const error = await client.signIn({ email: 'a@b.co', password: 'x' }).catch((e) => e);
    expect(error).toBeInstanceOf(AuthError);
    expect(error.code).toBe('network');
  });

  it('rejects malformed success responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { user: { id: 'u1' } }));
    const client = new HubAuthClient({ apiBaseUrl: 'http://localhost:3000', fetchImpl });
    await expect(client.signIn({ email: 'a@b.co', password: 'x' })).rejects.toMatchObject({ code: 'unknown' });
  });

  it('signs out with the bearer token and never throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('offline'));
    const client = new HubAuthClient({ apiBaseUrl: 'http://localhost:3000', loginPath: '/auth', fetchImpl });
    await expect(
      client.signOut({ token: 't', user: { id: 'u', email: 'a@b.co', name: 'A' }, workspaces: [] })
    ).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3000/v1/auth/logout',
      expect.objectContaining({ headers: { Authorization: 'Bearer t' } })
    );
  });
});
