// routes/admin/settings.js
// 系統設定相關路由

const db = require('@flipcoin/database');
const authMiddleware = require('../../middleware/auth');
const checkPermission = require('../../middleware/checkPermissionMiddleware');
const settingsCacheModule = require('../../services/settingsCache');
const { recordAuditLog } = require('../../services/auditLogService');
const { getClientIp } = require('../../utils/ipUtils');
const { sendError, sendSuccess } = require('../../utils/safeResponse');

/**
 * 系統設定相關路由
 * @param {Router} router - Express router 實例
 */
function settingsRoutes(router) {

    router.get('/settings', authMiddleware, checkPermission('settings_game', 'read'), async (req, res) => {
        try {
            const result = await db.query('SELECT key, value, description, category FROM system_settings');
            const settingsByCategory = result.rows.reduce((acc, row) => {
                if (!acc[row.category]) {
                    acc[row.category] = {};
                }
                acc[row.category][row.key] = { 
                    value: row.value, 
                    description: row.description 
                };
                return acc;
            }, {});

            sendSuccess(res, settingsByCategory);
        } catch (error) {
            console.error('[Admin Settings] Error fetching settings:', error);
            sendError(res, 500, 'Internal server error');
        }
    });
    router.put('/settings/:key', authMiddleware, checkPermission('settings_game', 'update'), async (req, res) => {
        const { key } = req.params;
        const { value } = req.body;
        if (value === undefined || value === null) { return sendError(res, 400, 'Value is required.'); }

        let validatedValue = value.toString(); // 预设
        // (验证) - 注意：PAYOUT_MULTIPLIER 已遷移到遊戲管理，此驗證保留以防直接調用 API
        if (key === 'PAYOUT_MULTIPLIER') {
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue <= 0) { return sendError(res, 400, 'PAYOUT_MULTIPLIER must be a positive number.'); }
        }
        // 验证 AUTO_WITHDRAW_THRESHOLD
        if (key === 'AUTO_WITHDRAW_THRESHOLD') {
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue < 0) { return sendError(res, 400, 'AUTO_WITHDRAW_THRESHOLD 必须是有效的数字 (例如 10)'); }
            validatedValue = numValue.toString();
        }
        // 验证链开关
        if (key.startsWith('ALLOW_')) {
            if (value.toString() !== 'true' && value.toString() !== 'false') {
                return sendError(res, 400, 'Value must be true or false string.');
            }
            validatedValue = value.toString();
        }
        // 验证平台名称
        if (key === 'PLATFORM_NAME') {
            const name = value.toString().trim();
            if (!name || name.length === 0) {
                return sendError(res, 400, '平台名称不能为空');
            }
            if (name.length > 50) {
                return sendError(res, 400, '平台名称不能超过50个字符');
            }
            validatedValue = name;
        }
        // 验证多语系设置
        if (key === 'DEFAULT_LANGUAGE') {
            const lang = value.toString().trim();
            if (lang !== 'zh-CN' && lang !== 'en-US') {
                return sendError(res, 400, '默认语言必须是 zh-CN 或 en-US');
            }
            validatedValue = lang;
        }
        if (key === 'SUPPORTED_LANGUAGES') {
            // 验证是否为有效的 JSON 数组
            try {
                const langs = JSON.parse(value.toString());
                if (!Array.isArray(langs)) {
                    return sendError(res, 400, '支持的语言必须是数组格式');
                }
                // 验证数组中的语言代码
                const validLangs = ['zh-CN', 'en-US'];
                for (const lang of langs) {
                    if (!validLangs.includes(lang)) {
                        return sendError(res, 400, `不支持的语言代码: ${lang}`);
                    }
                }
                validatedValue = value.toString(); // 保持 JSON 字符串格式
            } catch (e) {
                return sendError(res, 400, '支持的语言必须是有效的 JSON 数组格式');
            }
        }

        try {
            // 先尝试更新
            let result = await db.query(
                'UPDATE system_settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING key, value',
                [validatedValue, key]
            );

            // 如果设置不存在，尝试创建（仅对 I18n 分类的设置）
            if (result.rows.length === 0) {
                // 检查是否为 I18n 分类的设置
                if (key === 'DEFAULT_LANGUAGE' || key === 'SUPPORTED_LANGUAGES') {
                    const description = key === 'DEFAULT_LANGUAGE' 
                        ? '系统默认语言，可选值：zh-CN（简体中文）或 en-US（英文）'
                        : '系统支持的语言列表，JSON 数组格式，可选值：zh-CN（简体中文）、en-US（英文）';

                    result = await db.query(
                        `INSERT INTO system_settings (key, value, description, category, created_at, updated_at)
                         VALUES ($1, $2, $3, 'I18n', NOW(), NOW())
                         RETURNING key, value`,
                        [key, validatedValue, description]
                    );
                    console.log(`[Admin Settings] Created new I18n setting '${key}' with value '${validatedValue}'`);
                } else {
                    return sendError(res, 404, `Setting key '${key}' not found.`);
                }
            }
            // (★★★ 触发快取更新 ★★★)
            await settingsCacheModule.loadSettings();
            console.log(`[Admin Settings] Setting '${key}' updated to '${value}' by ${req.user.username}`);

            await recordAuditLog({
                adminId: req.user.id,
                adminUsername: req.user.username,
                action: 'update_setting',
                resource: 'system_settings',
                resourceId: key,
                description: `更新系统设定 ${key} -> ${validatedValue}`,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            });

            sendSuccess(res, result.rows[0]);
        } catch (error) {
            console.error(`[Admin Settings] Error updating setting '${key}':`, error);
            sendError(res, 500, 'Internal server error');
        }
    });

    // ★★★ 系统设定 - 多语系 (i18n) API ★★★
    /**
     * @description 获取指定语言的翻译文件
     * @route GET /api/admin/i18n/:lang
     * @access Private
     */
    router.get('/i18n/:lang', authMiddleware, checkPermission('settings_game', 'read'), async (req, res) => {
        try {
            const { lang } = req.params
            const validLangs = ['en', 'zh-CN', 'zh-TW']

            if (!validLangs.includes(lang)) {
                return sendError(res, 400, `Invalid language code. Supported: ${validLangs.join(', ')}`);
            }

            // 读取前台语言文件
            const fs = require('fs')
            const path = require('path')
            // 在 Docker 容器中，frontend-vue3/src/locales 被挂载到 /usr/src/app/frontend-vue3/src/locales
            // __dirname 是 /usr/src/app/routes，所以路径是 ../frontend-vue3/src/locales
            const localeFile = path.join(__dirname, '../frontend-vue3/src/locales', `${lang}.json`)

            console.log(`[Admin I18n] Loading language file: ${localeFile}`)
            console.log(`[Admin I18n] File exists: ${fs.existsSync(localeFile)}`)

            if (!fs.existsSync(localeFile)) {
                // 如果文件不存在，返回空对象
                console.log(`[Admin I18n] File not found: ${localeFile}`)
                return sendSuccess(res, {})
            }

            const content = fs.readFileSync(localeFile, 'utf-8')
            const translations = JSON.parse(content)

            console.log(`[Admin I18n] Loaded ${Object.keys(translations).length} top-level keys for ${lang}`)

            sendSuccess(res, translations)
        } catch (error) {
            console.error('[Admin I18n] Error fetching language file:', error)
            return sendError(res, 500, 'Internal server error');
        }
    })

    /**
     * @description 更新指定语言的翻译文件
     * @route POST /api/admin/i18n/:lang
     * @access Private
     */
    router.post('/i18n/:lang', authMiddleware, checkPermission('settings_game', 'update'), async (req, res) => {
        try {
            const { lang } = req.params
            const { data } = req.body
            const validLangs = ['en', 'zh-CN', 'zh-TW']

            if (!validLangs.includes(lang)) {
                return sendError(res, 400, `Invalid language code. Supported: ${validLangs.join(', ')}`);
            }

            if (!data || typeof data !== 'object') {
                return sendError(res, 400, 'Invalid data format. Expected JSON object.');
            }

            // 写入前台语言文件
            const fs = require('fs')
            const path = require('path')
            // 在 Docker 容器中，frontend-vue3/src/locales 被挂载到 /usr/src/app/frontend-vue3/src/locales
            // __dirname 是 /usr/src/app/routes，所以路径是 ../frontend-vue3/src/locales
            const localeDir = path.join(__dirname, '../frontend-vue3/src/locales')
            const localeFile = path.join(localeDir, `${lang}.json`)

            console.log(`[Admin I18n] Saving language file: ${localeFile}`)

            // 确保目录存在
            if (!fs.existsSync(localeDir)) {
                fs.mkdirSync(localeDir, { recursive: true })
            }

            // 排序并写入文件
            const sortedData = sortObject(data)
            fs.writeFileSync(
                localeFile,
                JSON.stringify(sortedData, null, 2) + '\n',
                'utf-8'
            )

            console.log(`[Admin I18n] Language file '${lang}.json' updated by ${req.user.username}`)

            await recordAuditLog({
                adminId: req.user.id,
                adminUsername: req.user.username,
                action: 'update_i18n',
                resource: 'i18n',
                resourceId: lang,
                description: `更新多语系文件 ${lang}.json`,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            })

            sendSuccess(res, { message: 'Language file updated successfully' })
        } catch (error) {
            console.error(`[Admin I18n] Error updating language file '${req.params.lang}':`, error)
            return sendError(res, 500, 'Internal server error');
        }
    })

    /**
     * 递归排序对象
     */
    function sortObject(obj) {
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            return obj
        }

        const sorted = {}
        const keys = Object.keys(obj).sort()

        for (const key of keys) {
            sorted[key] = sortObject(obj[key])
        }

        return sorted
    }

    // ★★★ 系统设定 - 阻挡地区 API ★★★
    /**
     * @description 获取阻挡地区列表 (不分页，一次全取)
     * @route GET /api/admin/blocked-regions
     * @access Private
     */
    router.get('/blocked-regions', authMiddleware, checkPermission('settings_regions', 'read'), async (req, res) => {
        try {
            // (通常阻挡列表不会非常大，先不加分页)
            const result = await db.query('SELECT id, ip_range::text, description, created_at FROM blocked_regions ORDER BY created_at DESC');
            // (将 CIDR 转为 text 方便前端显示)
            sendSuccess(res, result.rows);
        } catch (error) {
            console.error('[Admin BlockedRegions] Error fetching regions:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 新增阻挡地区
     * @route POST /api/admin/blocked-regions
     * @access Private
     * @body { ip_range: string, description?: string }
     */
    router.post('/blocked-regions', authMiddleware, checkPermission('settings_regions', 'cud'), async (req, res) => {
        const { ip_range, description } = req.body;
        if (!ip_range) {
            return sendError(res, 400, 'IP range (CIDR format) is required.');
        }
        // (未来可加强验证 ip_range 格式)

        try {
            const result = await db.query(
                'INSERT INTO blocked_regions (ip_range, description) VALUES ($1, $2) RETURNING id, ip_range::text, description, created_at',
                [ip_range, description || null] // description 可为空
            );
            console.log(`[Admin BlockedRegions] Region ${result.rows[0].ip_range} added by ${req.user.username}`);
            sendSuccess(res, result.rows[0], 201);
        } catch (error) {
            if (error.code === '23505') { // unique_violation
                 return sendError(res, 409, 'IP range already exists.');
            }
             // (处理可能的 CIDR 格式错误)
            if (error.code === '22P02') { // invalid_text_representation (通常是 CIDR 格式错误)
                 return sendError(res, 400, 'Invalid IP range format. Please use CIDR notation (e.g., 1.2.3.4/32 or 1.2.3.0/24).');
            }
            console.error('[Admin BlockedRegions] Error adding region:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 刪除阻挡地区
     * @route DELETE /api/admin/blocked-regions/:id
     * @access Private
     */
    router.delete('/blocked-regions/:id', authMiddleware, checkPermission('settings_regions', 'cud'), async (req, res) => {
        const { id } = req.params;
        try {
            const result = await db.query('DELETE FROM blocked_regions WHERE id = $1 RETURNING id', [id]);
            if (result.rows.length === 0) {
                return sendError(res, 404, 'Blocked region not found.');
            }
            console.log(`[Admin BlockedRegions] Region ID ${id} deleted by ${req.user.username}`);
            res.status(204).send(); // No Content
        } catch (error) {
            console.error(`[Admin BlockedRegions] Error deleting region ${id}:`, error);
            sendError(res, 500, 'Internal server error');
        }
    });

    // ★★★ 系统设定 - 用户等级 CRUD API ★★★
    /**
     * @description 获取所有用户等级设定
     * @route GET /api/admin/user-levels
     * @access Private
     */
    router.get('/user-levels', authMiddleware, checkPermission('settings_levels', 'read'), async (req, res) => {
        try {
            // 按等级排序
            const result = await db.query('SELECT * FROM user_levels ORDER BY level ASC');
            sendSuccess(res, result.rows);
        } catch (error) {
            console.error('[Admin UserLevels] Error fetching levels:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 新增用户等级设定
     * @route POST /api/admin/user-levels
     * @access Private
     * @body { level, name, max_bet_amount, required_bets_for_upgrade, required_total_bet_amount, min_bet_amount_for_upgrade, upgrade_reward_amount }
     */
    router.post('/user-levels', authMiddleware, checkPermission('settings_levels', 'cud'), async (req, res) => {
        const { level, name, max_bet_amount, required_bets_for_upgrade, required_total_bet_amount, min_bet_amount_for_upgrade, upgrade_reward_amount } = req.body;
        // (简单验证)
        if (!level || level <= 0 || !max_bet_amount || max_bet_amount < 0 || required_bets_for_upgrade < 0 || (required_total_bet_amount !== undefined && required_total_bet_amount < 0) || min_bet_amount_for_upgrade < 0 || upgrade_reward_amount < 0) {
            return sendError(res, 400, 'Invalid input data.');
        }

        // Level 1 的升级条件必须为 0
        if (level === 1 && (required_bets_for_upgrade > 0 || (required_total_bet_amount !== undefined && required_total_bet_amount > 0))) {
            return sendError(res, 400, 'Level 1 cannot have upgrade requirements.');
        }

        try {
            const result = await db.query(
                `INSERT INTO user_levels (level, name, max_bet_amount, required_bets_for_upgrade, required_total_bet_amount, min_bet_amount_for_upgrade, upgrade_reward_amount, updated_at) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
                 RETURNING *`,
                [level, name || `Level ${level}`, max_bet_amount, required_bets_for_upgrade, required_total_bet_amount || 0, min_bet_amount_for_upgrade, upgrade_reward_amount]
            );
            console.log(`[Admin UserLevels] Level ${level} created by ${req.user.username}`);
            sendSuccess(res, result.rows[0], 201);
        } catch (error) {
            if (error.code === '23505') { // unique_violation (level 已存在)
                 return sendError(res, 409, `Level ${level} already exists.`);
            }
            console.error('[Admin UserLevels] Error creating level:', error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 更新用户等级设定
     * @route PUT /api/admin/user-levels/:level
     * @access Private
     * @body { name, max_bet_amount, required_bets_for_upgrade, required_total_bet_amount, min_bet_amount_for_upgrade, upgrade_reward_amount }
     */
    router.put('/user-levels/:level', authMiddleware, checkPermission('settings_levels', 'cud'), async (req, res) => {
        const level = parseInt(req.params.level, 10);
        const { name, max_bet_amount, required_bets_for_upgrade, required_total_bet_amount, min_bet_amount_for_upgrade, upgrade_reward_amount } = req.body;
        if (isNaN(level) || level <= 0 || !max_bet_amount || max_bet_amount < 0 || required_bets_for_upgrade < 0 || (required_total_bet_amount !== undefined && required_total_bet_amount < 0) || min_bet_amount_for_upgrade < 0 || upgrade_reward_amount < 0) {
             return sendError(res, 400, 'Invalid input data.');
        }

        // Level 1 的升级条件必须为 0
        if (level === 1 && (required_bets_for_upgrade > 0 || (required_total_bet_amount !== undefined && required_total_bet_amount > 0))) {
            return sendError(res, 400, 'Level 1 cannot have upgrade requirements.');
        }

        try {
            const result = await db.query(
                `UPDATE user_levels 
                 SET name = $1, max_bet_amount = $2, required_bets_for_upgrade = $3, required_total_bet_amount = $4, min_bet_amount_for_upgrade = $5, upgrade_reward_amount = $6, updated_at = NOW() 
                 WHERE level = $7 
                 RETURNING *`,
                [name || `Level ${level}`, max_bet_amount, required_bets_for_upgrade, required_total_bet_amount !== undefined ? required_total_bet_amount : 0, min_bet_amount_for_upgrade, upgrade_reward_amount, level]
            );
            if (result.rows.length === 0) {
                return sendError(res, 404, `Level ${level} not found.`);
            }
            console.log(`[Admin UserLevels] Level ${level} updated by ${req.user.username}`);
            sendSuccess(res, result.rows[0]);
        } catch (error) {
            console.error(`[Admin UserLevels] Error updating level ${level}:`, error);
            sendError(res, 500, 'Internal server error');
        }
    });

    /**
     * @description 刪除用户等级设定
     * @route DELETE /api/admin/user-levels/:level
     * @access Private
     */
    router.delete('/user-levels/:level', authMiddleware, checkPermission('settings_levels', 'cud'), async (req, res) => {
        const level = parseInt(req.params.level, 10);
         if (isNaN(level) || level <= 0) {
            return sendError(res, 400, 'Invalid level.');
        }
        // (安全机制：通常不允许刪除 Level 1)
        if (level === 1) {
            return sendError(res, 400, 'Cannot delete Level 1.');
        }
        // (未来可扩充：检查是否有用户正在此等级，若有則阻止刪除)

        try {
            const result = await db.query('DELETE FROM user_levels WHERE level = $1 RETURNING level', [level]);
            if (result.rows.length === 0) {
                return sendError(res, 404, `Level ${level} not found.`);
            }
            console.log(`[Admin UserLevels] Level ${level} deleted by ${req.user.username}`);
            res.status(204).send(); // No Content
        } catch (error) {
            console.error(`[Admin UserLevels] Error deleting level ${level}:`, error);
            sendError(res, 500, 'Internal server error');
        }
    });

}

module.exports = settingsRoutes;
