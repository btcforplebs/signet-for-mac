import prisma from '../../db.js';

/**
 * Repository for key-value settings stored in the database.
 * Used for runtime-configurable settings like Dead Man's Switch.
 */
export class SettingsRepository {
    /**
     * Get a setting value by key.
     * Returns null if the setting doesn't exist.
     */
    async get(key: string): Promise<string | null> {
        const setting = await prisma.setting.findUnique({
            where: { key },
        });
        return setting?.value ?? null;
    }

    /**
     * Set a setting value.
     * Creates the setting if it doesn't exist, updates if it does.
     */
    async set(key: string, value: string): Promise<void> {
        await prisma.setting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });
    }

    /**
     * Delete a setting by key.
     */
    async delete(key: string): Promise<void> {
        await prisma.setting.deleteMany({
            where: { key },
        });
    }

    /**
     * Get multiple settings by key prefix.
     * Useful for fetching all settings in a namespace (e.g., "deadManSwitch.*").
     */
    async getByPrefix(prefix: string): Promise<Record<string, string>> {
        const settings = await prisma.setting.findMany({
            where: {
                key: { startsWith: prefix },
            },
        });
        const result: Record<string, string> = {};
        for (const setting of settings) {
            result[setting.key] = setting.value;
        }
        return result;
    }

    /**
     * Delete all settings with a given prefix.
     */
    async deleteByPrefix(prefix: string): Promise<number> {
        const result = await prisma.setting.deleteMany({
            where: {
                key: { startsWith: prefix },
            },
        });
        return result.count;
    }
}

export const settingsRepository = new SettingsRepository();
