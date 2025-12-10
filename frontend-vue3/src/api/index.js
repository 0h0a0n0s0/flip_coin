// API 请求模块
// 统一处理所有 HTTP 请求，禁止在代码中直接使用 fetch()
// 從 modules/api.js 遷移

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
        const response = await fetch(url, config);

        // 嘗試获取 JSON
        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            try {
                data = await response.json();
            } catch (e) {
                data = null; 
            }
        }

        // 检查回应狀态
        if (!response.ok) {
            const errorMessage = data?.error || `Request failed with status ${response.status}`;
            const error = new Error(errorMessage);
            error.status = response.status;
            error.data = data; 
            throw error;
        }

        return data || response.text();

    } catch (error) {
        if (error.status >= 400 && error.status < 500) {
            // 4xx 错误
        } else {
            console.error(`[API Error] ${endpoint}:`, error.message);
        }
        throw error; 
    }
}

/**
 * 用户注册
 */
export function register(username, password) {
    return request('/register', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

/**
 * 用户登录
 */
export function login(username, password) {
    return request('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

/**
 * 获取用户信息
 */
export function getUserInfo(token) {
    return request('/me', {
        method: 'GET',
        token: token
    });
}

/**
 * 获取游戏列表 - 公开API，不需要token
 */
export async function getGames() {
  const response = await request('/games?status=enabled', {
    method: 'GET'
  })
  
  // 適配標準 API 返回格式 { success: true, data: [...] }
  if (response && typeof response === 'object' && response.success && Array.isArray(response.data)) {
    return response.data
  }
  
  // 向後兼容：如果返回的是數組（舊格式），直接返回
  if (Array.isArray(response)) {
    return response
  }
  
  // 如果格式不符合預期，返回空數組
  console.warn('[API] Unexpected games API response format:', response)
  return []
}

export async function getPlatformName() {
    try {
        const response = await request('/platform-name', {
            method: 'GET'
        });
        
        // 適配標準 API 返回格式 { success: true, data: { platform_name: ... } }
        if (response && typeof response === 'object' && response.success && response.data) {
            return response.data.platform_name || 'FlipCoin'
        }
        
        // 向後兼容：如果返回的是舊格式 { platform_name: ... }
        if (response && typeof response === 'object' && response.platform_name) {
            return response.platform_name
        }
        
        // 如果格式不符合預期，返回默認值
        console.warn('[API] Unexpected platform-name API response format:', response)
        return 'FlipCoin'
    } catch (error) {
        console.error('Failed to fetch platform name:', error);
        return 'FlipCoin';
    }
}

/**
 * 获取投注历史
 */
export function getHistory(token) {
    return request(`/history`, {
        method: 'GET',
        token: token
    });
}

/**
 * 获取排行榜（公开 API，无需 token）
 */
export function getLeaderboard() {
    return request('/leaderboard'); 
}

/**
 * 提交下注
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
 */
export function updateWithdrawalPassword(token, old_password, new_password) {
    return request('/users/update-withdrawal-password', {
        method: 'PATCH',
        token: token,
        body: JSON.stringify({ old_password, new_password }),
    });
}

/**
 * 请求提款
 */
export function requestWithdrawal(token, data) {
    return request('/users/request-withdrawal', {
        method: 'POST', 
        token: token,
        body: JSON.stringify(data),
    });
}

/**
 * 获取提款历史
 */
export function getWithdrawalHistory(token) {
    return request('/users/withdrawals', {
        method: 'GET', 
        token: token
    });
}

/**
 * 获取用户充值历史
 */
export function getDepositHistory(token) {
    return request('/users/deposits', {
        method: 'GET', 
        token: token
    });
}

