import { useState, useEffect, useCallback, useRef } from 'react';
import type { HealthStatus } from '@signet/types';
import { apiGet } from '../lib/api-client.js';

// Refresh health status every 30 seconds
const REFRESH_INTERVAL_MS = 30 * 1000;

export type UIHealthStatus = 'healthy' | 'degraded' | 'offline';

export interface UseHealthResult {
    health: HealthStatus | null;
    uiStatus: UIHealthStatus;
    loading: boolean;
    error: string | null;
    refresh: () => void;
}

export function useHealth(): UseHealthResult {
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const refresh = useCallback(async () => {
        try {
            const data = await apiGet<HealthStatus>('/health');
            setHealth(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load health status');
            // Keep the last known health status but mark error
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Initial fetch
        refresh();

        // Auto-refresh every 30 seconds
        intervalRef.current = setInterval(refresh, REFRESH_INTERVAL_MS);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [refresh]);

    // Derive UI status from health and error state
    const uiStatus: UIHealthStatus = error
        ? 'offline'
        : health?.status === 'degraded'
            ? 'degraded'
            : 'healthy';

    return { health, uiStatus, loading, error, refresh };
}
