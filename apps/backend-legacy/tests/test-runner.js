#!/usr/bin/env node
// 自動化測試執行器
// 執行所有 API 測試、前端測試、錯誤處理測試和回歸測試

// 嘗試載入 axios（如果可用）
let axios;
try {
    axios = require('axios');
} catch (e) {
    console.error('錯誤: 需要安裝 axios。執行: npm install axios');
    process.exit(1);
}

// 簡單的顏色支持（不使用外部包）
const colors = {
    reset: '\x1b[0m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    magenta: '\x1b[35m',
};
function colorize(text, color) {
    return colors[color] ? `${colors[color]}${text}${colors.reset}` : text;
}

// 配置
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';
const TEST_CONFIG = {
    timeout: 10000, // 10秒超時
    retries: 3,
};

// 測試結果統計
const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
};

// 測試用例存儲
let testAdminToken = null;
let testUserToken = null;
let testUserId = null;
let testAdminId = null;

// 工具函數
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors_map = {
        info: 'cyan',
        success: 'green',
        error: 'red',
        warning: 'yellow',
        test: 'magenta',
    };
    console.log(colorize(`[${timestamp}] ${message}`, colors_map[type]));
}

function assert(condition, message) {
    testResults.total++;
    if (condition) {
        testResults.passed++;
        log(`✓ ${message}`, 'success');
        return true;
    } else {
        testResults.failed++;
        testResults.errors.push(message);
        log(`✗ ${message}`, 'error');
        return false;
    }
}

function assertResponseFormat(response, expectedSuccess = true) {
    const hasSuccess = response.data && typeof response.data.success === 'boolean';
    const successMatches = !expectedSuccess || response.data.success === true;
    const hasDataOrError = expectedSuccess 
        ? (response.data.data !== undefined)
        : (response.data.error !== undefined);
    
    return assert(
        hasSuccess && successMatches && hasDataOrError,
        `響應格式正確: { success: ${expectedSuccess}, ${expectedSuccess ? 'data' : 'error'}: ... }`
    );
}

async function makeRequest(method, endpoint, data = null, token = null, expectedStatus = 200) {
    const config = {
        method,
        url: `${BASE_URL}${endpoint}`,
        headers: {
            'Content-Type': 'application/json',
        },
        timeout: TEST_CONFIG.timeout,
    };

    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
        config.data = data;
    }

    try {
        const response = await axios(config);
        if (response.status !== expectedStatus) {
            throw new Error(`預期狀態碼 ${expectedStatus}，實際 ${response.status}`);
        }
        return { success: true, response };
    } catch (error) {
        if (error.response && error.response.status === expectedStatus) {
            return { success: true, response: error.response };
        }
        return { success: false, error: error.message, response: error.response };
    }
}

