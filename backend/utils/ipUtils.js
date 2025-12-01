// 档案: backend/utils/ipUtils.js
// IP地址相关工具函数

const axios = require('axios');

/**
 * 从请求中获取真实客户端IP地址
 * 优先级：X-Forwarded-For (第一个IP) > X-Real-IP > req.ip
 * @param {object} req - Express请求对象
 * @returns {string} 客户端IP地址
 */
function getClientIp(req) {
    // 1. 优先使用 X-Forwarded-For（可能包含多个IP，取第一个）
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
        // X-Forwarded-For 格式：client, proxy1, proxy2
        // 取第一个IP（真实客户端IP）
        const firstIp = forwardedFor.split(',')[0].trim();
        // 过滤掉 Docker 内部 IP 和本地 IP
        if (firstIp && firstIp !== '' && 
            !firstIp.startsWith('192.168.65.') && 
            !firstIp.startsWith('172.17.') && 
            !firstIp.startsWith('172.18.') &&
            firstIp !== '127.0.0.1' && 
            firstIp !== '::1') {
            return firstIp;
        }
    }
    
    // 2. 使用 X-Real-IP（Nginx 设置），但过滤掉 Docker 内部 IP
    const realIp = req.headers['x-real-ip'];
    if (realIp && realIp !== '' && 
        !realIp.startsWith('192.168.65.') && 
        !realIp.startsWith('172.17.') && 
        !realIp.startsWith('172.18.') &&
        realIp !== '127.0.0.1' && 
        realIp !== '::1') {
        return realIp;
    }
    
    // 3. 如果 X-Forwarded-For 存在但都是内部 IP，尝试取最后一个（可能是真实 IP）
    if (forwardedFor) {
        const ips = forwardedFor.split(',').map(ip => ip.trim()).filter(ip => ip);
        // 从后往前找，跳过 Docker 内部 IP
        for (let i = ips.length - 1; i >= 0; i--) {
            const ip = ips[i];
            if (ip && 
                !ip.startsWith('192.168.65.') && 
                !ip.startsWith('172.17.') && 
                !ip.startsWith('172.18.') &&
                ip !== '127.0.0.1' && 
                ip !== '::1') {
                return ip;
            }
        }
    }
    
    // 4. 最后使用 req.ip（Express 的 trust proxy 设置后）
    const reqIp = req.ip || req.connection?.remoteAddress;
    if (reqIp && 
        !reqIp.startsWith('192.168.65.') && 
        !reqIp.startsWith('172.17.') && 
        !reqIp.startsWith('172.18.') &&
        reqIp !== '127.0.0.1' && 
        reqIp !== '::1') {
        return reqIp;
    }
    
    // 5. 如果都是内部 IP，返回第一个可用的（用于调试）
    return forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || reqIp || 'unknown');
}

/**
 * 从IP地址获取国家信息
 * @param {string} ip - IP地址
 * @returns {Promise<string|null>} 国家名称，失败返回null
 */
async function getCountryFromIp(ip) {
    // 跳过本地IP
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
        return null;
    }

    try {
        // 使用免费API获取IP地理位置信息
        // 可以替换为其他服务，如ip-api.com、ipinfo.io等
        const response = await axios.get(`http://ip-api.com/json/${ip}?fields=country`, {
            timeout: 3000
        });
        
        if (response.data && response.data.country) {
            return response.data.country;
        }
    } catch (error) {
        // 静默失败，不阻塞主流程
        console.warn(`[IP Utils] Failed to get country for IP ${ip}:`, error.message);
    }
    
    return null;
}

/**
 * 从请求中提取设备ID（从User-Agent生成一个简单的设备标识）
 * @param {object} req - Express请求对象
 * @returns {string|null} 设备ID
 */
function extractDeviceId(req) {
    const userAgent = req.headers['user-agent'] || '';
    const fingerprint = req.headers['x-device-fingerprint'] || ''; // 如果前端发送了设备指纹
    
    if (fingerprint) {
        return fingerprint;
    }
    
    // 如果没有设备指纹，从User-Agent生成一个简单的标识
    // 注意：这不是真正的设备ID，只是用于演示
    if (userAgent) {
        // 提取关键信息：浏览器+操作系统
        const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/([\d.]+)/);
        const osMatch = userAgent.match(/(Windows|Mac|Linux|Android|iOS)/);
        
        if (browserMatch || osMatch) {
            const browser = browserMatch ? browserMatch[1] : 'Unknown';
            const os = osMatch ? osMatch[1] : 'Unknown';
            // 这里只是示例，实际应该使用更可靠的设备指纹库
            return `${os}-${browser}`;
        }
    }
    
    return null;
}

module.exports = {
    getClientIp,
    getCountryFromIp,
    extractDeviceId
};

