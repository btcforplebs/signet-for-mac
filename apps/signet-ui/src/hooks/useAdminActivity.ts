import { useState, useCallback, useEffect } from 'react';
import type { AdminActivityEntry } from '@signet/types';
import { apiGet } from '../lib/api-client.js';
import { buildErrorMessage } from '../lib/formatters.js';
import { useSSESubscription } from '../contexts/ServerEventsContext.js';
import type { ServerEvent } from './useServerEvents.js';

const ADMIN_LIMIT = 20;

interface UseAdminActivityResult {
  entries: AdminActivityEntry[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAdminActivity(): UseAdminActivityResult {
  const [entries, setEntries] = useState<AdminActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const fetchAdminEvents = useCallback(async (offsetVal: number, append: boolean) => {
    const response = await apiGet<{ requests?: AdminActivityEntry[] }>(
      `/requests?limit=${ADMIN_LIMIT}&status=admin&offset=${offsetVal}`
    );

    const list = Array.isArray(response.requests) ? response.requests : [];

    if (append) {
      setEntries(prev => [...prev, ...list]);
    } else {
      setEntries(list);
      setOffset(ADMIN_LIMIT);
    }

    setHasMore(list.length === ADMIN_LIMIT);
  }, []);

  const refresh = useCallback(async () => {
    try {
      await fetchAdminEvents(0, false);
      setError(null);
    } catch (err) {
      setError(buildErrorMessage(err, 'Unable to refresh admin activity'));
    }
  }, [fetchAdminEvents]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      await fetchAdminEvents(offset, true);
      setOffset(prev => prev + ADMIN_LIMIT);
    } catch (err) {
      console.error('Failed to load more admin activity:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, offset, fetchAdminEvents]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setOffset(0);
    setHasMore(true);
    setLoading(true);

    const load = async () => {
      try {
        await fetchAdminEvents(0, false);
        if (!cancelled) setError(null);
      } catch (err) {
        if (!cancelled) setError(buildErrorMessage(err, 'Unable to load admin activity'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [fetchAdminEvents]);

  // Subscribe to SSE events for real-time updates
  const handleSSEEvent = useCallback((event: ServerEvent) => {
    // Refresh data on reconnection to ensure consistency
    if (event.type === 'reconnected') {
      refresh();
      return;
    }

    // Refresh when admin events occur
    if (event.type === 'admin:event') {
      refresh();
    }
  }, [refresh]);

  useSSESubscription(handleSSEEvent);

  return {
    entries,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}
