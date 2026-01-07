import readline from 'readline';
import { fork } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { loadConfig, saveConfig } from '../config/config.js';
import type { StoredKey } from '../config/types.js';
import { decryptSecret } from '../config/keyring.js';
import type { DaemonBootstrapConfig } from '../daemon/types.js';

export type StartOptions = {
    configPath: string;
    keyNames?: string[];
    verbose: boolean;
};

function ask(prompt: string, rl: readline.Interface): Promise<string> {
    return new Promise((resolve) => rl.question(prompt, resolve));
}

async function unlockKeyInteractively(name: string, entry: StoredKey, verbose: boolean): Promise<string | undefined> {
    if (entry.iv && entry.data) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        try {
            const passphrase = await ask(`Passphrase for ${name}: `, rl);
            const decrypted = decryptSecret({ iv: entry.iv, data: entry.data }, passphrase);
            if (verbose) {
                console.log(`Key "${name}" decrypted.`);
            }
            return decrypted;
        } catch (error) {
            console.error(`Unable to decrypt key "${name}": ${(error as Error).message}`);
            process.exit(1);
        } finally {
            rl.close();
        }
    }

    if (entry.key) {
        if (verbose) {
            console.log(`Using plain key material for "${name}".`);
        }
        return entry.key;
    }

    console.warn(`No stored data for key "${name}".`);
    return undefined;
}

function resolveDaemonEntry(cwd: string): string | undefined {
    const candidates = [
        resolve(cwd, 'dist/daemon/index.js'),
        resolve(cwd, 'src/daemon/index.ts'),
    ];

    for (const candidate of candidates) {
        if (existsSync(candidate)) {
            return candidate;
        }
    }

    return undefined;
}

export async function runStart(options: StartOptions): Promise<void> {
    const config = await loadConfig(options.configPath);

    if (options.verbose) {
        config.verbose = true;
    }

    await saveConfig(options.configPath, config);

    // Log kill switch status
    if (config.killSwitch) {
        console.log(`Kill switch enabled: listening for ${config.killSwitch.dmType} DMs from ${config.killSwitch.adminNpub}`);
        console.log(`Kill switch relays: ${config.killSwitch.adminRelays.join(', ')}`);
    }

    const keysToStart = options.keyNames ?? [];
    const activeKeys: Record<string, string> = {};

    for (const keyName of keysToStart) {
        const entry = config.keys[keyName];
        if (!entry) {
            console.log(`Key "${keyName}" not found in configuration.`);
            continue;
        }

        const unlocked = await unlockKeyInteractively(keyName, entry, config.verbose);
        if (unlocked) {
            activeKeys[keyName] = unlocked;
        }
    }

    const daemonEntry = resolveDaemonEntry(process.cwd());
    if (!daemonEntry) {
        console.error('Unable to locate daemon entry point. Run the build step first.');
        process.exit(1);
    }

    const daemon = fork(daemonEntry);
    const { keys: storedKeys, killSwitch, ...restConfig } = config;
    const payload: DaemonBootstrapConfig = {
        ...restConfig,
        keys: activeKeys,
        configFile: options.configPath,
        allKeys: { ...storedKeys },
        killSwitch,
    };

    daemon.send(payload);
}
