import { useState, useCallback, useEffect } from 'react';
import type { DashboardStats, MixedActivityEntry } from '@signet/types';
import { apiGet } from '../lib/api-client.js';
import { buildErrorMessage } from '../lib/formatters.js';
import { useSSESubscription } from '../contexts/ServerEventsContext.js';
import type { ServerEvent } from './useServerEvents.js';

interface DashboardData {
  stats: DashboardStats;
  activity: MixedActivityEntry[];
  hourlyActivity?: Array<{ hour: number; type: string; count: number }>;
}

interface UseDashboardResult {
  stats: DashboardStats | null;
  activity: MixedActivityEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDashboard(): UseDashboardResult {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<MixedActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiGet<DashboardData>('/dashboard');
      setStats(response.stats);
      setActivity(response.activity);
      setError(null);
    } catch (err) {
      setError(buildErrorMessage(err, 'Unable to load dashboard'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Subscribe to SSE events for real-time stats updates
  // The backend emits stats:updated for ALL stat-changing events,
  // so we just replace stats entirely when we receive it
  const handleSSEEvent = useCallback((event: ServerEvent) => {
    // Refresh data on reconnection to ensure consistency
    if (event.type === 'reconnected') {
      refresh();
      return;
    }

    // Handle stats:updated - backend sends fresh stats for all stat changes
    if (event.type === 'stats:updated') {
      setStats(event.stats);
      return;
    }

    // Handle activity updates for all request outcomes
    if (event.type === 'request:auto_approved' || event.type === 'request:approved' || event.type === 'request:denied') {
      setActivity(prev => [event.activity, ...prev].slice(0, 20));
    }

    // Handle admin events (key lock/unlock, app suspend/unsuspend, daemon start)
    if (event.type === 'admin:event') {
      setActivity(prev => [event.activity, ...prev].slice(0, 20));
    }
  }, [refresh]);

  useSSESubscription(handleSSEEvent);

  return {
    stats,
    activity,
    loading,
    error,
    refresh,
  };
}
