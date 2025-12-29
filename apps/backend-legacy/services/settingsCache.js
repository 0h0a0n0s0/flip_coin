// 档案: backend/services/settingsCache.js (★★★ v8.9 新档案 ★★★)
const db = require('@flipcoin/database');

let settingsCache = {};

async function loadSettings() {
    try {
        console.log("[v7 Settings] Loading system settings...");
        const result = await db.query('SELECT key, value FROM system_settings');
        settingsCache = result.rows.reduce((acc, row) => {
            acc[row.key] = { value: row.value };
            return acc;
        }, {});
        console.log(`[v7 Settings] Loaded ${Object.keys(settingsCache).length} settings.`);
    } catch (error) {
         console.error("[v7 Settings] CRITICAL: Failed to load system settings:", error);
         // (即使载入失败，也初始化为空对象)
         settingsCache = {};
    }
}

function getSettingsCache() {
    return settingsCache;
}

module.exports = {
    loadSettings,
    getSettingsCache
};