import { getLocalAddresses } from '../lib/network.js';
import { saveConfig } from '../../config/config.js';
import type { RuntimeConfig } from '../types.js';
import { logger } from '../lib/logger.js';

export interface RemoteAccessStatus {
    enabled: boolean;
    tailscaleIp: string | null;
    localIp: string | null;
    baseUrl: string;
    allowedOrigins: string[];
}

export class SystemService {
    private config: RuntimeConfig;
    private configPath: string;

    constructor(config: RuntimeConfig, configPath: string) {
        this.config = config;
        this.configPath = configPath;
    }

    /**
     * Get the current remote access status
     */
    getStatus(): RemoteAccessStatus {
        const addresses = getLocalAddresses();
        const tailscale = addresses.find(a => a.label === 'Tailscale')?.address || null;
        const local = addresses.find(a => a.label === 'Local')?.address || null;

        // Remote access is considered enabled if capacitor://localhost is in allowedOrigins
        const enabled = this.config.allowedOrigins?.includes('capacitor://localhost') || false;

        return {
            enabled,
            tailscaleIp: tailscale,
            localIp: local,
            baseUrl: this.config.baseUrl || '',
            allowedOrigins: this.config.allowedOrigins || [],
        };
    }

    /**
     * Enable or disable remote access
     */
    async setRemoteAccess(enable: boolean): Promise<RemoteAccessStatus> {
        const status = this.getStatus();
        const allowedOrigins = new Set(this.config.allowedOrigins || []);

        if (enable) {
            // Add mobile origin
            allowedOrigins.add('capacitor://localhost');

            // Add Tailscale IP if available
            if (status.tailscaleIp) {
                allowedOrigins.add(`http://${status.tailscaleIp}:3000`);
                allowedOrigins.add(`http://${status.tailscaleIp}:3001`);
                // Update baseUrl to use Tailscale if we are enabling remote access
                this.config.baseUrl = `http://${status.tailscaleIp}:4174`;
            } else if (status.localIp) {
                // Fallback to local IP if no Tailscale
                allowedOrigins.add(`http://${status.localIp}:3000`);
                allowedOrigins.add(`http://${status.localIp}:3001`);
                this.config.baseUrl = `http://${status.localIp}:4174`;
            }
        } else {
            // Remove mobile origin
            allowedOrigins.delete('capacitor://localhost');

            // We keep the IPs in origins as they don't hurt, 
            // but we reset baseUrl to localhost for security/consistency
            this.config.baseUrl = 'http://localhost:4174';
        }

        this.config.allowedOrigins = Array.from(allowedOrigins);

        try {
            await saveConfig(this.configPath, this.config as any);
            logger.info(`Remote access ${enable ? 'enabled' : 'disabled'}`);
        } catch (error) {
            logger.error('Failed to save config during remote access toggle', { error });
            throw error;
        }

        return this.getStatus();
    }
}

let systemService: SystemService | null = null;

export function initSystemService(config: RuntimeConfig, configPath: string): SystemService {
    systemService = new SystemService(config, configPath);
    return systemService;
}

export function getSystemService(): SystemService {
    if (!systemService) {
        throw new Error('SystemService not initialized');
    }
    return systemService;
}
