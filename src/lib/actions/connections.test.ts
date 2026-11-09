import { describe, expect, it, vi } from 'vitest';
import { ActionsError, HubActionsClient } from './client';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('HubActionsClient connections', () => {
  it('calls the Hub connection routes with the session token', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === 'POST' && u.endsWith('/v1/connections/reddit/start'))
        return json(200, { authorizeUrl: 'https://oauth.example.test/authorize', expiresAt: '2026-11-09T23:00:00Z' });
      if (init?.method === 'POST' && u.endsWith('/v1/connections/reddit/callback'))
        return json(200, { connection: { provider: 'reddit', displayName: 'Reddit', available: true, status: 'pending_account' } });
      return json(200, { enabled: true, connections: [] });
    });
    const c = new HubActionsClient({ apiBaseUrl: 'http://hub.test', token: 'session-test', fetchImpl: fetchImpl as typeof fetch });
    expect((await c.startConnection('reddit')).authorizeUrl).toBe('https://oauth.example.test/authorize');
    expect((await c.completeConnection('reddit', { state: 's', code: 'c' })).status).toBe('pending_account');
    const [, init] = fetchImpl.mock.calls[1]!;
    expect(JSON.parse(String(init!.body))).toEqual({ state: 's', code: 'c' });
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer session-test');
  });

  it('maps Hub refusals to owner-readable messages', async () => {
    const fetchImpl = vi.fn(async () => json(400, { error: 'invalid_state', message: 'x' }));
    const c = new HubActionsClient({ apiBaseUrl: 'http://hub.test', token: 't', fetchImpl: fetchImpl as unknown as typeof fetch });
    const err = await c.completeConnection('reddit', { state: 's' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ActionsError);
    expect((err as ActionsError).message).toMatch(/expired or was already used/);
  });
});
