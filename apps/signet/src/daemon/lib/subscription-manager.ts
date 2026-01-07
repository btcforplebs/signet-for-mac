import createDebug from 'debug';
import type { RelayPool, SubscriptionFilter } from './relay-pool.js';
import type { Event } from 'nostr-tools/pure';

const debug = createDebug('signet:subscription-manager');

// How often to run the health check loop
const HEALTH_CHECK_INTERVAL_MS = 60 * 1000; // 60 seconds

// How long to wait for a ping response before considering connection dead
const PING_TIMEOUT_MS = 10 * 1000; // 10 seconds

// Debounce subscription restarts to avoid rapid-fire restarts
const RESTART_DEBOUNCE_MS = 2000; // 2 seconds

// Fallback sleep detection: if health check interval exceeds this, assume system slept
// This is a backup in case RelayPool's heartbeat doesn't fire after long sleep
const SLEEP_DETECTION_THRESHOLD_MS = HEALTH_CHECK_INTERVAL_MS * 3; // 3 minutes

export interface ManagedSubscription {
    id: string;
    filter: SubscriptionFilter;
    onEvent: (event: Event) => void;
    cleanup?: () => void;
}

export interface SubscriptionManagerConfig {
    pool: RelayPool;
    healthCheckInterval?: number;
    pingTimeout?: number;
}

type SubscriptionManagerEventType =
    | 'subscription-restarted'
    | 'health-check-failed'
    | 'health-check-passed';

type SubscriptionManagerListener = (event: { type: SubscriptionManagerEventType; data?: any }) => void;

/**
 * Manages subscription lifecycle with automatic reconnection.
 *
 * Features:
 * - Listens for pool-reset events and recreates subscriptions
 * - Periodic ping-based health checks
 * - Automatic subscription restart on failure
 * - Debounced restarts to avoid rapid-fire reconnections
 *
 * Note: Sleep/wake detection is handled by RelayPool, which emits 'pool-reset'
 * events when the system wakes from sleep.
 */
export class SubscriptionManager {
    private readonly pool: RelayPool;
    private readonly healthCheckInterval: number;
    private readonly pingTimeout: number;

    private readonly subscriptions: Map<string, ManagedSubscription> = new Map();
    private readonly listeners: Set<SubscriptionManagerListener> = new Set();

    private healthCheckTimer?: NodeJS.Timeout;
    private isRunning = false;
    private restartDebounceTimer?: NodeJS.Timeout;
    private pendingRestart = false;
    private poolListenerCleanup?: () => void;
    private lastHealthCheck: number = 0;

    constructor(config: SubscriptionManagerConfig) {
        this.pool = config.pool;
        this.healthCheckInterval = config.healthCheckInterval ?? HEALTH_CHECK_INTERVAL_MS;
        this.pingTimeout = config.pingTimeout ?? PING_TIMEOUT_MS;
    }

    /**
     * Start the subscription manager's health check loop.
     */
    public start(): void {
        if (this.isRunning) {
            debug('already running, ignoring start()');
            return;
        }

        this.isRunning = true;
        this.lastHealthCheck = Date.now();

        // Listen for pool-reset events to recreate subscriptions
        this.poolListenerCleanup = this.pool.on((event) => {
            if (event.type === 'pool-reset') {
                debug('received pool-reset event, scheduling subscription restart');
                this.scheduleRestart('pool-reset');
            }
        });

        // Start periodic health checks
        this.healthCheckTimer = setInterval(() => {
            this.runHealthCheck();
        }, this.healthCheckInterval);

        debug('started with %dms health check interval', this.healthCheckInterval);
        console.log(`Subscription health monitoring started (checking every ${this.healthCheckInterval / 1000}s)`);

        // Run initial health check after a short delay to allow subscriptions to connect
        setTimeout(() => {
            if (this.isRunning && this.subscriptions.size > 0) {
                console.log('Running initial relay health check...');
                this.runHealthCheck();
            }
        }, 5000);
    }

    /**
     * Stop the subscription manager.
     */
    public stop(): void {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;

        // Clean up pool listener
        this.poolListenerCleanup?.();
        this.poolListenerCleanup = undefined;

        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = undefined;
        }

        if (this.restartDebounceTimer) {
            clearTimeout(this.restartDebounceTimer);
            this.restartDebounceTimer = undefined;
        }

