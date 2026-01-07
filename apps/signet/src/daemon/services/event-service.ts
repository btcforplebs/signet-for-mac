import createDebug from 'debug';
import type { PendingRequest, ConnectedApp, DashboardStats, KeyInfo, RelayStatusResponse, ActivityEntry } from '@signet/types';
import type { AdminActivityEntry } from '../repositories/admin-log-repository.js';
import { getDashboardService } from './dashboard-service.js';

const debug = createDebug('signet:events');

/**
 * Server-sent event types for real-time updates
 */
export type ServerEvent =
    | { type: 'request:created'; request: PendingRequest }
    | { type: 'request:approved'; requestId: string; activity: ActivityEntry }
    | { type: 'request:denied'; requestId: string; activity: ActivityEntry }
    | { type: 'request:expired'; requestId: string }
    | { type: 'request:auto_approved'; activity: ActivityEntry }
    | { type: 'app:connected'; app: ConnectedApp }
    | { type: 'app:revoked'; appId: number }
    | { type: 'app:updated'; app: ConnectedApp }
    | { type: 'apps:updated' }
    | { type: 'key:created'; key: KeyInfo }
    | { type: 'key:unlocked'; keyName: string }
    | { type: 'key:deleted'; keyName: string }
    | { type: 'key:renamed'; oldName: string; newName: string }
    | { type: 'key:updated'; keyName: string }
    | { type: 'stats:updated'; stats: DashboardStats }
    | { type: 'relays:updated'; relays: RelayStatusResponse }
    | { type: 'admin:event'; activity: AdminActivityEntry }
    | { type: 'ping' };

export type EventCallback = (event: ServerEvent) => void;

/**
 * EventService provides a simple pub/sub mechanism for real-time events.
 * Subscribers receive events when requests are created, approved, denied,
 * or when apps connect.
 */
export class EventService {
    private subscribers: Set<EventCallback> = new Set();

    /**
     * Subscribe to all server events
     * @returns Unsubscribe function
     */
    subscribe(callback: EventCallback): () => void {
        this.subscribers.add(callback);
        return () => {
            this.subscribers.delete(callback);
        };
    }

    /**
     * Get the number of active subscribers
     */
    getSubscriberCount(): number {
        return this.subscribers.size;
    }

    /**
     * Emit an event to all subscribers
     */
    emit(event: ServerEvent): void {
        debug('Emitting event %s to %d subscribers', event.type, this.subscribers.size);
        for (const callback of this.subscribers) {
            try {
                callback(event);
            } catch (error) {
                console.error('Error in event subscriber:', error);
            }
        }
    }

    /**
     * Emit a request:created event
     */
    emitRequestCreated(request: PendingRequest): void {
        this.emit({ type: 'request:created', request });
    }

    /**
     * Emit a request:approved event
     */
    emitRequestApproved(requestId: string, activity: ActivityEntry): void {
        this.emit({ type: 'request:approved', requestId, activity });
    }

    /**
     * Emit a request:denied event
     */
    emitRequestDenied(requestId: string, activity: ActivityEntry): void {
        this.emit({ type: 'request:denied', requestId, activity });
    }

    /**
     * Emit a request:expired event
     */
    emitRequestExpired(requestId: string): void {
        this.emit({ type: 'request:expired', requestId });
    }

    /**
     * Emit an app:connected event
     */
    emitAppConnected(app: ConnectedApp): void {
        this.emit({ type: 'app:connected', app });
    }

    /**
     * Emit a stats:updated event
     */
    emitStatsUpdated(stats: DashboardStats): void {
        this.emit({ type: 'stats:updated', stats });
    }

    /**
     * Emit a key:created event
     */
    emitKeyCreated(key: KeyInfo): void {
        this.emit({ type: 'key:created', key });
    }

    /**
     * Emit a key:unlocked event
     */
    emitKeyUnlocked(keyName: string): void {
        this.emit({ type: 'key:unlocked', keyName });
    }

    /**
     * Emit a key:locked event
     */
    emitKeyLocked(keyName: string): void {
        this.emit({ type: 'key:locked', keyName });
    }

    /**
     * Emit a key:deleted event
     */
    emitKeyDeleted(keyName: string): void {
        this.emit({ type: 'key:deleted', keyName });
    }

    /**
     * Emit a relays:updated event
     */
    emitRelaysUpdated(relays: RelayStatusResponse): void {
        this.emit({ type: 'relays:updated', relays });
    }

    /**
     * Emit a request:auto_approved event
     */
    emitRequestAutoApproved(activity: ActivityEntry): void {
        this.emit({ type: 'request:auto_approved', activity });
    }

    /**
     * Emit an app:revoked event
     */
    emitAppRevoked(appId: number): void {
        this.emit({ type: 'app:revoked', appId });
    }

    /**
     * Emit an app:updated event
     */
    emitAppUpdated(app: ConnectedApp): void {
        this.emit({ type: 'app:updated', app });
    }

    /**
     * Emit an apps:updated event (bulk change, clients should refetch)
     */
    emitAppsUpdated(): void {
        this.emit({ type: 'apps:updated' });
    }

    /**
     * Emit a key:renamed event
     */
    emitKeyRenamed(oldName: string, newName: string): void {
        this.emit({ type: 'key:renamed', oldName, newName });
    }

    /**
     * Emit a key:updated event (e.g., passphrase set)
     */
    emitKeyUpdated(keyName: string): void {
        this.emit({ type: 'key:updated', keyName });
    }

    /**
     * Emit an admin:event for admin activity (key lock/unlock, app suspend/unsuspend, daemon start)
     */
    emitAdminEvent(activity: AdminActivityEntry): void {
        this.emit({ type: 'admin:event', activity });
    }
}

// Singleton instance for global access
let eventServiceInstance: EventService | null = null;

export function getEventService(): EventService {
    if (!eventServiceInstance) {
        eventServiceInstance = new EventService();
    }
    return eventServiceInstance;
}

export function setEventService(service: EventService): void {
    eventServiceInstance = service;
}

/**
 * Helper to fetch current stats and emit stats:updated event.
 * Call this after any operation that changes dashboard stats.
 */
export async function emitCurrentStats(): Promise<void> {
    try {
        const dashboardService = getDashboardService();
        const eventService = getEventService();
        const stats = await dashboardService.getStats();
        eventService.emitStatsUpdated(stats);
    } catch (error) {
        // Log but don't throw - stats emission is not critical
        debug('Failed to emit current stats: %O', error);
    }
}