// 測試套件
const testSuites = {
    // v1 API 測試
    async testV1Auth() {
        log('\n=== v1 API 認證測試 ===', 'test');
        
        // 測試註冊
        log('測試用戶註冊...');
        const registerResult = await makeRequest('POST', '/api/v1/register', {
            username: `testuser_${Date.now()}`,
            password: 'test123456',
        }, null, 201);
        
        if (registerResult.success && registerResult.response) {
            assert(registerResult.response.data.success === true, '註冊成功');
            assert(registerResult.response.data.data.token, '返回 token');
            assert(registerResult.response.data.data.user, '返回用戶資訊');
            testUserToken = registerResult.response.data.data.token;
            testUserId = registerResult.response.data.data.user.id;
        } else {
            assert(false, `註冊失敗: ${registerResult.error}`);
        }
        
        // 測試登入
        log('測試用戶登入...');
        const loginResult = await makeRequest('POST', '/api/v1/login', {
            username: 'testuser',
            password: 'test123',
        });
        
        if (loginResult.success && loginResult.response) {
            assert(loginResult.response.data.success === true, '登入成功');
            if (loginResult.response.data.data && loginResult.response.data.data.token) {
                testUserToken = loginResult.response.data.data.token;
            }
        }
        
        // 測試獲取當前用戶
        if (testUserToken) {
            log('測試獲取當前用戶...');
            const meResult = await makeRequest('GET', '/api/v1/me', null, testUserToken);
            if (meResult.success && meResult.response) {
                assertResponseFormat(meResult.response);
            }
        }
    },

    async testV1Games() {
        log('\n=== v1 API 遊戲測試 ===', 'test');
        
        // 測試獲取遊戲列表
        log('測試獲取遊戲列表...');
        const gamesResult = await makeRequest('GET', '/api/v1/games');
        if (gamesResult.success && gamesResult.response) {
            assertResponseFormat(gamesResult.response);
        }
        
        // 測試獲取平台名稱
        log('測試獲取平台名稱...');
        const platformResult = await makeRequest('GET', '/api/v1/platform-name');
        if (platformResult.success && platformResult.response) {
            assertResponseFormat(platformResult.response);
        }
    },

    async testV1User() {
        log('\n=== v1 API 用戶測試 ===', 'test');
        
        if (!testUserToken) {
            log('跳過：需要用戶 token', 'warning');
            testResults.skipped++;
            return;
        }
        
        // 測試更新暱稱
        log('測試更新暱稱...');
        const nicknameResult = await makeRequest('PATCH', '/api/v1/users/nickname', {
            nickname: `測試暱稱_${Date.now()}`,
        }, testUserToken);
        if (nicknameResult.success && nicknameResult.response) {
            assertResponseFormat(nicknameResult.response);
        }
    },

    async testV1Wallet() {
        log('\n=== v1 API 錢包測試 ===', 'test');
        
        if (!testUserToken) {
            log('跳過：需要用戶 token', 'warning');
            testResults.skipped++;
            return;
        }
        
        // 測試獲取提款歷史
        log('測試獲取提款歷史...');
        const withdrawalsResult = await makeRequest('GET', '/api/v1/users/withdrawals', null, testUserToken);
        if (withdrawalsResult.success && withdrawalsResult.response) {
            assertResponseFormat(withdrawalsResult.response);
            // 驗證地址遮罩
            if (withdrawalsResult.response.data.data && Array.isArray(withdrawalsResult.response.data.data)) {
                const hasMaskedAddress = withdrawalsResult.response.data.data.some(w => 
                    w.address_masked || (w.address && w.address.includes('***'))
                );
                assert(hasMaskedAddress || withdrawalsResult.response.data.data.length === 0, '地址已遮罩');
            }
        }
        
        // 測試獲取充值歷史
        log('測試獲取充值歷史...');
        const depositsResult = await makeRequest('GET', '/api/v1/users/deposits', null, testUserToken);
        if (depositsResult.success && depositsResult.response) {
            assertResponseFormat(depositsResult.response);
        }
    },

    // Admin API 測試
    async testAdminAuth() {
        log('\n=== Admin API 認證測試 ===', 'test');
        
        // 測試管理員登入
        log('測試管理員登入...');
        const loginResult = await makeRequest('POST', '/api/admin/login', {
            username: 'admin',
            password: 'admin123',
        });
        
        if (loginResult.success && loginResult.response) {
            assert(loginResult.response.data.success === true, '管理員登入成功');
            if (loginResult.response.data.data && loginResult.response.data.data.token) {
                testAdminToken = loginResult.response.data.data.token;
                testAdminId = loginResult.response.data.data.user?.id;
            }
        } else {
            log('管理員登入失敗，可能測試資料未準備', 'warning');
        }
    },

    async testAdminUsers() {
        log('\n=== Admin API 用戶管理測試 ===', 'test');
        
        if (!testAdminToken) {
            log('跳過：需要管理員 token', 'warning');
            testResults.skipped++;
            return;
        }
        
        // 測試獲取用戶列表
        log('測試獲取用戶列表...');
        const usersResult = await makeRequest('GET', '/api/admin/users', null, testAdminToken);
        if (usersResult.success && usersResult.response) {
            assertResponseFormat(usersResult.response);
        }
    },

    async testAdminBets() {
        log('\n=== Admin API 注單管理測試 ===', 'test');
        
        if (!testAdminToken) {
            log('跳過：需要管理員 token', 'warning');
            testResults.skipped++;
            return;
        }
        
        // 測試獲取注單列表
        log('測試獲取注單列表...');
        const betsResult = await makeRequest('GET', '/api/admin/bets', null, testAdminToken);
        if (betsResult.success && betsResult.response) {
            assertResponseFormat(betsResult.response);
        }
    },

    async testAdminSettings() {
        log('\n=== Admin API 系統設定測試 ===', 'test');
        
        if (!testAdminToken) {
            log('跳過：需要管理員 token', 'warning');
            testResults.skipped++;
            return;
        }
        
        // 測試獲取設定
        log('測試獲取系統設定...');
        const settingsResult = await makeRequest('GET', '/api/admin/settings', null, testAdminToken);
        if (settingsResult.success && settingsResult.response) {
            assertResponseFormat(settingsResult.response);
        }
    },

    // 錯誤處理測試
    async testErrorHandling() {
        log('\n=== 錯誤處理測試 ===', 'test');
        
        // 測試 401 錯誤（無 token）
        log('測試 401 錯誤（無認證）...');
        const unauthorizedResult = await makeRequest('GET', '/api/v1/me', null, null, 401);
        if (unauthorizedResult.response) {
            assert(
                unauthorizedResult.response.data.success === false,
                '401 錯誤響應格式正確'
            );
        }
        
        // 測試 400 錯誤（無效輸入）
        log('測試 400 錯誤（無效輸入）...');
        const badRequestResult = await makeRequest('POST', '/api/v1/register', {
            username: '',
            password: '',
        }, null, 400);
        if (badRequestResult.response) {
            assert(
                badRequestResult.response.data.success === false,
                '400 錯誤響應格式正確'
            );
        }
        
        // 測試 404 錯誤（不存在的端點）
        log('測試 404 錯誤（不存在的端點）...');
        const notFoundResult = await makeRequest('GET', '/api/v1/nonexistent', null, null, 404);
        // 404 可能沒有標準格式，所以只檢查狀態碼
        assert(notFoundResult.response?.status === 404, '404 錯誤狀態碼正確');
    },

    // 回歸測試
    async testRegression() {
        log('\n=== 回歸測試 ===', 'test');
        
        // 驗證核心 API 仍然可用
        log('驗證核心 API 可用性...');
        const coreApis = [
            { method: 'GET', endpoint: '/api/v1/games' },
            { method: 'GET', endpoint: '/api/v1/platform-name' },
        ];
        
        for (const api of coreApis) {
            const result = await makeRequest(api.method, api.endpoint);
            assert(result.success, `${api.method} ${api.endpoint} 可用`);
        }
        
        if (testAdminToken) {
            const adminApis = [
                { method: 'GET', endpoint: '/api/admin/users' },
                { method: 'GET', endpoint: '/api/admin/bets' },
            ];
            
            for (const api of adminApis) {
                const result = await makeRequest(api.method, api.endpoint, null, testAdminToken);
                assert(result.success, `${api.method} ${api.endpoint} 可用`);
            }
        }
    },
};

