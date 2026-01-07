import React, { useState } from 'react';
import type { HealthStatus, RelayStatusResponse } from '@signet/types';
import type { UIHealthStatus } from '../../hooks/useHealth.js';
import { X, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { formatUptime, formatRelativeTime } from '../../lib/formatters.js';
import styles from './SystemStatusModal.module.css';

interface SystemStatusModalProps {
    open: boolean;
    onClose: () => void;
    health: HealthStatus | null;
    uiStatus: UIHealthStatus;
    relayStatus: RelayStatusResponse | null;
}

const STATUS_LABELS: Record<UIHealthStatus, string> = {
    healthy: 'Healthy',
    degraded: 'Degraded',
    offline: 'Offline',
};

export function SystemStatusModal({
    open,
    onClose,
    health,
    uiStatus,
    relayStatus,
}: SystemStatusModalProps) {
    const [relaysExpanded, setRelaysExpanded] = useState(false);
    const now = Date.now();

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!open) return null;

    const formatLastReset = (iso: string | null): string => {
        if (!iso) return 'Never';
        return formatRelativeTime(iso, now);
    };

    return (
        <div className={styles.backdrop} onClick={handleBackdropClick} role="presentation">
            <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="status-modal-title">
                <div className={styles.header}>
                    <h2 id="status-modal-title" className={styles.title}>System Status</h2>
                    <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.content}>
                    {/* Status Badge */}
                    <div className={`${styles.statusBadge} ${styles[`status_${uiStatus}`]}`}>
                        <span className={styles.statusDot} />
                        {STATUS_LABELS[uiStatus]}
                    </div>

                    {health ? (
                        <>
                            {/* Stats Grid */}
                            <div className={styles.statsGrid}>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>Uptime</span>
                                    <span className={styles.statValue}>{formatUptime(health.uptime)}</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>Memory</span>
                                    <span className={styles.statValue}>
                                        {health.memory.rssMB.toFixed(0)} MB
                                    </span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>Active Listeners</span>
                                    <span className={styles.statValue}>{health.subscriptions}</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>Connected Clients</span>
                                    <span className={styles.statValue}>{health.sseClients}</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>Last Reset</span>
                                    <span className={styles.statValue}>{formatLastReset(health.lastPoolReset)}</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>Keys</span>
                                    <span className={styles.statValue}>
                                        {health.keys.active} active
                                        {health.keys.locked > 0 && `, ${health.keys.locked} locked`}
                                    </span>
                                </div>
                            </div>

                            {/* Relay Section */}
                            <button
                                type="button"
                                className={styles.relayHeader}
                                onClick={() => setRelaysExpanded(!relaysExpanded)}
                                aria-expanded={relaysExpanded}
                            >
                                <span className={styles.relayHeaderText}>
                                    Relays ({health.relays.connected}/{health.relays.total} connected)
                                </span>
                                {relaysExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>

                            {relaysExpanded && relayStatus && (
                                <div className={styles.relayList}>
                                    {relayStatus.relays.map((relay) => (
                                        <div key={relay.url} className={styles.relayItem}>
                                            <div className={styles.relayInfo}>
                                                <span className={styles.relayUrl}>{relay.url}</span>
                                                <span className={styles.relayTime}>
                                                    {relay.connected
                                                        ? relay.lastConnected
                                                            ? `Connected ${formatRelativeTime(relay.lastConnected, now)}`
                                                            : 'Connected'
                                                        : relay.lastDisconnected
                                                            ? `Disconnected ${formatRelativeTime(relay.lastDisconnected, now)}`
                                                            : 'Disconnected'}
                                                </span>
                                            </div>
                                            <div className={`${styles.relayStatus} ${relay.connected ? styles.connected : styles.disconnected}`}>
                                                {relay.connected ? <CheckCircle size={18} /> : <XCircle size={18} />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className={styles.offlineMessage}>
                            Unable to connect to daemon
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
