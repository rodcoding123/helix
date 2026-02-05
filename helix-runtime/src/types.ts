/**
 * Core OpenClaw Runtime Types
 */

/**
 * OpenClaw method interface
 */
export interface OpenClawMethod {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

/**
 * Gateway request context
 */
export interface GatewayRequestContext {
  userId?: string;
  permissions?: Record<string, boolean>;
  commands?: string[];
  auth?: {
    token?: string;
    password?: string;
  };
  role?: string;
  db?: any;
  maxProtocol: number;
  log?: {
    info?: (msg: string) => void;
    error?: (msg: string) => void;
    warn?: (msg: string) => void;
    debug?: (msg: string) => void;
  };
}
