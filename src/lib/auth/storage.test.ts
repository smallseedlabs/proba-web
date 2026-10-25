import { describe, it, expect, beforeEach } from 'vitest';
import { sessionStore } from './storage';

const session = { token: 't', user: { id: 'u', email: 'a@b.co', name: 'A' }, workspaces: [] };

describe('sessionStore', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('round-trips a session', () => {
    sessionStore.save(session);
    expect(sessionStore.load()).toEqual(session);
    sessionStore.clear();
    expect(sessionStore.load()).toBeNull();
  });

  it('discards expired sessions', () => {
    sessionStore.save({ ...session, expiresAt: '2000-01-01T00:00:00Z' });
    expect(sessionStore.load()).toBeNull();
  });

  it('ignores corrupt data', () => {
    window.sessionStorage.setItem('proba.session', '{oops');
    expect(sessionStore.load()).toBeNull();
  });

  it('renames a stored legacy default workspace to seedbed', () => {
    sessionStore.save({
      ...session,
      workspaces: [
        { id: 'default', name: 'My workspace' },
        { id: 'other', name: 'Other' },
      ],
    });
    expect(sessionStore.load()?.workspaces).toEqual([
      { id: 'seedbed', name: 'Seedbed' },
      { id: 'other', name: 'Other' },
    ]);
  });
});
