import { createContext, useContext, useMemo, type ReactNode } from 'react';

export interface AppConfig {
  /** Base URL of proba-hub. */
  apiBaseUrl: string;
  /** Path of the Hub sign-in endpoint. */
  authLoginPath: string;
  /**
   * Development-only demo data. Controlled solely by the build-time
   * VITE_DEMO_MODE flag (off by default) so it can never be switched on in a
   * production deployment at runtime.
   */
  demoMode: boolean;
}

interface RuntimeEnv {
  API_BASE_URL?: string;
  AUTH_LOGIN_PATH?: string;
}

export const DEMO_MODE: boolean = __DEMO_MODE__;

// eslint-disable-next-line react-refresh/only-export-components
export function loadConfig(env: RuntimeEnv | undefined = (window as { ENV?: RuntimeEnv }).ENV): AppConfig {
  return {
    apiBaseUrl: env?.API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
    authLoginPath: env?.AUTH_LOGIN_PATH || import.meta.env.VITE_AUTH_LOGIN_PATH || '/v1/auth/login',
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
