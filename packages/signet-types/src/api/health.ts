/**
 * Health status returned by the /health endpoint.
 */
export interface HealthStatus {
    status: 'ok' | 'degraded';
    uptime: number;
    memory: {
        heapMB: number;
        rssMB: number;
    };
    relays: {
        connected: number;
        total: number;
    };
    keys: {
        active: number;
        locked: number;
        offline: number;
    };
    subscriptions: number;
    sseClients: number;
    lastPoolReset: string | null;
}
