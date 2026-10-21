import type { Page, Route } from '@playwright/test';

/**
 * Network-level stand-ins for Firebase Authentication (identitytoolkit and
 * securetoken REST APIs used by the Firebase JS SDK) and for proba-hub, so the
 * real production build runs with the real SDK but no Firebase project.
 * Values match the e2e build in playwright.config.ts.
 */
export const HUB = 'http://127.0.0.1:3999';
export const PROJECT_ID = 'proba-e2e';

export const ACCOUNT = {
  uid: 'firebase-uid-alex',
  email: 'alex.morgan@northwindoutdoor.com',
  password: 'correct-horse-battery',
  name: 'Alex Morgan',
};

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

/** A Firebase-shaped ID token. The browser never verifies signatures; the Hub does. */
function idToken(n: number): string {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64url({ alg: 'RS256', kid: 'e2e', typ: 'JWT' }),
    b64url({
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      aud: PROJECT_ID,
      auth_time: now,
      user_id: ACCOUNT.uid,
      sub: ACCOUNT.uid,
      iat: now,
      exp: now + 3600,
      email: ACCOUNT.email,
      email_verified: true,
      name: ACCOUNT.name,
      n,
      firebase: { identities: { email: [ACCOUNT.email] }, sign_in_provider: 'password' },
    }),
    'c2lnbmF0dXJl',
  ].join('.');
}

export interface MockState {
  /** Calls by name, e.g. "firebase:signInWithPassword", "hub:session". */
  calls: { name: string; body?: unknown; token?: string }[];
  /** Hub session tokens the Hub currently accepts. */
  validHubTokens: Set<string>;
  /** When true, the Hub refuses every ID token as expired. */
  hubRejectsIdTokens: boolean;
  /** When true, Firebase cannot refresh the ID token (refresh token revoked). */
  refreshRevoked: boolean;
  count(name: string): number;
}

async function json(route: Route, status: number, body: unknown) {
  await route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

export async function mockBackends(page: Page): Promise<MockState> {
  let issued = 0;
  let hubSessions = 0;
  const state: MockState = {
    calls: [],
    validHubTokens: new Set(),
    hubRejectsIdTokens: false,
    refreshRevoked: false,
    count: (name) => state.calls.filter((c) => c.name === name).length,
  };

  const firebaseError = (route: Route, message: string) =>
    json(route, 400, { error: { code: 400, message, errors: [{ message, reason: 'invalid' }] } });

  await page.route('https://identitytoolkit.googleapis.com/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(request.url());
    const method = url.pathname.split(':').pop() ?? url.pathname;
    const body = request.postDataJSON() as Record<string, unknown> | null;
    state.calls.push({ name: `firebase:${method}`, body });

    switch (method) {
      case 'signInWithPassword':
        if (body?.email !== ACCOUNT.email || body?.password !== ACCOUNT.password) {
          return firebaseError(route, 'INVALID_LOGIN_CREDENTIALS');
        }
        return json(route, 200, {
          kind: 'identitytoolkit#VerifyPasswordResponse',
          localId: ACCOUNT.uid,
          email: ACCOUNT.email,
          displayName: ACCOUNT.name,
          idToken: idToken(++issued),
          registered: true,
          refreshToken: 'refresh-token',
          expiresIn: '3600',
        });
      case 'lookup':
        return json(route, 200, {
          kind: 'identitytoolkit#GetAccountInfoResponse',
          users: [
            {
              localId: ACCOUNT.uid,
              email: ACCOUNT.email,
              emailVerified: true,
              displayName: ACCOUNT.name,
              providerUserInfo: [{ providerId: 'password', email: ACCOUNT.email, rawId: ACCOUNT.email }],
              validSince: '1700000000',
              lastLoginAt: String(Date.now()),
              createdAt: '1700000000000',
            },
          ],
        });
      case 'sendOobCode':
        return json(route, 200, { kind: 'identitytoolkit#GetOobConfirmationCodeResponse', email: body?.email });
      default:
        return firebaseError(route, 'OPERATION_NOT_ALLOWED');
    }
  });

  await page.route('https://securetoken.googleapis.com/**', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    state.calls.push({ name: 'firebase:refresh' });
    if (state.refreshRevoked) return firebaseError(route, 'TOKEN_EXPIRED');
    const token = idToken(++issued);
    return json(route, 200, {
      access_token: token,
      expires_in: '3600',
      token_type: 'Bearer',
      refresh_token: 'refresh-token',
      id_token: token,
      user_id: ACCOUNT.uid,
      project_id: PROJECT_ID,
    });
  });

  await page.route(`${HUB}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(request.url());
    const bearer = request.headers()['authorization']?.replace(/^Bearer /, '') ?? url.searchParams.get('token') ?? '';
    const authorized = state.validHubTokens.has(bearer);

    switch (`${request.method()} ${url.pathname}`) {
      case 'POST /v1/auth/session': {
        const body = request.postDataJSON() as { idToken?: string };
        state.calls.push({ name: 'hub:session', body });
        const payload = JSON.parse(Buffer.from((body.idToken ?? '').split('.')[1] ?? '', 'base64url').toString() || '{}');
        if (state.hubRejectsIdTokens || payload.aud !== PROJECT_ID) {
          return json(route, 401, { error: 'token_expired', message: 'Your sign-in has expired. Sign in again.' });
        }
        const token = `hub-session-${++hubSessions}`;
        state.validHubTokens.add(token);
        return json(route, 200, {
          token,
          user: { id: 'hub-user-1', email: ACCOUNT.email, name: ACCOUNT.name },
          workspaces: [{ id: 'default', name: 'My workspace' }],
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        });
      }
      case 'POST /v1/auth/logout':
        state.calls.push({ name: 'hub:logout', token: bearer });
        state.validHubTokens.delete(bearer);
        return route.fulfill({ status: 204, headers: CORS });
      case 'GET /v1/auth/me':
        state.calls.push({ name: 'hub:me', token: bearer });
        return authorized
          ? json(route, 200, { user: { id: 'hub-user-1', email: ACCOUNT.email, name: ACCOUNT.name } })
          : json(route, 401, { error: 'invalid_token' });
      case 'GET /v1/events':
        state.calls.push({ name: 'hub:events', token: bearer });
        if (!authorized) return json(route, 401, { error: 'invalid_token' });
        // One heartbeat, then the stream ends and EventSource reconnects.
        return route.fulfill({
          status: 200,
          headers: { ...CORS, 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
          body: ': heartbeat\n\n',
        });
      case 'POST /v1/commands':
        state.calls.push({ name: 'hub:command', token: bearer });
        return authorized ? json(route, 202, { status: 'accepted' }) : json(route, 401, { error: 'invalid_token' });
      default:
        return json(route, 404, { error: 'not_found' });
    }
  });

  return state;
}
