import React, { useMemo } from 'react';
import type { AdminActivityEntry } from '@signet/types';
import { AdminActivityCard } from './AdminActivityCard.js';
import { LoadingSpinner } from '../shared/LoadingSpinner.js';
import { ErrorMessage } from '../shared/ErrorMessage.js';
import { RequestsIcon } from '../shared/Icons.js';
import styles from './RequestsPanel.module.css';

type DateGroup = 'Today' | 'Yesterday' | 'This Week' | 'Older';

function getDateGroup(dateStr: string): DateGroup {
  const date = new Date(dateStr);
  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateOnly >= today) return 'Today';
  if (dateOnly >= yesterday) return 'Yesterday';
  if (dateOnly >= weekAgo) return 'This Week';
  return 'Older';
}

function groupEntriesByDate(entries: AdminActivityEntry[]): Map<DateGroup, AdminActivityEntry[]> {
  const groups = new Map<DateGroup, AdminActivityEntry[]>();
  const order: DateGroup[] = ['Today', 'Yesterday', 'This Week', 'Older'];

  order.forEach(group => groups.set(group, []));

  entries.forEach(entry => {
    const group = getDateGroup(entry.timestamp);
    groups.get(group)!.push(entry);
  });

  order.forEach(group => {
    if (groups.get(group)!.length === 0) {
      groups.delete(group);
    }
  });

  return groups;
}

interface AdminActivityListProps {
  entries: AdminActivityEntry[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onRefresh: () => void;
}

export function AdminActivityList({
  entries,
  loading,
  loadingMore,
  error,
  hasMore,
  onLoadMore,
  onRefresh,
}: AdminActivityListProps) {
  const groupedEntries = useMemo(() => groupEntriesByDate(entries), [entries]);

  if (error) {
    return <ErrorMessage error={error} onRetry={onRefresh} retrying={loading} />;
  }

  if (loading && entries.length === 0) {
    return <LoadingSpinner text="Loading admin activity..." />;
  }

  if (entries.length === 0) {
    return (
      <div className={styles.emptyState} aria-live="polite">
        <span className={styles.emptyIcon} aria-hidden="true">
          <RequestsIcon size={48} />
        </span>
        <span>No admin activity</span>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {Array.from(groupedEntries.entries()).map(([group, groupEntries]) => (
        <div key={group} className={styles.dateGroup}>
          <h3 className={styles.dateGroupHeader}>{group}</h3>
          <div className={styles.dateGroupList}>
            {groupEntries.map(entry => (
              <AdminActivityCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      ))}

      {hasMore && (
        <button
          type="button"
          className={styles.loadMoreButton}
          onClick={onLoadMore}
          disabled={loadingMore}
        >
          {loadingMore ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
