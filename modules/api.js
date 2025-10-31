// modules/api.js

const API_BASE_URL = '/api'; // (不再寫死 localhost:3000)

// 統一的錯誤處理和請求函數
async function request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config = {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    };
    try {
        const response = await fetch(url, config);
        // 增加對回應格式的檢查
        const contentType = response.headers.get("content-type");
        if (!response.ok || !contentType || !contentType.includes("application/json")) {
            // 如果回應不是 JSON，我們就不能用 .json() 解析
            const textResponse = await response.text();
            throw new Error(`Server returned non-JSON response: ${textResponse}`);
        }
        return response.json();
    } catch (error) {
        console.error(`API Error on ${endpoint}:`, error);
        alert(`Error: ${error.message}`);
        throw error; 
    }
}

/**
 * 註冊或登入用戶
 * @param {string} walletAddress 
 * @returns {Promise<object>} 用戶物件
 */
export function registerOrLogin(walletAddress) {
    return request('/register', {
        method: 'POST',
        body: JSON.stringify({ walletAddress }),
    });
}

/**
 * 處理下注 (現在傳遞 txHash)
 * @param {string} walletAddress
 * @param {string} choice 'head' or 'tail'
 * @param {number} amount
 * @param {string} txHash 鏈上交易的雜湊
 * @returns {Promise<object>}
 */
export function placeBet(walletAddress, choice, amount, txHash) {
    return request('/bets', {
        method: 'POST',
        body: JSON.stringify({ walletAddress, choice, amount, txHash }),
    });
}

/**
 * 獲取投注歷史
 * @param {string} walletAddress 
 * @returns {Promise<Array>} 歷史記錄陣列
 */
export function getHistory(walletAddress) {
    return request(`/history/${walletAddress}`);
}

/**
 * ★★★ 新增：獲取排行榜數據 ★★★
 * @returns {Promise<Array>} 排行榜陣列
 */
export function getLeaderboard() {
    return request('/leaderboard'); 
}

/**
 * ★★★ 新增：更新用戶昵稱 ★★★
 * @param {string} walletAddress 
 * @param {string} nickname
 * @returns {Promise<object>}
 */
export function updateNickname(walletAddress, nickname) {
    return request('/users/nickname', {
        method: 'PATCH',
        body: JSON.stringify({ walletAddress, nickname }),
    });
}