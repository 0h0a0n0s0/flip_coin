// 档案: backend/utils/ipUtils.js
// IP地址相关工具函数

const axios = require('axios');

/**
 * 检查IP是否为内部/私有IP
 * @param {string} ip - IP地址
 * @returns {boolean} 是否为内部IP
 */
function isInternalIp(ip) {
    if (!ip || ip === '') return true;
    
    // IPv4 私有地址范围
    if (ip.startsWith('192.168.') || 
        ip.startsWith('10.') || 
        ip.startsWith('172.16.') || 
        ip.startsWith('172.17.') || 
        ip.startsWith('172.18.') || 
        ip.startsWith('172.19.') || 
        ip.startsWith('172.20.') || 
        ip.startsWith('172.21.') || 
        ip.startsWith('172.22.') || 
        ip.startsWith('172.23.') || 
        ip.startsWith('172.24.') || 
        ip.startsWith('172.25.') || 
        ip.startsWith('172.26.') || 
        ip.startsWith('172.27.') || 
        ip.startsWith('172.28.') || 
        ip.startsWith('172.29.') || 
        ip.startsWith('172.30.') || 
        ip.startsWith('172.31.') ||
        ip === '127.0.0.1' || 
        ip === '::1' ||
        ip === 'localhost') {
        return true;
    }
    
    return false;
}

/**
 * 从请求中获取真实客户端IP地址
 * 优先级：CF-Connecting-IP > True-Client-IP > X-Forwarded-For (第一个非内部IP) > X-Real-IP > req.ip
 * 处理多层代理情况：X-Forwarded-For 格式为 client, proxy1, proxy2
 * @param {object} req - Express请求对象
 * @returns {string} 客户端IP地址
 */
function getClientIp(req) {
    // 检查所有可能的HTTP头（按优先级）
    const possibleHeaders = [
        'cf-connecting-ip',      // Cloudflare
        'true-client-ip',        // Cloudflare Enterprise / Akamai
        'x-forwarded-for',        // 标准代理头
        'x-real-ip',            // Nginx
        'x-client-ip',           // 一些代理使用
        'x-forwarded',           // 一些代理使用
        'forwarded-for',         // 一些代理使用
        'forwarded'              // RFC 7239
    ];
    
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    const reqIp = req.ip || req.connection?.remoteAddress;
    
    // 调试日志（显示所有相关头）
    const debugLog = process.env.DEBUG_IP === 'true';
    if (debugLog) {
        console.log(`[IP Utils Debug] All headers:`, 
            possibleHeaders.map(h => `${h}: ${req.headers[h] || 'N/A'}`).join(', '));
    }
    
    // 1. 优先检查 Cloudflare 和其他CDN的头
    for (const headerName of ['cf-connecting-ip', 'true-client-ip']) {
        const headerValue = req.headers[headerName];
        if (headerValue && !isInternalIp(headerValue)) {
            if (debugLog) {
                console.log(`[IP Utils Debug] Selected IP from ${headerName}: ${headerValue}`);
            }
            return headerValue.trim();
        }
    }
    
    // 2. 处理 X-Forwarded-For（可能包含多个IP，格式：client, proxy1, proxy2）
    if (forwardedFor) {
        const ips = forwardedFor.split(',').map(ip => ip.trim()).filter(ip => ip);
        
        // 从前往后找第一个非内部IP（最左边的通常是真实客户端IP）
        for (const ip of ips) {
            if (!isInternalIp(ip)) {
                if (debugLog) {
                    console.log(`[IP Utils Debug] Selected IP from X-Forwarded-For: ${ip}`);
                }
                return ip;
            }
        }
        
        // 如果都是内部IP，尝试从后往前找（可能是多层代理的情况）
        for (let i = ips.length - 1; i >= 0; i--) {
            const ip = ips[i];
            if (!isInternalIp(ip)) {
                if (debugLog) {
                    console.log(`[IP Utils Debug] Selected IP from X-Forwarded-For (reverse): ${ip}`);
                }
                return ip;
            }
        }
        
        // 如果都是内部IP，至少返回第一个（用于调试）
        if (ips.length > 0) {
            if (debugLog) {
                console.log(`[IP Utils Debug] All IPs in X-Forwarded-For are internal, returning first: ${ips[0]}`);
            }
            return ips[0];
        }
    }
    
    // 3. 使用 X-Real-IP（Nginx 设置），但过滤掉内部 IP
    if (realIp && !isInternalIp(realIp)) {
        if (debugLog) {
            console.log(`[IP Utils Debug] Selected IP from X-Real-IP: ${realIp}`);
        }
        return realIp;
    }
    
    // 4. 检查其他可能的头
    for (const headerName of ['x-client-ip', 'x-forwarded', 'forwarded-for']) {
        const headerValue = req.headers[headerName];
        if (headerValue && !isInternalIp(headerValue)) {
            if (debugLog) {
                console.log(`[IP Utils Debug] Selected IP from ${headerName}: ${headerValue}`);
            }
            return headerValue.trim();
        }
    }
    
    // 5. 最后使用 req.ip（Express 的 trust proxy 设置后）
    if (reqIp && !isInternalIp(reqIp)) {
        if (debugLog) {
            console.log(`[IP Utils Debug] Selected IP from req.ip: ${reqIp}`);
        }
        return reqIp;
    }
    
    // 6. 如果都是内部IP，返回第一个可用的（用于调试）
    const fallback = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || reqIp || 'unknown');
    if (debugLog) {
        console.log(`[IP Utils Debug] Fallback IP: ${fallback}`);
    }
    return fallback;
}

/**
 * 从请求中获取所有可能的客户端IP地址（包括代理链中的所有IP）
 * 用于白名单检查，如果任何一个IP在白名单内，就允许访问
 * @param {object} req - Express请求对象
 * @returns {string[]} 所有可能的客户端IP地址数组
 */
function getAllClientIps(req) {
    const ips = [];
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    const reqIp = req.ip || req.connection?.remoteAddress;
    
    // 1. 从 X-Forwarded-For 中提取所有IP
    if (forwardedFor) {
        const forwardedIps = forwardedFor.split(',').map(ip => ip.trim()).filter(ip => ip);
        ips.push(...forwardedIps);
    }
    
    // 2. 添加 X-Real-IP（如果存在且不在列表中）
    if (realIp && !ips.includes(realIp)) {
        ips.push(realIp);
    }
    
    // 3. 添加 req.ip（如果存在且不在列表中）
    if (reqIp && !ips.includes(reqIp)) {
        ips.push(reqIp);
    }
    
    // 过滤掉内部IP，只返回公网IP
    return ips.filter(ip => !isInternalIp(ip));
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
    getAllClientIps,
    getCountryFromIp,
    extractDeviceId
};
