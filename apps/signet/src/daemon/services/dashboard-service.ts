import type { DashboardStats, ActivityEntry } from '@signet/types';
import type { StoredKey } from '../../config/types.js';
import { appRepository, logRepository, requestRepository } from '../repositories/index.js';
import { adminLogRepository, type AdminActivityEntry } from '../repositories/admin-log-repository.js';
import { extractEventKind } from '../lib/parse.js';

export interface DashboardServiceConfig {
    allKeys: Record<string, StoredKey>;
    getActiveKeyCount: () => number;
}

// Union type for mixed activity feed (regular NIP-46 + admin events)
export type MixedActivityEntry = ActivityEntry | AdminActivityEntry;

export interface DashboardData {
    stats: DashboardStats;
    activity: MixedActivityEntry[];
    hourlyActivity: Array<{ hour: number; type: string; count: number }>;
}

export class DashboardService {
    private readonly config: DashboardServiceConfig;

    constructor(config: DashboardServiceConfig) {
        this.config = config;
    }

    /**
     * Get just the dashboard stats (without activity or hourly data)
     * Used for emitting stats:updated events
     */
    async getStats(): Promise<DashboardStats> {
        const totalKeys = Object.keys(this.config.allKeys).length;
        const activeKeys = this.config.getActiveKeyCount();

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const [connectedApps, pendingRequests, recentActivity24h] = await Promise.all([
            appRepository.countActive(),
            requestRepository.countPending(),
            logRepository.countSince(yesterday),
        ]);

        return {
            totalKeys,
            activeKeys,
            connectedApps,
            pendingRequests,
            recentActivity24h,
        };
    }

    async getDashboardData(): Promise<DashboardData> {
        const totalKeys = Object.keys(this.config.allKeys).length;
        const activeKeys = this.config.getActiveKeyCount();

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        // Run all independent queries in parallel (7 queries -> 1 round trip)
        const [
            connectedApps,
            pendingCount,
            recentActivity24h,
            hourlyActivity,
            recentLogs,
            recentAdminLogs,
            recentPendingRequests,
        ] = await Promise.all([
            appRepository.countActive(),
            requestRepository.countPending(),
            logRepository.countSince(yesterday),
            logRepository.getHourlyActivityRaw(),
            logRepository.findRecent(5),
            adminLogRepository.findRecent(5),
            requestRepository.findMany({ status: 'pending', limit: 5, offset: 0 }),
        ]);

        // Convert to activity entries
        const nip46Activity = recentLogs.map(log => logRepository.toActivityEntry(log));
        const adminActivity = recentAdminLogs.map(log => adminLogRepository.toActivityEntry(log));

        // Convert pending requests to activity entries
        const pendingActivity = recentPendingRequests.map(req => ({
            id: req.id,
            timestamp: req.createdAt.toISOString(),
            type: 'pending',
            method: req.method,
            eventKind: req.method === 'sign_event' ? extractEventKind(req.params) : undefined,
            keyName: req.keyName ?? undefined,
            userPubkey: req.remotePubkey,
            appName: req.KeyUser?.description ?? undefined,
            autoApproved: false,
        } as unknown as ActivityEntry));

        // Merge and sort by timestamp (newest first), take top 5
        const activity: MixedActivityEntry[] = [...nip46Activity, ...adminActivity, ...pendingActivity]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 5);

        return {
            stats: {
                totalKeys,
                activeKeys,
                connectedApps,
                pendingRequests: pendingCount,
                recentActivity24h,
            },
            activity,
            hourlyActivity,
        };
    }
}

// Singleton instance for global access
let dashboardServiceInstance: DashboardService | null = null;

export function getDashboardService(): DashboardService {
    if (!dashboardServiceInstance) {
        throw new Error('DashboardService not initialized. Call setDashboardService() first.');
    }
    return dashboardServiceInstance;
}

export function setDashboardService(service: DashboardService): void {
    dashboardServiceInstance = service;
}
