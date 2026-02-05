/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  // Gateway configuration
  readonly VITE_GATEWAY_URL?: string;
  readonly VITE_GATEWAY_URL_PROD?: string;
  readonly VITE_GATEWAY_RPC_URL?: string;
  readonly VITE_GATEWAY_RPC_URL_PROD?: string;
  // Build mode
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