        debug('stopped');
        console.log('Subscription health monitoring stopped');
    }

    /**
     * Register a subscription to be managed.
     * The subscription will be automatically restarted if the connection fails.
     */
    public subscribe(
        id: string,
        filter: SubscriptionFilter,
        onEvent: (event: Event) => void
    ): () => void {
        // Close existing subscription with same ID
        this.unsubscribe(id);

        // Create the subscription
        const cleanup = this.pool.subscribe(filter, onEvent, id);

        // Track it
        const managed: ManagedSubscription = {
            id,
            filter,
            onEvent,
            cleanup,
        };
        this.subscriptions.set(id, managed);

        debug('registered managed subscription %s', id);

        // Return cleanup function
        return () => this.unsubscribe(id);
    }

    /**
     * Unregister and close a managed subscription.
     */
    public unsubscribe(id: string): void {
        const managed = this.subscriptions.get(id);
        if (managed) {
            managed.cleanup?.();
            this.subscriptions.delete(id);
            debug('unregistered subscription %s', id);
        }
    }

    /**
     * Get the number of managed subscriptions.
     */
    public getSubscriptionCount(): number {
        return this.subscriptions.size;
    }

    /**
     * Add an event listener.
     */
    public on(listener: SubscriptionManagerListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Force restart all subscriptions.
     */
    public async restartAll(): Promise<void> {
        await this.doRestartSubscriptions('manual');
    }

    /**
     * Run a ping-based health check by querying for events.
     * If we don't get an EOSE within the timeout, assume connection is dead.
     * Also includes fallback sleep detection in case RelayPool's heartbeat didn't fire.
     */
    private async runHealthCheck(): Promise<void> {
        const now = Date.now();
        const elapsed = now - this.lastHealthCheck;
        this.lastHealthCheck = now;

        // Fallback sleep detection: if too much time passed since last check, assume system slept
        // This catches cases where RelayPool's heartbeat didn't fire after long sleep
        if (elapsed > SLEEP_DETECTION_THRESHOLD_MS) {
            const sleepDuration = Math.round((elapsed - this.healthCheckInterval) / 1000);
            console.log(`System wake detected via health check (slept ~${sleepDuration}s), resetting pool`);
            this.pool.resetPool();
            // Pool reset will emit 'pool-reset' event, which triggers subscription restart
            // No need to continue with ping check - subscriptions will be recreated
            return;
        }

        console.log(`Running relay health check (${this.subscriptions.size} subscriptions)...`);
        if (this.subscriptions.size === 0) {
            debug('no subscriptions to health check');
            return;
        }

        debug('running health check');

        try {
            const healthy = await this.pingRelays();
            if (healthy) {
                console.log('Relay health check passed (EOSE received)');
                this.pool.reportHealthCheckSuccess();
                this.emit({ type: 'health-check-passed' });
            } else {
                console.log('Relay health check FAILED (no EOSE), scheduling subscription refresh');
                const poolReset = this.pool.reportHealthCheckFailure();
                this.emit({ type: 'health-check-failed' });
                // Always restart subscriptions - if pool was reset, subscriptions need recreating
                this.scheduleRestart(poolReset ? 'pool-reset' : 'health-check-failed');
            }
        } catch (error) {
            console.log(`Relay health check error: ${(error as Error).message}, scheduling subscription refresh`);
            const poolReset = this.pool.reportHealthCheckFailure();
            this.emit({ type: 'health-check-failed', data: { error: (error as Error).message } });
            this.scheduleRestart(poolReset ? 'pool-reset' : 'health-check-error');
        }
    }

    /**
     * Ping relays by creating a temporary subscription and waiting for EOSE.
     * Returns true only if we actually receive an EOSE response from at least one relay.
     */
    private pingRelays(): Promise<boolean> {
        return new Promise((resolve) => {
            const pingId = `ping-${Date.now()}`;
            let resolved = false;
            let gotEose = false;

            const finish = (success: boolean) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    cleanup();
                    debug('ping result: %s (gotEose=%s)', success, gotEose);
                    resolve(success);
                }
            };

            // Set timeout - if we don't get EOSE in time, consider it failed
            const timeout = setTimeout(() => {
                debug('ping timeout - no EOSE received');
                finish(false);
            }, this.pingTimeout);

            // Create a subscription that will immediately get EOSE
            // Query for events with an impossible filter (future timestamp)
            // The onEose callback is called when at least one relay responds
            const cleanup = this.pool.subscribe(
                {
                    kinds: [0],
                    since: Math.floor(Date.now() / 1000) + 86400 * 365, // 1 year in future
                    limit: 1,
                },
                () => {
                    // We don't expect any events, but handle if we get one
                },
                pingId,
                () => {
                    // EOSE callback - at least one relay responded
                    gotEose = true;
                    finish(true);
                }
            );
        });
    }

    /**
     * Schedule a debounced restart of all subscriptions.
     */
    private scheduleRestart(reason: string): void {
        if (this.pendingRestart) {
            debug('restart already scheduled, ignoring');
            return;
        }

        this.pendingRestart = true;

        if (this.restartDebounceTimer) {
            clearTimeout(this.restartDebounceTimer);
        }

        this.restartDebounceTimer = setTimeout(() => {
            this.restartDebounceTimer = undefined;
            this.pendingRestart = false;
            this.doRestartSubscriptions(reason);
        }, RESTART_DEBOUNCE_MS);

        debug('scheduled restart in %dms (reason: %s)', RESTART_DEBOUNCE_MS, reason);
    }

    /**
     * Actually restart all subscriptions.
     */
    private async doRestartSubscriptions(reason: string): Promise<void> {
        const count = this.subscriptions.size;
        if (count === 0) {
            debug('no subscriptions to restart');
            return;
        }

        console.log(`Restarting ${count} subscription(s) (reason: ${reason})`);

        // Collect subscription info before closing
        const toRestart: ManagedSubscription[] = [];
        for (const managed of this.subscriptions.values()) {
            toRestart.push({
                id: managed.id,
                filter: managed.filter,
                onEvent: managed.onEvent,
            });
        }

        // Close all existing subscriptions
        for (const managed of this.subscriptions.values()) {
            managed.cleanup?.();
        }
        this.subscriptions.clear();

        // Brief pause to let connections settle
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Recreate all subscriptions
        for (const sub of toRestart) {
            const cleanup = this.pool.subscribe(sub.filter, sub.onEvent, sub.id);
            this.subscriptions.set(sub.id, {
                ...sub,
                cleanup,
            });
            debug('restarted subscription %s', sub.id);
        }

        console.log(`Restarted ${count} subscription(s) successfully`);
        this.emit({ type: 'subscription-restarted', data: { count, reason } });
    }

    /**
     * Emit an event to listeners.
     */
    private emit(event: { type: SubscriptionManagerEventType; data?: any }): void {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (error) {
                debug('listener error: %s', (error as Error).message);
            }
        }
    }
}
