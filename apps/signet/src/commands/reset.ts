import readline from 'readline';
import fs from 'fs';
import { dirname, join, isAbsolute, resolve } from 'path';
import { loadConfig } from '../config/config.js';
import { spawnSync } from 'child_process';

type ResetOptions = {
    configPath: string;
    force?: boolean;
    all?: boolean;
};

function ask(prompt: string, rl: readline.Interface): Promise<string> {
    return new Promise((resolve) => rl.question(prompt, resolve));
}

export async function resetApp(options: ResetOptions): Promise<void> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    try {
        if (!options.force) {
            const answer = await ask('Are you sure you want to factory reset Signet? This will delete all keys, ACLs, and logs. [y/N]: ', rl);
            if (answer.toLowerCase() !== 'y') {
                console.log('Reset cancelled.');
                return;
            }
        }

        const configDir = dirname(options.configPath);

        let databasePath: string | undefined;
        let logPath: string | undefined;

        // Try to load existing config to find paths
        if (fs.existsSync(options.configPath)) {
            try {
                const config = await loadConfig(options.configPath);

                // Resolve database path
                if (config.database) {
                    let db = config.database;
                    if (db.startsWith('sqlite://')) {
                        db = db.slice(9);
                    }
                    databasePath = isAbsolute(db) ? db : join(configDir, db);
                }

                // Resolve log path
                if (config.logs) {
                    logPath = isAbsolute(config.logs) ? config.logs : join(configDir, config.logs);
                }
            } catch (err) {
                console.warn('Unable to parse existing config, will attempt to find default files.');
            }
        }

        // Potential files to delete
        const filesToDelete = new Set<string>();
        filesToDelete.add(options.configPath);

        if (databasePath) filesToDelete.add(databasePath);
        if (logPath) filesToDelete.add(logPath);

        // Add default paths just in case
        filesToDelete.add(join(configDir, 'signet.db'));
        filesToDelete.add(join(configDir, 'signet.log'));
        filesToDelete.add(join(configDir, 'connection.txt'));

        console.log('\nResetting Signet environment...');

        for (const filePath of filesToDelete) {
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`- Deleted: ${filePath}`);
                } catch (err) {
                    console.error(`- Failed to delete ${filePath}: ${(err as Error).message}`);
                }
            }
        }

        if (options.all) {
            // Delete the whole config directory if empty
            try {
                const files = fs.readdirSync(configDir);
                if (files.length === 0) {
                    fs.rmdirSync(configDir);
                    console.log(`- Deleted empty directory: ${configDir}`);
                } else {
                    console.log(`- Config directory not empty, skipping: ${configDir}`);
                }
            } catch (err) {
                // Ignore errors here
            }
        } else {
            // Re-initialize the database schema so the next boot doesn't fail
            console.log('\nRe-initializing database schema...');
            const appDir = resolve(__dirname, '..', '..'); // From dist/commands/ to apps/signet/
            const prisma = join(appDir, 'node_modules', '.bin', 'prisma');

            if (fs.existsSync(prisma)) {
                const result = spawnSync(prisma, ['migrate', 'deploy'], {
                    stdio: 'inherit',
                    cwd: appDir,
                });

                if (result.status === 0) {
                    console.log('✅ Database schema initialized successfully.');
                } else {
                    console.error('❌ Failed to initialize database schema.');
                }
            } else {
                console.warn('⚠️ Prisma binary not found, skipping schema initialization.');
            }
        }

        console.log('\nFactory reset complete. Signet will start fresh on next boot.');

    } finally {
        rl.close();
    }
}
