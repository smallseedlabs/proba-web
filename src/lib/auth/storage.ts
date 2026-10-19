import type { Session } from './types';

const KEY = 'proba.session';

/** Sessions are kept in sessionStorage so they end when the browser tab closes. */
export const sessionStore = {
  load(storage: Storage = window.sessionStorage): Session | null {
    try {
      const raw = storage.getItem(KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as Session;
      if (!session.token || !session.user) return null;
      if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
        storage.removeItem(KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },
  save(session: Session, storage: Storage = window.sessionStorage): void {
    try {
      storage.setItem(KEY, JSON.stringify(session));
    } catch {
      // Storage may be unavailable (private mode); the session stays in memory.
    }
  },
  clear(storage: Storage = window.sessionStorage): void {
    try {
      storage.removeItem(KEY);
    } catch {
      // ignore
    }
  },
};
