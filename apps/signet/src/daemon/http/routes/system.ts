import type { FastifyInstance } from 'fastify';
import { getSystemService } from '../../services/system-service.js';
import type { PreHandlerAuthCsrf } from '../types.js';

export function registerSystemRoutes(
    fastify: FastifyInstance,
    options: PreHandlerAuthCsrf
) {
    const systemService = getSystemService();

    // GET /system/remote-access
    fastify.get('/system/remote-access', { preHandler: options.auth }, async () => {
        return systemService.getStatus();
    });

    // POST /system/remote-access
    fastify.post('/system/remote-access', {
        preHandler: [...options.auth, ...options.csrf]
    }, async (request) => {
        const { enabled } = request.body as { enabled: boolean };
        return systemService.setRemoteAccess(enabled);
    });
}