// 主執行函數
async function runTests() {
    log('開始自動化測試執行...', 'info');
    log(`測試目標: ${BASE_URL}`, 'info');
    log(`超時設置: ${TEST_CONFIG.timeout}ms`, 'info');
    
    const startTime = Date.now();
    
    try {
        // 執行所有測試套件
        await testSuites.testV1Auth();
        await testSuites.testV1Games();
        await testSuites.testV1User();
        await testSuites.testV1Wallet();
        await testSuites.testAdminAuth();
        await testSuites.testAdminUsers();
        await testSuites.testAdminBets();
        await testSuites.testAdminSettings();
        await testSuites.testErrorHandling();
        await testSuites.testRegression();
        
    } catch (error) {
        log(`測試執行錯誤: ${error.message}`, 'error');
        testResults.errors.push(error.message);
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    // 輸出測試報告
    log('\n=== 測試報告 ===', 'test');
    log(`總測試數: ${testResults.total}`, 'info');
    log(`通過: ${testResults.passed}`, 'success');
    log(`失敗: ${testResults.failed}`, testResults.failed > 0 ? 'error' : 'info');
    log(`跳過: ${testResults.skipped}`, 'warning');
    log(`耗時: ${duration}秒`, 'info');
    
    if (testResults.errors.length > 0) {
        log('\n錯誤列表:', 'error');
        testResults.errors.forEach((error, index) => {
            log(`${index + 1}. ${error}`, 'error');
        });
    }
    
    // 退出碼
    process.exit(testResults.failed > 0 ? 1 : 0);
}

// 執行測試
if (require.main === module) {
    runTests().catch(error => {
        log(`致命錯誤: ${error.message}`, 'error');
        process.exit(1);
    });
}

module.exports = { runTests, testSuites };

