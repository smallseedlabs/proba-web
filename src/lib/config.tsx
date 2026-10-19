import { createContext, useContext, ReactNode } from 'react';

export interface AppConfig {
  apiBaseUrl: string;
  mockMode: boolean;
}

function loadConfig(): AppConfig {
  return {
    apiBaseUrl:
      (window as { ENV?: { API_BASE_URL?: string } }).ENV?.API_BASE_URL ||
      import.meta.env.VITE_API_BASE_URL ||
      'http://localhost:3000',
    mockMode:
      (window as { ENV?: { MOCK_MODE?: string } }).ENV?.MOCK_MODE === 'true' ||
      import.meta.env.VITE_MOCK_MODE === 'true',
  };
}

const ConfigContext = createContext<AppConfig | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const config = loadConfig();
  return (
    <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfig(): AppConfig {
  const config = useContext(ConfigContext);
  if (!config) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return config;
}
