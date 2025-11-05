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

    if (options.token) {
        config.headers['Authorization'] = `Bearer ${options.token}`;
    }

    try {
        const response = await fetch(url, config); // 1. 發出請求

        // 2. 嘗試獲取 JSON (無論狀態如何)
        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            try {
                data = await response.json();
            } catch (e) {
                // (如果 response.ok 為 false 且 body 為空，.json() 會失敗)
                data = null; 
            }
        }

        // 3. 檢查回應狀態
        if (!response.ok) {
            // (我們有 HTTP 錯誤 4xx 或 5xx)
            const errorMessage = data?.error || `Request failed with status ${response.status}`;
            
            // 建立一個包含 status 的自定義錯誤
            const error = new Error(errorMessage);
            error.status = response.status; // (★★★ 關鍵：將 status 附加到錯誤物件)
            error.data = data; 
            throw error; // (此 throw 將被下面的 catch 捕獲)
        }

        // 4. 成功 (response.ok)
        return data || response.text(); // 返回 JSON 數據或文本

    } catch (error) {
        // 5. 統一處理所有錯誤 (網路錯誤 或 上面拋出的 HTTP 錯誤)
        
        // (★★★ 關鍵：區分 4xx 和 5xx ★★★)
        if (error.status >= 400 && error.status < 500) {
            // 4xx 錯誤 (例如：400 帳號重複, 401 未登入, 403 被禁止)
            // 這是可預期的業務邏輯錯誤，使用 console.warn
            // console.warn(`[API Validation] ${endpoint} (${error.status}): ${error.message}`);
        } else {
            // 5xx 錯誤 (伺服器內部錯誤) 或 網路錯誤 (fetch 失敗, error.status 為 undefined)
            // 這是系統級錯誤，使用 console.error
            console.error(`[API Error] ${endpoint}:`, error.message);
        }

        // (★★★ 關鍵：將帶有 status 的錯誤拋出給 app.js ★★★)
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