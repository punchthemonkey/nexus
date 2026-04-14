export interface TursoConfig {
  url: string;
  authToken: string;
  syncUrl?: string;
  syncInterval?: number;
}

export function getTursoConfig(): TursoConfig | null {
  const url = import.meta.env.VITE_TURSO_DB_URL;
  const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN;
  if (!url || !authToken) return null;
  return {
    url,
    authToken,
    syncUrl: import.meta.env.VITE_TURSO_SYNC_URL || 'https://sync.turso.io',
    syncInterval: parseInt(import.meta.env.VITE_TURSO_SYNC_INTERVAL || '30000'),
  };
}
