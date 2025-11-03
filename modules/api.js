// 檔案: modules/api.js (★★★ v6.1 中心化 Auth 版 ★★★)

// (★★★ v6 修改：API 路徑改為 /api/v1/ ★★★)
const API_BASE_URL = '/api/v1'; 

/**
 * 統一的錯誤處理和請求函數
 * (★★★ v6 修改：加入 token 參數 ★★★)
 */
async function request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config = {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    };

    // (如果提供了 token，加入到 Authorization 標頭)
    if (options.token) {
        config.headers['Authorization'] = `Bearer ${options.token}`;
    }

    try {
        const response = await fetch(url, config);
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            if (!response.ok) {
                // 優先使用後端 JSON 中的 error 訊息
                throw new Error(data.error || 'Request failed with status ' + response.status);
            }
            return data;
        }

        // 處理非 JSON 回應
        if (!response.ok) {
            const textResponse = await response.text();
            throw new Error(`Server returned non-JSON response: ${textResponse}`);
        }
        return response.text();

    } catch (error) {
        console.error(`API Error on ${endpoint}:`, error.message);
        // (不再 alert，讓呼叫者 (app.js) 去 catch)
        throw error; 
    }
}

/**
 * (★★★ v6 新增：傳統註冊 ★★★)
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
 * (★★★ v6 新增：傳統登入 ★★★)
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
 * (★★★ v6 新增：獲取用戶資訊 ★★★)
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
 * (★★★ v6 新增：更新用戶昵稱 ★★★)
 * (注意：這個 API 尚未在後端 v1Router 實作，我們先定義)
 * @param {string} token 
 * @param {string} nickname
 * @returns {Promise<object>}
 */
export function updateNickname(token, nickname) {
    return request('/users/nickname', {
        method: 'PATCH',
        token: token,
        body: JSON.stringify({ nickname }),
    });
}

/**
 * (★★★ v6 新增：綁定推薦碼 ★★★)
 * (注意：這個 API 尚未在後端 v1Router 實作，我們先定義)
 * @param {string} token 
 * @param {string} referrerCode
 * @returns {Promise<object>}
 */
export function bindReferrer(token, referrerCode) {
    return request('/users/bind-referrer', {
        method: 'POST',
        token: token,
        body: JSON.stringify({ referrerCode }),
    });
}

/**
 * (★★★ v6 修改：使用 token 驗證 ★★★)
 * @param {string} token 
 * @returns {Promise<Array>} 歷史記錄陣列
 */
export function getHistory(token) {
    return request(`/history`, {
        method: 'GET',
        token: token
    });
}

/**
 * (★★★ v6 修改：公開 API，無需 token ★★★)
 * @returns {Promise<Array>} 排行榜陣列
 */
export function getLeaderboard() {
    return request('/leaderboard'); 
}

/**
 * (★★★ v6 新增：中心化下注 ★★★)
 * (v6.2 才會實作後端)
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