const db = require('@flipcoin/database');
const settingsCacheModule = require('./settingsCache');
let ioInstance = null;
let connectedUsersRef = null;

function setRiskControlSockets(io, connectedUsers) {
    ioInstance = io;
    connectedUsersRef = connectedUsers;
}

async function enforceSameIpRiskControl(clientIp) {
    const result = { triggered: false, affectedUsers: [] };
    if (!clientIp) return result;

    const settingsCache = settingsCacheModule.getSettingsCache();
    const thresholdRaw = settingsCache['MAX_SAME_IP_USERS']?.value;
    const threshold = parseInt(thresholdRaw, 10);
    if (!threshold || threshold <= 0) return result;

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `SELECT id, user_id FROM users WHERE last_login_ip = $1 AND status = 'active' FOR UPDATE`,
            [clientIp]
        );

        if (rows.length <= threshold) {
            await client.query('ROLLBACK');
            return result;
        }

        const dbIds = rows.map((row) => row.id);
        const affectedUserIds = rows.map((row) => row.user_id);

        if (dbIds.length > 0) {
            await client.query(`UPDATE users SET status = 'banned' WHERE id = ANY($1::int[])`, [dbIds]);
        }

        await client.query(
            `INSERT INTO risk_logs (ip_address, affected_user_ids, action_taken) VALUES ($1, $2::jsonb, $3)`,
            [clientIp, JSON.stringify(affectedUserIds), 'auto_ban']
        );

        await client.query('COMMIT');

        result.triggered = true;
        result.affectedUsers = affectedUserIds;

        if (ioInstance && connectedUsersRef) {
            affectedUserIds.forEach((userId) => {
                const socketId = connectedUsersRef[userId];
                if (socketId) {
                    ioInstance.to(socketId).emit('force_logout', { reason: '同IP风控封锁' });
                }
            });
        }
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[RiskControl] Failed to enforce same IP rule:', error);
    } finally {
        client.release();
    }

    return result;
}

async function getSameIpSummary() {
    const settingsCache = settingsCacheModule.getSettingsCache();
    const thresholdRaw = settingsCache['MAX_SAME_IP_USERS']?.value;
    const threshold = parseInt(thresholdRaw, 10);
    if (!threshold || threshold <= 0) {
        return { threshold: threshold || 0, list: [] };
    }

    const { rows } = await db.query(
        `
        SELECT 
            last_login_ip AS ip_address,
            COUNT(*) AS total_count,
            SUM(CASE WHEN status = 'banned' THEN 1 ELSE 0 END) AS banned_count,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_count,
            MAX(last_activity_at) AS last_activity_at
        FROM users
        WHERE last_login_ip IS NOT NULL
        GROUP BY last_login_ip
        HAVING COUNT(*) >= $1
        ORDER BY total_count DESC
        `,
        [threshold]
    );

    return { threshold, list: rows };
}

async function getUsersByIp(ipAddress) {
    const { rows } = await db.query(
        `
        SELECT id, user_id, username, nickname, status, last_login_ip, last_activity_at
        FROM users
        WHERE last_login_ip = $1
        ORDER BY last_activity_at DESC NULLS LAST
        `,
        [ipAddress]
    );
    return rows;
}

async function updateUsersStatusByIp(ipAddress, newStatus) {
    const client = await db.pool.connect();
    const action = newStatus === 'banned' ? 'manual_ban' : 'manual_unban';

    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `UPDATE users SET status = $1 WHERE last_login_ip = $2 RETURNING user_id`,
            [newStatus, ipAddress]
        );

        const affectedUserIds = rows.map((row) => row.user_id);

        if (affectedUserIds.length > 0) {
            await client.query(
                `INSERT INTO risk_logs (ip_address, affected_user_ids, action_taken) VALUES ($1, $2::jsonb, $3)`,
                [ipAddress, JSON.stringify(affectedUserIds), action]
            );
        }

        await client.query('COMMIT');

        if (newStatus === 'banned' && ioInstance && connectedUsersRef) {
            affectedUserIds.forEach((userId) => {
                const socketId = connectedUsersRef[userId];
                if (socketId) {
                    ioInstance.to(socketId).emit('force_logout', { reason: '管理員封鎖' });
                }
            });
        }

        return { affectedUserIds };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[RiskControl] Failed to update status by IP:', error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    setRiskControlSockets,
    enforceSameIpRiskControl,
    getSameIpSummary,
    getUsersByIp,
    updateUsersStatusByIp
};

