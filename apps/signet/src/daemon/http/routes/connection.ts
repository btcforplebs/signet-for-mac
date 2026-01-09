import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { RelayStatusResponse } from '@signet/types';
import type { ConnectionManager } from '../../connection-manager.js';
import type { RelayService } from '../../services/index.js';
import type { NostrConfig } from '../../../config/types.js';
import type { PreHandlerAuthCsrf } from '../types.js';

export interface ConnectionRouteConfig {
    connectionManager: ConnectionManager;
    nostrConfig: NostrConfig;
    relayService: RelayService;
}

export function registerConnectionRoutes(
    fastify: FastifyInstance,
    config: ConnectionRouteConfig,
    preHandler: PreHandlerAuthCsrf
): void {
    fastify.get('/connection', { preHandler: preHandler.auth }, async (_request: FastifyRequest, reply: FastifyReply) => {
        await config.connectionManager.waitUntilReady();
        const info = config.connectionManager.getConnectionInfo();

        if (!info) {
            return reply.code(503).send({ error: 'connection info unavailable' });
        }

        return reply.send({
            npub: info.npub,
            pubkey: info.pubkey,
            npubUri: info.npubUri,
            hexUri: info.hexUri,
            relays: info.relays,
            nostrRelays: config.nostrConfig.relays,
        });
    });

    fastify.get('/relays', { preHandler: preHandler.auth }, async (_request: FastifyRequest, reply: FastifyReply) => {
        const statuses = config.relayService.getStatus();
        const connected = config.relayService.getConnectedCount();

        const response: RelayStatusResponse = {
            connected,
            total: statuses.length,
            relays: statuses.map(s => ({
                url: s.url,
                connected: s.connected,
                lastConnected: s.lastConnected?.toISOString() ?? null,
                lastDisconnected: s.lastDisconnected?.toISOString() ?? null,
            })),
        };

        return reply.send(response);
    });

    /**
     * Force reset relay connections.
     * Use when WebSocket connections are silently dead (e.g., after fail2ban/iptables changes).
     * POST /connections/refresh
     */
    fastify.post('/connections/refresh', { preHandler: [...preHandler.auth, ...preHandler.csrf] }, async (_request: FastifyRequest, reply: FastifyReply) => {
        console.log('[API] Relay pool refresh requested');
        config.relayService.resetPool();
        return reply.send({ ok: true, message: 'Relay pool reset initiated' });
    });
}
