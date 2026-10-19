/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_AUTH_LOGIN_PATH?: string;
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Compile-time flag, see vite.config.ts. Demo data is excluded from the bundle when false. */
declare const __DEMO_MODE__: boolean;
