import os from 'os';
import fs from 'fs';
import QRCode from 'qrcode';

/**
 * Interface patterns to filter out (virtual/container interfaces)
 */
const VIRTUAL_INTERFACE_PATTERNS = [
    /^docker/,
    /^br-/,
    /^veth/,
    /^virbr/,
    /^vboxnet/,
    /^vmnet/,
    /^lo$/,
];

/**
 * Check if an interface name matches a virtual interface pattern
 */
function isVirtualInterface(name: string): boolean {
    return VIRTUAL_INTERFACE_PATTERNS.some(pattern => pattern.test(name));
}

/**
 * Check if we're running inside a Docker container
 */
function isRunningInContainer(): boolean {
    try {
        // Check for Docker
        if (fs.existsSync('/.dockerenv')) {
            return true;
        }
        // Check for Podman/other container runtimes
        if (fs.existsSync('/run/.containerenv')) {
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

export interface LocalAddress {
    address: string;
    interface: string;
}

/**
 * Get local network IPv4 addresses, filtering out loopback and virtual interfaces.
 * Returns addresses that are likely reachable from other devices on the network.
 */
export function getLocalAddresses(): LocalAddress[] {
    const interfaces = os.networkInterfaces();
    const addresses: LocalAddress[] = [];

    for (const [name, nets] of Object.entries(interfaces)) {
        if (!nets || isVirtualInterface(name)) {
            continue;
        }

        for (const net of nets) {
            // Skip internal (loopback) and non-IPv4
            if (net.internal || net.family !== 'IPv4') {
                continue;
            }

            addresses.push({
                address: net.address,
                interface: name,
            });
        }
    }

    return addresses;
}

/**
 * Print server startup information including local URLs and optionally a QR code.
 */
export async function printServerInfo(port: number): Promise<void> {
    console.log(`HTTP server listening on port ${port}`);

    // In containers, the container's IP isn't useful for external connections
    if (isRunningInContainer()) {
        console.log(`  → http://localhost:${port} (container)`);
        console.log('  To connect from Android, use your host machine\'s IP address');
        return;
    }

    const addresses = getLocalAddresses();

    if (addresses.length === 0) {
        console.log(`  → http://localhost:${port}`);
        return;
    }

    // Print all addresses
    for (const addr of addresses) {
        console.log(`  → http://${addr.address}:${port}`);
    }

    // If exactly one address, show QR code for easy mobile setup
    if (addresses.length === 1) {
        const url = `http://${addresses[0].address}:${port}`;
        try {
            const qr = await QRCode.toString(url, {
                type: 'terminal',
                small: true,
            });
            console.log('\nScan to connect from Android:');
            console.log(qr);
        } catch {
            // QR generation failed, not critical
        }
    }
}
