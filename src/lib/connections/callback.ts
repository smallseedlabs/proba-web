import type { OAuthCallbackParams } from '../actions/client';

const CALLBACK_PATH = /^\/marketing\/([a-z]+)\/callback\/?$/;
const STORAGE_KEY = 'proba.oauthCallback';

export interface PendingOAuthCallback extends OAuthCallbackParams {
  provider: string;
}

/**
 * If this page load is a provider OAuth redirect (/marketing/<provider>/callback?code&state),
 * keep the one-time code and state in sessionStorage, then replace the URL with the
 * Marketing section so the code is not left in history, bookmarks or the Referer.
 * The Hub checks that the state belongs to the signed-in user before it exchanges the code.
 */
export function captureOAuthCallback(win: Window): boolean {
  const match = CALLBACK_PATH.exec(win.location.pathname);
  if (!match) return false;
  const params = new URLSearchParams(win.location.search);
  const state = params.get('state') ?? '';
  const pending: PendingOAuthCallback = {
    provider: match[1]!,
    state,
    ...(params.get('code') ? { code: params.get('code')! } : {}),
    ...(params.get('error') ? { error: params.get('error')! } : {}),
  };
  try {
    if (state) win.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // storage blocked: the owner just starts Connect again
  }
  win.history.replaceState(null, '', '/#/marketing');
  return true;
}

/** Read and remove the pending callback (single use). */
export function takePendingOAuthCallback(storage: Storage = window.sessionStorage): PendingOAuthCallback | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
    storage.removeItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingOAuthCallback>;
    if (typeof parsed.provider !== 'string' || typeof parsed.state !== 'string' || !parsed.state) return null;
    return {
      provider: parsed.provider,
      state: parsed.state,
      ...(typeof parsed.code === 'string' ? { code: parsed.code } : {}),
      ...(typeof parsed.error === 'string' ? { error: parsed.error } : {}),
    };
  } catch {
    return null;
  }
}
