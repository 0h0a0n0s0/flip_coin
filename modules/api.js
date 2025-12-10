// API 请求模块
// 统一处理所有 HTTP 请求，禁止在代码中直接使用 fetch()

const API_BASE_URL = '/api/v1'; 

// 获取缓存的真实IP
async function getClientIp() {
    // 檢查sessionStorage中是否有緩存的IP
    const cachedIp = sessionStorage.getItem('cached_real_ip');
    if (cachedIp) {
        return cachedIp;
    }
    
    // 如果沒有緩存，嘗試獲取
    const ipServices = [
        { url: 'https://api.seeip.org/jsonip', key: 'ip' },
        { url: 'https://api.ipify.org?format=json', key: 'ip' },
        { url: 'https://api.my-ip.io/ip.json', key: 'ip' },
        { url: 'https://ipapi.co/json/', key: 'ip' }
    ];
    
    for (const service of ipServices) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(service.url, {
                signal: controller.signal,
                mode: 'cors',
                cache: 'no-cache'
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                const ip = data[service.key];
                if (ip && typeof ip === 'string') {
                    sessionStorage.setItem('cached_real_ip', ip);
                    return ip;
                }
            }
        } catch (e) {
            // 繼續嘗試下一個服務
        }
    }
    
    return null;
}

/**
 * 统一的错误处理和请求函数
 * 自动处理 token 认证和 IP header
 */
async function request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // 獲取真實IP並添加到headers
    const realIp = await getClientIp();
    
    const config = {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    };

    if (options.token) {
        config.headers['Authorization'] = `Bearer ${options.token}`;
    }
    
    // 自动添加真实IP header
    if (realIp) {
        config.headers['X-Client-Real-IP'] = realIp;
    }

    try {
        const response = await fetch(url, config); // 1. 发出请求

        // 2. 尝試获取 JSON (無论狀态如何)
        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            try {
                data = await response.json();
            } catch (e) {
                // 如果 response.ok 为 false 且 body 为空，.json() 会失败
                data = null; 
            }
        }

        // 3. 检查回应狀态
        if (!response.ok) {
            // 我们有 HTTP 错误 4xx 或 5xx
            const errorMessage = data?.error || `Request failed with status ${response.status}`;
            
            // 建立一個包含 status 的自定义错误
            const error = new Error(errorMessage);
            error.status = response.status;
            error.data = data; 
            throw error;
        }

        // 4. 成功
        return data || response.text(); // 返回 JSON 数据或文本

    } catch (error) {
        // 5. 统一处理所有错误
        // 区分 4xx 和 5xx 错误
        if (error.status >= 500 || !error.status) {
            // 5xx 错误或网路错误，记录到控制台
            console.error(`[API Error] ${endpoint}:`, error.message);
        }

        throw error; 
    }
}

/**
 * 用户注册
 * @param {string} username 
 * @param {string} password 
 * @returns {Promise<object>} { user, token }
 */
export function register(username, password) {
    return request('/register', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

/**
 * 用户登录
 * @param {string} username 
 * @param {string} password 
 * @returns {Promise<object>} { user, token }
 */
export function login(username, password) {
    return request('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

/**
 * 获取用户信息
 * @param {string} token 
 * @returns {Promise<object>} user (包含 balance)
 */
export function getUserInfo(token) {
    return request('/me', {
        method: 'GET',
        token: token
    });
}


/**
 * 获取平台名称 - 公开API，不需要token
 * @returns {Promise<object>} { platform_name: string }
 */
export async function getPlatformName() {
    try {
        return await request('/platform-name', {
            method: 'GET'
        });
    } catch (error) {
        console.error('Failed to fetch platform name:', error);
        return { platform_name: 'FlipCoin' }; // 默认值
    }
}

/**
 * 获取投注历史
 * @param {string} token 
 * @returns {Promise<Array>} 历史记录陣列
 */
export function getHistory(token) {
    return request(`/history`, {
        method: 'GET',
        token: token
    });
}

/**
 * 获取排行榜（公开 API，无需 token）
 * @returns {Promise<Array>} 排行榜陣列
 */
export function getLeaderboard() {
    return request('/leaderboard'); 
}

/**
 * 提交下注
 * @param {string} token 
 * @param {string} choice 'head' or 'tail'
 * @param {number} amount
 * @returns {Promise<object>}
 */
export function placeBet(token, choice, amount) {
    return request('/bets', {
        method: 'POST',
        token: token,
        body: JSON.stringify({ choice, amount }),
    });
}

/**
 * 更新用户昵称
 * @param {string} token
 * @param {string} nickname
 * @returns {Promise<object>} updated user
 */
export function updateNickname(token, nickname) {
    return request('/users/nickname', {
        method: 'PATCH',
        token: token,
        body: JSON.stringify({ nickname }),
    });
}

/**
 * 绑定推荐码
 * @param {string} token
 * @param {string} referrerCode
 * @returns {Promise<object>} updated user
 */
export function bindReferrer(token, referrerCode) {
    return request('/users/bind-referrer', {
        method: 'POST',
        token: token,
        body: JSON.stringify({ referrer_code: referrerCode }),
    });
}

/**
 * 设置提款密码
 * @param {string} token
 * @param {string} login_password 
 * @param {string} new_password
 * @returns {Promise<object>}
 */
export function setWithdrawalPassword(token, login_password, new_password) {
    return request('/users/set-withdrawal-password', {
        method: 'POST',
        token: token,
        body: JSON.stringify({ login_password, new_password }),
    });
}

/**
 * 修改提款密码
 * @param {string} token
 * @param {string} old_password 
 * @param {string} new_password
 * @returns {Promise<object>}
 */
export function updateWithdrawalPassword(token, old_password, new_password) {
    return request('/users/update-withdrawal-password', {
        method: 'PATCH',
        token: token,
        body: JSON.stringify({ old_password, new_password }),
    });
}
export function requestWithdrawal(token, data) {
    // data: { chain_type, address, amount, withdrawal_password }
    return request('/users/request-withdrawal', {
        method: 'POST', token: token,
        body: JSON.stringify(data),
    });
}
export function getWithdrawalHistory(token) {
    return request('/users/withdrawals', {
        method: 'GET', token: token
    });
}

/**
 * 获取用户充值历史
 * @param {string} token
 * @returns {Promise<Array>} 充值历史列表
 */
export function getDepositHistory(token) {
    return request('/users/deposits', {
        method: 'GET', token: token
    });
}