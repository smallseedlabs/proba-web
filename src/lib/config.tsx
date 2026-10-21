import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { FirebaseWebConfig } from './auth/firebase';

export interface AppConfig {
  /** Base URL of proba-hub. */
  apiBaseUrl: string;
  /** Firebase Authentication web config; null when incomplete (sign-in unavailable). */
  firebase: FirebaseWebConfig | null;
  /**
   * Development-only demo data. Controlled solely by the build-time
   * VITE_DEMO_MODE flag (off by default) so it can never be switched on in a
   * production deployment at runtime.
   */
  demoMode: boolean;
}

interface RuntimeEnv {
  API_BASE_URL?: string;
  FIREBASE_API_KEY?: string;
  FIREBASE_AUTH_DOMAIN?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_APP_ID?: string;
}

/**
 * Firebase web config from build-time VITE_FIREBASE_* variables. A container
 * may override them at runtime through window.ENV (docker/env.sh).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function firebaseConfig(env: RuntimeEnv | undefined): FirebaseWebConfig | null {
  const pick = (runtime: string | undefined, buildTime: string | undefined) => (runtime || buildTime || '').trim();
  const config: FirebaseWebConfig = {
    apiKey: pick(env?.FIREBASE_API_KEY, import.meta.env.VITE_FIREBASE_API_KEY),
    authDomain: pick(env?.FIREBASE_AUTH_DOMAIN, import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
    projectId: pick(env?.FIREBASE_PROJECT_ID, import.meta.env.VITE_FIREBASE_PROJECT_ID),
    appId: pick(env?.FIREBASE_APP_ID, import.meta.env.VITE_FIREBASE_APP_ID),
  };
  return Object.values(config).every(Boolean) ? config : null;
}

export const DEMO_MODE: boolean = __DEMO_MODE__;

// eslint-disable-next-line react-refresh/only-export-components
export function loadConfig(env: RuntimeEnv | undefined = (window as { ENV?: RuntimeEnv }).ENV): AppConfig {
  return {
    apiBaseUrl: env?.API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
    firebase: firebaseConfig(env),
    demoMode: DEMO_MODE,
  };
}

const ConfigContext = createContext<AppConfig | null>(null);

export function ConfigProvider({ children, config }: { children: ReactNode; config?: AppConfig }) {
  const value = useMemo(() => config ?? loadConfig(), [config]);
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfig(): AppConfig {
  const config = useContext(ConfigContext);
  if (!config) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return config;
}
