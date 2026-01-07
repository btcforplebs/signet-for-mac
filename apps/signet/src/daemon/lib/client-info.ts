import type { FastifyRequest } from 'fastify';
import type { ClientInfo } from '../repositories/admin-log-repository.js';

/**
 * Extract client information from a Fastify request.
 * Looks for the X-Signet-Client header (format: "name/version" e.g., "signet-android/1.3.0")
 * and the client IP address.
 */
export function getClientInfo(request: FastifyRequest): ClientInfo {
    const clientHeader = request.headers['x-signet-client'];
    let clientName: string | undefined;
    let clientVersion: string | undefined;

    if (typeof clientHeader === 'string' && clientHeader.trim()) {
        // Parse "name/version" format
        const parts = clientHeader.trim().split('/');
        clientName = parts[0] || undefined;
        clientVersion = parts[1] || undefined;
    } else {
        // Default to "Signet UI" for web UI requests (no X-Signet-Client header)
        clientName = 'Signet UI';
    }

    // Get IP address - check X-Forwarded-For for reverse proxy setups
    const forwardedFor = request.headers['x-forwarded-for'];
    let ipAddress: string | undefined;

    if (typeof forwardedFor === 'string') {
        // X-Forwarded-For can be comma-separated list, take the first (original client)
        ipAddress = forwardedFor.split(',')[0]?.trim();
    } else if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
        ipAddress = forwardedFor[0]?.split(',')[0]?.trim();
    } else {
        ipAddress = request.ip;
    }

    return {
        clientName,
        clientVersion,
        ipAddress,
    };
}

/**
 * Create client info for kill switch commands (no HTTP context)
 */
export function getKillSwitchClientInfo(daemonVersion: string): ClientInfo {
    return {
        clientName: 'kill-switch',
        clientVersion: daemonVersion,
        ipAddress: undefined,
    };
}
