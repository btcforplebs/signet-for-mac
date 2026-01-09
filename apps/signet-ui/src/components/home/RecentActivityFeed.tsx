import React from 'react';
import type { ActivityEntry, AdminActivityEntry, MixedActivityEntry } from '@signet/types';
import { getMethodLabelPastTense } from '@signet/types';
import { Clock, ChevronRight, Check, X, Activity, Shield, Repeat, Lock, Unlock, Link, Pause, Play, Server, Eye, Terminal } from 'lucide-react';
import { formatTimeAgo } from '../../lib/formatters.js';
import styles from './HomeView.module.css';

// Type guard to check if entry is an admin event
function isAdminEntry(entry: MixedActivityEntry): entry is AdminActivityEntry {
  return 'category' in entry && entry.category === 'admin';
}

// Get label for admin events
function getAdminEventLabel(eventType: string): string {
  switch (eventType) {
    case 'key_locked': return 'Key locked';
    case 'key_unlocked': return 'Key unlocked';
    case 'app_connected': return 'App connected';
    case 'app_suspended': return 'App suspended';
    case 'app_unsuspended': return 'App resumed';
    case 'daemon_started': return 'Daemon started';
    case 'status_checked': return 'Status checked';
    case 'command_executed': return 'Command executed';
    default: return eventType;
  }
}

interface RecentActivityFeedProps {
  activity: MixedActivityEntry[];
  showAutoApproved: boolean;
  onToggleShowAutoApproved: () => void;
  onNavigateToActivity: () => void;
}

export function RecentActivityFeed({
  activity,
  showAutoApproved,
  onToggleShowAutoApproved,
  onNavigateToActivity,
}: RecentActivityFeedProps) {
  // Filter out auto-approved NIP-46 requests when toggle is off
  // Admin events are always shown
  const filteredActivity = showAutoApproved
    ? activity
    : activity.filter(entry => isAdminEntry(entry) || !(entry as ActivityEntry).autoApproved);
  const recentActivity = filteredActivity.slice(0, 5);

  const getActivityIcon = (entry: MixedActivityEntry) => {
    if (isAdminEntry(entry)) {
      switch (entry.eventType) {
        case 'key_locked': return <Lock size={14} className={styles.activityIconAdmin} />;
        case 'key_unlocked': return <Unlock size={14} className={styles.activityIconAdmin} />;
        case 'app_connected': return <Link size={14} className={styles.activityIconAdmin} />;
        case 'app_suspended': return <Pause size={14} className={styles.activityIconAdmin} />;
        case 'app_unsuspended': return <Play size={14} className={styles.activityIconAdmin} />;
        case 'daemon_started': return <Server size={14} className={styles.activityIconAdmin} />;
        case 'status_checked': return <Eye size={14} className={styles.activityIconAdmin} />;
        case 'command_executed': return <Terminal size={14} className={styles.activityIconAdmin} />;
        default: return <Activity size={14} className={styles.activityIconAdmin} />;
      }
    }
    // Regular activity entry
    if (entry.type === 'approval') return <Check size={14} className={styles.activityIconApproved} />;
    if (entry.type === 'denial') return <X size={14} className={styles.activityIconDenied} />;
    return <Clock size={14} className={styles.activityIconPending} />;
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Recent</h2>
        <label className={styles.filterToggle}>
          <input
            type="checkbox"
            className={styles.visuallyHidden}
            checked={showAutoApproved}
            onChange={onToggleShowAutoApproved}
          />
          <span className={styles.checkbox} aria-hidden="true" />
          <span>Show auto</span>
        </label>
      </div>
      {recentActivity.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}><Activity size={18} /></span>
          <p>{activity.length === 0 ? 'No recent activity' : 'No manual approvals'}</p>
        </div>
      ) : (
        <div className={styles.listCard}>
          {recentActivity.map((entry) => {
            // Handle admin events differently
            if (isAdminEntry(entry)) {
              // Determine display name based on event type
              let displayName: string;
              if (entry.eventType === 'daemon_started') {
                displayName = entry.clientVersion ? `v${entry.clientVersion}` : 'Signet';
              } else if (entry.eventType === 'command_executed') {
                displayName = entry.command || 'Unknown command';
              } else {
                displayName = entry.keyName || entry.appName || 'Unknown';
              }

              return (
                <div key={`admin-${entry.id}`} className={styles.activityItem}>
                  <div className={styles.activityRow}>
                    {getActivityIcon(entry)}
                    <span className={styles.activityAppName}>{displayName}</span>
                    <span className={styles.badgeAdmin}>Admin</span>
                  </div>
                  <div className={styles.activityRow}>
                    <span className={styles.activityMethod}>
                      {getAdminEventLabel(entry.eventType)}
                      {' • '}
                      {formatTimeAgo(entry.timestamp)}
                    </span>
                  </div>
                </div>
              );
            }

            // Regular NIP-46 activity entry
            const regularEntry = entry as ActivityEntry;
            return (
              <div key={regularEntry.id} className={styles.activityItem}>
                <div className={styles.activityRow}>
                  {getActivityIcon(regularEntry)}
                  <span className={styles.activityAppName}>
                    {regularEntry.appName || 'Unknown'}
                    {regularEntry.keyName && <span className={styles.activityKeyName}> • {regularEntry.keyName}</span>}
                  </span>
                  <span className={styles.statusBadge}>
                    {regularEntry.type === 'denial' ? (
                      <span className={styles.badgeDenied}>Denied</span>
                    ) : regularEntry.approvalType === 'manual' ? (
                      <span className={styles.badgeApproved} title="Manually approved by you">
                        <Check size={12} /> Approved
                      </span>
                    ) : regularEntry.approvalType === 'auto_trust' ? (
                      <span className={styles.badgeAuto} title="Auto-approved by app's trust level">
                        <Shield size={12} /> Approved
                      </span>
                    ) : regularEntry.approvalType === 'auto_permission' ? (
                      <span className={styles.badgeAuto} title="Auto-approved by saved permission">
                        <Repeat size={12} /> Approved
                      </span>
                    ) : regularEntry.autoApproved ? (
                      <span className={styles.badgeAuto}>Auto Approved</span>
                    ) : regularEntry.type === 'approval' ? (
                      <span className={styles.badgeApproved}>Approved</span>
                    ) : null}
                  </span>
                </div>
                <div className={styles.activityRow}>
                  <span className={styles.activityMethod}>
                    {regularEntry.method ? getMethodLabelPastTense(regularEntry.method, regularEntry.eventKind) : regularEntry.type}
                    {' • '}
                    {formatTimeAgo(regularEntry.timestamp)}
                  </span>
                </div>
              </div>
            );
          })}
          <button type="button" className={styles.viewAllButton} onClick={onNavigateToActivity}>
            View all
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </section>
  );
}
