// 档案: admin-ui/src/utils/request.js

import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';

// 建立 Axios 實例
// 根據環境決定 baseURL
// 開發環境：使用相對路徑，依賴 vue.config.js 的代理配置
// 生產環境：使用相對路徑，依賴 Nginx 代理
const service = axios.create({
    baseURL: process.env.NODE_ENV === 'development' 
        ? (process.env.VUE_APP_API_BASE_URL || '/') 
        : '/',
    timeout: 10000, 
});

// 缓存 IP
let cachedRealIp = null;
let ipFetchPromise = null; // 用於追蹤正在進行的 IP 獲取

// 定义多个 IP 查询源 (Failover)
const IP_SERVICES = [
    { url: 'https://api.ipify.org?format=json', key: 'ip' },
    { url: 'https://api.seeip.org/jsonip', key: 'ip' },
    { url: 'https://api.my-ip.io/ip.json', key: 'ip' },
    { url: 'https://ipapi.co/json/', key: 'ip' }
];

// 初始化：檢查 sessionStorage 中的緩存
const sessionIp = sessionStorage.getItem('cached_real_ip');
if (sessionIp) {
    cachedRealIp = sessionIp;
    console.log('[Frontend] Using cached IP from sessionStorage:', sessionIp);
}

// (强力版) 获取真实 IP
async function getClientIp() {
    // 如果已有緩存的 IP，直接返回
    if (cachedRealIp) {
        console.log('[Frontend] Using cached IP:', cachedRealIp);
        return cachedRealIp;
    }

    // 如果正在獲取 IP，等待該 Promise 完成
    if (ipFetchPromise) {
        console.log('[Frontend] IP fetch in progress, waiting...');
        return await ipFetchPromise;
    }

    // 開始獲取 IP
    ipFetchPromise = (async () => {
        console.log('[Frontend] Auto-detecting IP...');

        // 先检查 sessionStorage（可能之前已经获取过）
        const sessionIp = sessionStorage.getItem('cached_real_ip');
        if (sessionIp) {
            console.log('[Frontend] Found IP in sessionStorage:', sessionIp);
            cachedRealIp = sessionIp;
            ipFetchPromise = null;
            return sessionIp;
        }

        // 尝试每个IP服务（增加超时时间到8秒，提高成功率）
        const IP_FETCH_TIMEOUT = 8000; // 8秒超时
        let lastError = null;

        for (const service of IP_SERVICES) {
            try {
                console.log(`[Frontend] Trying IP service: ${service.url}`);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), IP_FETCH_TIMEOUT);

                const response = await fetch(service.url, { 
                    signal: controller.signal,
                    mode: 'cors',
                    cache: 'no-cache',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    console.log(`[Frontend] Response from ${service.url}:`, data);
                    const ip = data[service.key];
                    
                    // 验证IP格式
                    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
                    if (ip && typeof ip === 'string' && ipRegex.test(ip)) {
                        console.log(`[Frontend] ✅ Detected IP via ${service.url}: ${ip}`);
                        cachedRealIp = ip;
                        // 缓存到 Session Storage 避免刷新丢失
                        sessionStorage.setItem('cached_real_ip', ip);
                        ipFetchPromise = null; // 清除 Promise 引用
                        return ip;
                    } else {
                        console.warn(`[Frontend] Invalid IP format from ${service.url}:`, ip);
                        lastError = new Error(`Invalid IP format: ${ip}`);
                    }
                } else {
                    const errorMsg = `HTTP ${response.status} ${response.statusText}`;
                    console.warn(`[Frontend] HTTP error from ${service.url}: ${errorMsg}`);
                    lastError = new Error(errorMsg);
                }
            } catch (e) {
                const errorName = e.name || 'UnknownError';
                const errorMsg = e.message || 'Unknown error';
                console.warn(`[Frontend] ❌ Source failed: ${service.url}`, errorName, errorMsg);
                
                if (e.name === 'AbortError') {
                    console.warn(`[Frontend] Request timeout for ${service.url} (${IP_FETCH_TIMEOUT}ms)`);
                    lastError = new Error(`Timeout after ${IP_FETCH_TIMEOUT}ms`);
                } else {
                    lastError = e;
                }
            }
        }

        // 如果所有自动源都失败，再次尝试从 Session 读取（可能在其他tab中已获取）
        const fallbackSessionIp = sessionStorage.getItem('cached_real_ip');
        if (fallbackSessionIp) {
            console.log('[Frontend] Using fallback IP from sessionStorage:', fallbackSessionIp);
            cachedRealIp = fallbackSessionIp;
            ipFetchPromise = null;
            return fallbackSessionIp;
        }

        // 所有方法都失败
        console.error('[Frontend] ❌ All IP services failed!', lastError ? `Last error: ${lastError.message}` : '');
        ipFetchPromise = null;
        return null;
    })();

    return await ipFetchPromise;
}

// 在模組載入時就開始獲取 IP（不阻塞，異步執行）
if (!cachedRealIp) {
    getClientIp().catch(err => {
        console.warn('[Frontend] Failed to pre-fetch IP:', err);
    });
}

// 導出 getClientIp 函數，供其他組件使用
export { getClientIp };

// 请求拦截器
service.interceptors.request.use(
    async (config) => {
        const token = localStorage.getItem('admin_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        
        // 獲取自動檢測的 IP（增加超时保护，避免阻塞请求太久）
        let realIp = null;
        try {
            // 设置一个较短的超时，避免阻塞请求太久
            const ipFetchWithTimeout = Promise.race([
                getClientIp(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('IP fetch timeout')), 10000)
                )
            ]);
            realIp = await ipFetchWithTimeout;
        } catch (error) {
            // 如果获取IP超时或失败，尝试使用缓存的IP
            realIp = cachedRealIp || sessionStorage.getItem('cached_real_ip');
            if (!realIp) {
                console.warn('[Frontend] ⚠️ Failed to get client IP (timeout or error), request will proceed without X-Client-Real-IP header');
                console.warn('[Frontend] Error details:', error.message);
            } else {
                console.log('[Frontend] Using cached IP after fetch timeout:', realIp);
            }
        }

        // 注入 Header
        if (realIp) {
            config.headers['X-Client-Real-IP'] = realIp;
            console.log('[Frontend] ✅ Sending X-Client-Real-IP header:', realIp);
        } else {
            console.warn('[Frontend] ⚠️ No IP available, request will proceed without X-Client-Real-IP header');
        }
        
        return config;
    },
    (error) => {
        console.error('Request error:', error);
        return Promise.reject(error);
    }
);

// 响应拦截器
service.interceptors.response.use(
    (response) => {
        return response.data;
    },
    (error) => {
        console.error('Response error:', error.response);
        let message = '请求失败';
        
        if (error.response) {
            if (error.response.data && error.response.data.error) {
                message = error.response.data.error;
            }

            if (error.response.status === 401) {
                const url = error.config.url;
                if (!url.includes('/login')) {
                    localStorage.removeItem('admin_token');
                    location.href = '/admin/login';
                    return Promise.reject(error);
                }
            }
        }
        
        ElMessage.error(message);
        return Promise.reject(error);
    }
);

export default service;