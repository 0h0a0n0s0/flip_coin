// routes/v1/user.js
// 用戶相關路由

const db = require('@flipcoin/database');
const { sendError, sendSuccess } = require('../../utils/safeResponse');
const userService = require('../../services/UserService');

/**
 * 用戶相關路由
 * @param {Router} router - Express router 實例
 * @param {Object} passport - Passport 實例
 */
function userRoutes(router, passport) {
    // GET /api/v1/me - 獲取當前用戶
    router.get('/api/v1/me', passport.authenticate('jwt', { session: false }), (req, res) => {
        return sendSuccess(res, req.user);
    });

    // PATCH /api/v1/users/nickname - 更新暱稱
    router.patch('/api/v1/users/nickname', passport.authenticate('jwt', { session: false }), async (req, res) => {
        const { nickname } = req.body;
        const userId = req.user.id; 

        if (!nickname || nickname.trim().length === 0) {
            return sendError(res, 400, '昵称不能为空。');
        }
        if (nickname.length > 50) {
            return sendError(res, 400, '昵称过长（最多 50 个字符）。');
        }

        try {
            const updatedUser = await userService.updateUserNickname(userId, nickname);
            delete updatedUser.password_hash;
            return sendSuccess(res, updatedUser);
        } catch (error) {
            console.error(`[v7 API] Error updating nickname for user ${userId}:`, error);
            return sendError(res, 500, '服务器内部错误。');
        }
    });

    // POST /api/v1/users/bind-referrer - 綁定推薦人
    router.post('/api/v1/users/bind-referrer', passport.authenticate('jwt', { session: false }), async (req, res) => {
        const { referrer_code } = req.body;
        const user = req.user; 

        if (!referrer_code || referrer_code.trim().length === 0) {
            return sendError(res, 400, '推荐码不能为空。');
        }
        
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            
            const userCheckResult = await client.query(
                'SELECT referrer_code, invite_code FROM users WHERE id = $1 FOR UPDATE', 
                [user.id]
            );
            const currentUserData = userCheckResult.rows[0];

            if (currentUserData.referrer_code) {
                await client.query('ROLLBACK');
                client.release();
                return sendError(res, 400, '账户已绑定推荐人。');
            }
            
            if (currentUserData.invite_code === referrer_code) {
                await client.query('ROLLBACK');
                client.release();
                return sendError(res, 400, '不能使用自己的邀请码作为推荐码。');
            }

            const referrerExists = await client.query('SELECT 1 FROM users WHERE invite_code = $1', [referrer_code]);
            if (referrerExists.rows.length === 0) {
                await client.query('ROLLBACK');
                client.release();
                return sendError(res, 400, '推荐码无效，找不到对应的用户。');
            }
            
            const updateResult = await client.query(
                'UPDATE users SET referrer_code = $1 WHERE id = $2 RETURNING *',
                [referrer_code, user.id]
            );
            
            await client.query('COMMIT');
            
            const updatedUser = updateResult.rows[0];
            delete updatedUser.password_hash;
            return sendSuccess(res, updatedUser);

        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`[v7 API] Error binding referrer for user ${user.id}:`, error);
            return sendError(res, 500, '服务器内部错误。');
        } finally {
            client.release();
        }
    });
}

module.exports = userRoutes;

