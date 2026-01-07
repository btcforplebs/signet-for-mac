import prisma from '../../db.js';
import type { ApprovalType } from '../lib/acl.js';

export interface LogEntry {
    id: number;
    timestamp: Date;
    type: string;
    method: string | null;
    params: string | null;
    keyUserId: number | null;
    autoApproved: boolean;
    approvalType: string | null;
    keyName: string | null;
    remotePubkey: string | null;
    KeyUser?: {
        keyName: string;
        userPubkey: string;
        description: string | null;
    } | null;
}

export interface ActivityEntry {
    id: number;
    timestamp: string;
    type: string;
    method?: string;
    eventKind?: number;
    keyName?: string;
    userPubkey?: string;
    appName?: string;
    autoApproved: boolean;
    approvalType?: ApprovalType;
}

export class LogRepository {
    async create(data: {
        type: string;
        method?: string;
        params?: string;
        keyUserId?: number;
        autoApproved?: boolean;
        approvalType?: ApprovalType;
        keyName?: string;
        remotePubkey?: string;
    }): Promise<LogEntry> {
        return prisma.log.create({
            data: {
                timestamp: new Date(),
                type: data.type,
                method: data.method,
                params: data.params,
                keyUserId: data.keyUserId,
                autoApproved: data.autoApproved ?? false,
                approvalType: data.approvalType,
                keyName: data.keyName,
                remotePubkey: data.remotePubkey,
            },
        });
    }

    async findRecent(limit: number): Promise<LogEntry[]> {
        return prisma.log.findMany({
            take: limit,
            orderBy: { timestamp: 'desc' },
            include: { KeyUser: true },
        });
    }

    async countSince(since: Date): Promise<number> {
        return prisma.log.count({
            where: { timestamp: { gte: since } },
        });
    }

    async getHourlyActivityRaw(): Promise<Array<{ hour: number; type: string; count: number }>> {
        const results = await prisma.$queryRaw<Array<{ hour: number | bigint; type: string; count: number | bigint }>>`
            SELECT
                CAST(strftime('%H', timestamp) AS INTEGER) as hour,
                type,
                COUNT(*) as count
            FROM Log
            WHERE timestamp >= datetime('now', '-24 hours')
            GROUP BY hour, type
            ORDER BY hour ASC
        `;
        // Convert BigInt to Number for JSON serialization
        return results.map(r => ({
            hour: Number(r.hour),
            type: r.type,
            count: Number(r.count),
        }));
    }

    async cleanupExpired(maxAge: Date): Promise<number> {
        const result = await prisma.log.deleteMany({
            where: { timestamp: { lt: maxAge } },
        });
        return result.count;
    }

    toActivityEntry(log: LogEntry): ActivityEntry {
        // Extract event kind from params for sign_event
        let eventKind: number | undefined;
        if (log.method === 'sign_event' && log.params) {
            try {
                const parsed = JSON.parse(log.params);
                // params could be [event] array or just event object
                const event = Array.isArray(parsed) ? parsed[0] : parsed;
                if (typeof event?.kind === 'number') {
                    eventKind = event.kind;
                }
            } catch {
                // Ignore parse errors
            }
        }

        return {
            id: log.id,
            timestamp: log.timestamp.toISOString(),
            type: log.type,
            method: log.method ?? undefined,
            eventKind,
            keyName: log.KeyUser?.keyName ?? log.keyName ?? undefined,
            userPubkey: log.KeyUser?.userPubkey ?? log.remotePubkey ?? undefined,
            appName: log.KeyUser?.description ?? undefined,
            autoApproved: log.autoApproved,
            approvalType: log.approvalType as ApprovalType | undefined,
        };
    }
}

export const logRepository = new LogRepository();

/**
 * Extract event kind from params string (for sign_event method)
 */
export function extractEventKind(params: string | null): number | undefined {
    if (!params) return undefined;
    try {
        const parsed = JSON.parse(params);
        // params could be [event] array or just event object
        const event = Array.isArray(parsed) ? parsed[0] : parsed;
        if (typeof event?.kind === 'number') {
            return event.kind;
        }
    } catch {
        // Ignore parse errors
    }
    return undefined;
}
