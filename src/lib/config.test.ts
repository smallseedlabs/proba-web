import { describe, it, expect, vi, afterEach } from 'vitest';
import { firebaseConfig, loadConfig } from './config';

const FULL = {
  FIREBASE_API_KEY: 'key',
  FIREBASE_AUTH_DOMAIN: 'proba.firebaseapp.com',
  FIREBASE_PROJECT_ID: 'proba',
  FIREBASE_APP_ID: '1:2:web:3',
};

afterEach(() => vi.unstubAllEnvs());

describe('firebaseConfig', () => {
  it('reads the Firebase web config from runtime values', () => {
    expect(firebaseConfig(FULL)).toEqual({
      apiKey: 'key',
      authDomain: 'proba.firebaseapp.com',
      projectId: 'proba',
      appId: '1:2:web:3',
    });
  });

  it('falls back to build-time VITE_FIREBASE_* values', () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'build-key');
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'b.firebaseapp.com');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'b');
    vi.stubEnv('VITE_FIREBASE_APP_ID', 'b-app');
    expect(firebaseConfig({ FIREBASE_PROJECT_ID: '' })).toEqual({
      apiKey: 'build-key',
      authDomain: 'b.firebaseapp.com',
      projectId: 'b',
      appId: 'b-app',
    });
  });

  it('is null unless every value is present', () => {
    expect(firebaseConfig({ ...FULL, FIREBASE_APP_ID: ' ' })).toBeNull();
    expect(firebaseConfig(undefined)).toBeNull();
  });

  it('is part of the app config', () => {
    expect(loadConfig({ API_BASE_URL: 'https://hub.example.com', ...FULL })).toMatchObject({
      apiBaseUrl: 'https://hub.example.com',
      firebase: { projectId: 'proba' },
    });
  });
});
