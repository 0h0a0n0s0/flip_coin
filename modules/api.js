// 档案: modules/api.js (★★★ v6.1 中心化 Auth 版 ★★★)

// (★★★ API 路径改为 /api/v1/ ★★★)
const API_BASE_URL = '/api/v1'; 

/**
 * 统一的错误处理和请求函数
 * (★★★ 加入 token 参数 ★★★)
 */
async function request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config = {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    };

    if (options.token) {
        config.headers['Authorization'] = `Bearer ${options.token}`;
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
                // (如果 response.ok 为 false 且 body 为空，.json() 会失败)
                data = null; 
            }
        }

        // 3. 检查回应狀态
        if (!response.ok) {
            // (我们有 HTTP 错误 4xx 或 5xx)
            const errorMessage = data?.error || `Request failed with status ${response.status}`;
            
            // 建立一個包含 status 的自定义错误
            const error = new Error(errorMessage);
            error.status = response.status; // (★★★ 关键：将 status 附加到错误物件)
            error.data = data; 
            throw error; // (此 throw 将被下面的 catch 捕获)
        }

        // 4. 成功 (response.ok)
        return data || response.text(); // 返回 JSON 数据或文本

    } catch (error) {
        // 5. 统一处理所有错误 (网路错误 或 上面拋出的 HTTP 错误)
        
        // (★★★ 关键：区分 4xx 和 5xx ★★★)
        if (error.status >= 400 && error.status < 500) {
            // 4xx 错误 (例如：400 帐号重复, 401 未登入, 403 被禁止)
            // 這是可预期的业务逻辑错误，使用 console.warn
            // console.warn(`[API Validation] ${endpoint} (${error.status}): ${error.message}`);
        } else {
            // 5xx 错误 (伺服器内部错误) 或 网路错误 (fetch 失败, error.status 为 undefined)
            // 這是系统级错误，使用 console.error
            console.error(`[API Error] ${endpoint}:`, error.message);
        }

        // (★★★ 关键：将带有 status 的错误拋出给 app.js ★★★)
        throw error; 
    }
}

/**
 * (★★★ 传统注册 ★★★)
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
 * (★★★ 传统登入 ★★★)
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
 * (★★★ 获取用户资讯 ★★★)
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
 * (★★★ 使用 token 验证 ★★★)
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
 * (★★★ 公开 API，無需 token ★★★)
 * @returns {Promise<Array>} 排行榜陣列
 */
export function getLeaderboard() {
    return request('/leaderboard'); 
}

/**
 * (★★★ 中心化下注 ★★★)
 * (v6.2 才会實作後端)
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
 * (★★★ 更新用户昵称 ★★★)
 * @param {string} token
 * @param {string} nickname
 * @returns {Promise<object>} updated user
 */
export function updateNickname(token, nickname) {
    return request('/users/nickname', { // (API 路由 /api/v1/users/nickname)
        method: 'PATCH',
        token: token,
        body: JSON.stringify({ nickname }),
    });
}

/**
 * (★★★ 绑定推薦码 ★★★)
 * @param {string} token
 * @param {string} referrerCode
 * @returns {Promise<object>} updated user
 */
export function bindReferrer(token, referrerCode) {
    return request('/users/bind-referrer', { // (API 路由 /api/v1/users/bind-referrer)
        method: 'POST',
        token: token,
        body: JSON.stringify({ referrer_code: referrerCode }),
    });
}

/**
 * (★★★ 设置初始提款密码 ★★★)
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
 * (★★★ 修改提款密码 ★★★)
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
 * (★★★ 获取用户充值历史 ★★★)
 * @param {string} token
 * @returns {Promise<Array>} 充值历史列表
 */
export function getDepositHistory(token) {
    return request('/users/deposits', {
        method: 'GET', token: token
    });
}