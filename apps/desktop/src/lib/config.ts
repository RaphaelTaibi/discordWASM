/**
 * Application configuration based on environment.
 * Uses Vite env variables - automatically switches between dev and prod.
 * 
 * Dev: `pnpm tauri dev` -> loads .env.development (ws://localhost:8080)
 * Prod: `pnpm tauri build` -> loads .env.production (wss://oracle:3001)
 */

const isDev = import.meta.env.DEV;

export const config = {
  /** WebSocket signaling server URL */
  wsUrl: import.meta.env.VITE_SIGNALING_URL || (isDev 
    ? 'ws://localhost:8080/ws' 
    : 'wss://89.168.59.45:3001/ws'),
  
  /** HTTP API base URL */
  apiUrl: import.meta.env.VITE_API_URL || (isDev 
    ? 'http://localhost:8080' 
    : 'https://89.168.59.45:3001'),
  
  /** Current environment */
  env: isDev ? 'development' : 'production',
} as const;

export type AppConfig = typeof config;
