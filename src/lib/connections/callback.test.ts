import { describe, expect, it, vi } from 'vitest';
import { captureOAuthCallback, takePendingOAuthCallback } from './callback';

function fakeWindow(pathname: string, search: string) {
  const store = new Map<string, string>();
  const sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  } as unknown as Storage;
  const replaceState = vi.fn();
  return { win: { location: { pathname, search }, sessionStorage, history: { replaceState } } as unknown as Window, sessionStorage, replaceState };
}

describe('OAuth callback capture', () => {
  it('stores code and state once and strips them from the URL', () => {
    const { win, sessionStorage, replaceState } = fakeWindow('/marketing/reddit/callback', '?state=s1&code=c1');
    expect(captureOAuthCallback(win)).toBe(true);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/#/marketing');
    expect(takePendingOAuthCallback(sessionStorage)).toEqual({ provider: 'reddit', state: 's1', code: 'c1' });
    expect(takePendingOAuthCallback(sessionStorage)).toBeNull();
  });

  it('keeps a provider error and ignores other paths', () => {
    const denied = fakeWindow('/marketing/reddit/callback', '?state=s2&error=access_denied');
    captureOAuthCallback(denied.win);
    expect(takePendingOAuthCallback(denied.sessionStorage)).toEqual({ provider: 'reddit', state: 's2', error: 'access_denied' });
    const other = fakeWindow('/', '?code=x&state=y');
    expect(captureOAuthCallback(other.win)).toBe(false);
    expect(other.replaceState).not.toHaveBeenCalled();
  });
});
