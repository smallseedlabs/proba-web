import type { Session } from './types';

const KEY = 'proba.session';

/** The default workspace was renamed from `default` ("My workspace") to `seedbed` ("Seedbed"); fix up sessions stored before that. */
function migrateLegacyWorkspace(session: Session): Session {
  if (!Array.isArray(session.workspaces) || !session.workspaces.some((w) => w.id === 'default')) return session;
  return {
    ...session,
    workspaces: session.workspaces.map((w) => (w.id === 'default' ? { id: 'seedbed', name: 'Seedbed' } : w)),
  };
}

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
      return migrateLegacyWorkspace(session);
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
