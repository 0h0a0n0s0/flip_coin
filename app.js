// 檔案: app.js (★★★ v6.1 中心化 Auth 版 ★★★)

// (★★★ v6 導入：只導入需要的 API ★★★)
import { renderHistory } from './modules/history.js';
import * as api from './modules/api.js'; 

// --- Notyf 實例化 (不變) ---
const notyf = new Notyf({
    duration: 5000,
    position: { x: 'right', y: 'top' },
    dismissible: true,
    types: [
        {
            type: 'warning',
            background: '#f5a623',
            icon: {
                className: 'notyf__icon--warning',
                tagName: 'i',
                text: '⚠️'
            }
        }
    ]
});

// --- 全局狀態 (★★★ v6 修改 ★★★) ---
let jwtToken = null;
let currentUser = null;
let socket = null;

// (遊戲元素)
let confirmBetBtn, betAmountInput, userStreakDisplay, userMaxStreakDisplay;
// (Auth 元素)
let loginBtn, registerBtn, logoutBtn, userInfoDisplay, usernameDisplay, balanceDisplay;
// (登入 Modal)
let loginModal, closeLoginModalBtn, cancelLoginBtn, confirmLoginBtn, loginUsernameInput, loginPasswordInput;
// (註冊 Modal)
let registerModal, closeRegisterModalBtn, cancelRegisterBtn, confirmRegisterBtn, registerUsernameInput, registerPasswordInput, registerPasswordConfirmInput;
// (★★★ v7-M2 修改：個人中心 Modal ★★★)
let personalCenterBtn, personalCenterModal, closePersonalCenterModalBtn, pc_cancelBtn;
// (Tab 1: Info)
let pc_userId, pc_username, pc_level, pc_maxStreak, pc_inviteCode, pc_referrerCode;
// (Tab 2: Deposit)
let pc_tab_info, pc_tab_deposit, pc_content_info, pc_content_deposit;
let pc_tron_address, pc_copy_tron_btn;

let isBetting = false; // (防止重複下注)

// --- Socket 連線 (★★★ v6 修改 ★★★) ---
function initializeSocket(token) {
    if (socket) socket.disconnect();
    
    // (使用 token 進行 auth)
    socket = io('http://localhost:3000', {
        auth: {
            token: token
        }
    });

    socket.on('connect', () => {
        console.log(`[Socket.io] Connected with token.`);
    });
    
    socket.on('connect_error', (err) => {
        // ... (v6.1 已修復，不變) ...
        console.error('[Socket.io] Connection Error:', err.message);
        if (err.message === 'Authentication error: Invalid token') {
            // Token 過期或無效，強制登出
            handleLogout();
            notyf.error('連線已過期，請重新登入。');
        }
    });
    
    socket.on('bet_updated', (betData) => {
        console.log('[Socket.io] Received bet update (for history):', betData);
        // (收到更新時，刷新歷史列表)
        if (jwtToken) {
            renderHistory(jwtToken);
        }
    });
    socket.on('stats_updated', (stats) => {
        console.log('[Socket.io] Received stats update:', stats);
        if (currentUser) {
            currentUser.current_streak = stats.current_streak;
            currentUser.max_streak = stats.max_streak;
            updateUI(); 
        }
    });
    socket.on('user_info_updated', (fullUser) => {
        console.log('[Socket.io] Received FULL user info update:', fullUser);
        if (currentUser && currentUser.id === fullUser.id) {
            currentUser = fullUser;
            updateUI();
            
            // (★★★ M5 新增：如果不是正在下注時收到餘額更新，才提示充值到帳 ★★★)
            if (!isBetting) {
                notyf.success(`帳戶已更新！新餘額: ${parseFloat(fullUser.balance).toFixed(2)} USDT`);
            }
        }
    });
    socket.on('leaderboard_updated', (leaderboardData) => {
        console.log('[Socket.io] Received leaderboard update:', leaderboardData);
        renderLeaderboardData(leaderboardData);
    });
    socket.on('disconnect', () => console.log('[Socket.io] Disconnected.'));
}

// --- 渲染排行榜 (★★★ v6 修改：顯示名稱 ★★★) ---
function renderLeaderboardData(leaderboardData) {
    const listEl = document.getElementById('leaderboardList');
    if (!listEl) return; 

    if (!leaderboardData || leaderboardData.length === 0) {
        listEl.innerHTML = '<li>暂无排名数据</li>';
        return;
    }
    listEl.innerHTML = ''; 
    leaderboardData.forEach((player, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${index + 1}. <span class="address">${player.display_name}</span></span>
            <span>🔥 ${player.max_streak} 連勝</span>
        `;
        listEl.appendChild(li);
    });
}
async function renderLeaderboard() {
    const listEl = document.getElementById('leaderboardList');
    if (!listEl) return;
    listEl.innerHTML = '<li>Loading...</li>'; 
    try {
        const leaderboardData = await api.getLeaderboard(); // (改為 api. )
        renderLeaderboardData(leaderboardData);
    } catch (error) {
        console.error("Failed to render leaderboard:", error);
        listEl.innerHTML = '<li>无法加载排行榜</li>';
    }
}

// --- UI 更新 (★★★ v6 重構 ★★★) ---
function updateUI() {
    if (currentUser && jwtToken) {
        // --- 登入狀態 ---
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        
        userInfoDisplay.style.display = 'inline-block';
        personalCenterBtn.style.display = 'block';
        logoutBtn.style.display = 'block';

        // (更新 Header 資訊)
        usernameDisplay.innerText = currentUser.nickname || currentUser.username;
        // (★★★ v7-M2 修改：確保 balance 是數字且格式化 ★★★)
        const balance = typeof currentUser.balance === 'string' 
            ? parseFloat(currentUser.balance) 
            : currentUser.balance;
        balanceDisplay.innerText = (balance || 0).toFixed(2); 

        // (更新連勝)
        const streak = currentUser.current_streak || 0;
        userStreakDisplay.style.display = 'inline-block'; 
        if (streak > 0) {
            userStreakDisplay.innerText = `🔥 連勝 ${streak} 場`;
            userStreakDisplay.style.backgroundColor = '#e0f8e0';
            userStreakDisplay.style.color = '#006400';
        } else if (streak < 0) {
            userStreakDisplay.innerText = `🥶 連敗 ${Math.abs(streak)} 場`;
            userStreakDisplay.style.backgroundColor = '#f8e0e0';
            userStreakDisplay.style.color = '#a00000';
        } else {
            userStreakDisplay.innerText = `😐 連勝 0 場`;
            userStreakDisplay.style.backgroundColor = '#eee';
            userStreakDisplay.style.color = '#333';
        }
        const maxStreak = currentUser.max_streak || 0;
        userMaxStreakDisplay.style.display = 'inline-block'; 
        userMaxStreakDisplay.innerText = `🏆 最高連勝: ${maxStreak}`;

    } else {
        // --- 登出狀態 ---
        loginBtn.style.display = 'block';
        registerBtn.style.display = 'block';
        
        userInfoDisplay.style.display = 'none';
        personalCenterBtn.style.display = 'none';
        logoutBtn.style.display = 'none';

        userStreakDisplay.style.display = 'none';
        userMaxStreakDisplay.style.display = 'none';
        
        document.getElementById('historyList').innerHTML = '<li>登入後以查看歷史記錄</li>';
    }
}

// --- Auth 處理函數 (★★★ v6 新增 ★★★) ---
function showLoginModal() { loginModal.style.display = 'block'; }
function hideLoginModal() { loginModal.style.display = 'none'; }
function showRegisterModal() { registerModal.style.display = 'block'; }
function hideRegisterModal() { registerModal.style.display = 'none'; }

async function handleRegister() {
    const username = registerUsernameInput.value;
    const password = registerPasswordInput.value;
    const confirmPassword = registerPasswordConfirmInput.value;

    if (password !== confirmPassword) {
        notyf.error('兩次輸入的密碼不一致');
        return;
    }
    if (username.length < 3 || username.length > 20) {
         notyf.error('帳號長度必須在 3-20 字元之間');
        return;
    }
     if (password.length < 6) {
         notyf.error('密碼長度至少需要 6 位');
        return;
    }

    const btn = confirmRegisterBtn;
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = '註冊中...';
    
    try {
        const { user, token } = await api.register(username, password);
        notyf.success('註冊成功！已自動登入。');
        hideRegisterModal();
        
        localStorage.setItem('jwt_token', token);
        jwtToken = token;
        currentUser = user;
        
        updateUI();
        initializeSocket(token);
        await renderHistory(token);
        
    } catch (error) {
        // (★★★ M-Fix 2 修改 ★★★)
        // 檢查是否是 400 (Bad Request)
        if (error.status === 400) {
            // 業務邏輯錯誤 (例如 "Username already taken.")
            notyf.open({
                type: 'warning', // (使用黃色警告)
                message: `${error.message}` // (直接顯示後端訊息)
            });
        } else {
            // 500 伺服器錯誤或網路錯誤
            notyf.error(`註冊失敗：${error.message}`);
        }
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

async function handleLogin() {
    const username = loginUsernameInput.value;
    const password = loginPasswordInput.value;
    
    if (!username || !password) {
        notyf.error('請輸入帳號和密碼');
        return;
    }
    
    const btn = confirmLoginBtn;
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = '登入中...';
    
    try {
        const { user, token } = await api.login(username, password);
        notyf.success('登入成功！');
        hideLoginModal();
        
        localStorage.setItem('jwt_token', token);
        jwtToken = token;
        currentUser = user;
        
        updateUI();
        initializeSocket(token);
        await renderHistory(token);
        
    } catch (error) {
         // (★★★ M-Fix 2 修改 ★★★)
         // 檢查是否是 401 (Unauthorized)
        if (error.status === 401) {
            // 業務邏輯錯誤 (例如 "Invalid credentials." 或 "Account is disabled.")
            notyf.open({
                type: 'warning', // (使用黃色警告)
                message: `${error.message}` // (直接顯示後端訊息)
            });
        } else {
            // 500 伺服器錯誤或網路錯誤
            notyf.error(`登入失敗：${error.message}`);
        }
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

function handleLogout() {
    localStorage.removeItem('jwt_token');
    jwtToken = null;
    currentUser = null;
    if (socket) socket.disconnect();
    updateUI();
    notyf.success('您已成功登出。');
}

async function fetchUserInfo(token) {
    try {
        const user = await api.getUserInfo(token);
        currentUser = user;
        updateUI();
        initializeSocket(token);
        await renderHistory(token);
    } catch (error) {
        // Token 無效或過期
        console.error('Auto-login failed:', error.message);
        handleLogout(); // 清除無效 token
    }
}

async function autoLogin() {
    const savedToken = localStorage.getItem('jwt_token');
    if (savedToken) {
        console.log('Found saved JWT, attempting to login...');
        jwtToken = savedToken;
        await fetchUserInfo(savedToken);
    } else {
        // 沒有 token，正常顯示登出狀態
        updateUI(); 
    }
    // (無論是否登入，都載入排行榜)
    await renderLeaderboard();
}

// --- 個人中心 (★★★ v6 新增 ★★★) ---
function showPersonalCenterModal() {
    if (!currentUser) return;
    
    // (Tab 1: 填充基本資訊)
    pc_userId.innerText = currentUser.user_id;
    pc_username.innerText = currentUser.username;
    pc_level.innerText = `Level ${currentUser.level}`;
    pc_maxStreak.innerText = currentUser.max_streak;
    pc_inviteCode.innerText = currentUser.invite_code || 'N/A';
    pc_referrerCode.innerText = currentUser.referrer_code || '(未綁定)';
    
    // (★★★ v7-M2 新增：Tab 2: 填充充值資訊 ★★★)
    pc_tron_address.value = currentUser.tron_deposit_address || '地址生成中...';
    
    // (重置 Tab 狀態為顯示 "基本資訊")
    pc_tab_info.classList.add('active');
    pc_content_info.classList.add('active');
    pc_tab_deposit.classList.remove('active');
    pc_content_deposit.classList.remove('active');
    
    personalCenterModal.style.display = 'block';
}

function hidePersonalCenterModal() {
    personalCenterModal.style.display = 'none';
}

// (★★★ v7-M2 新增：Tab 切換邏輯 ★★★)
function handlePcTabClick(tabName) {
    if (tabName === 'info') {
        pc_tab_info.classList.add('active');
        pc_content_info.classList.add('active');
        pc_tab_deposit.classList.remove('active');
        pc_content_deposit.classList.remove('active');
    } else if (tabName === 'deposit') {
        pc_tab_info.classList.remove('active');
        pc_content_info.classList.remove('active');
        pc_tab_deposit.classList.add('active');
        pc_content_deposit.classList.add('active');
    }
}
// (★★★ v7-M2 新增：複製地址邏輯 ★★★)
function copyTronAddress() {
    if (!navigator.clipboard) {
        notyf.error('您的瀏覽器不支持複製功能');
        return;
    }
    navigator.clipboard.writeText(pc_tron_address.value).then(() => {
        notyf.success('TRC20 地址已複製');
    }, (err) => {
        notyf.error('複製失敗');
        console.error('Failed to copy text: ', err);
    });
}


// --- (★★★ M5 核心：實作下注功能 ★★★) ---
async function handleConfirmBet() {
    if (isBetting) {
        notyf.error('正在處理上一筆下注，請稍候...');
        return;
    }

    const choice = document.querySelector('input[name="flipChoice"]:checked')?.value;
    const amount = parseFloat(betAmountInput.value);

    if (!choice) {
        notyf.error('請選擇正面或反面');
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        notyf.error('請輸入有效的下注金額');
        return;
    }
    if (currentUser && amount > parseFloat(currentUser.balance)) {
         notyf.error('餘額不足');
        return;
    }

    isBetting = true;
    confirmBetBtn.disabled = true;
    confirmBetBtn.innerText = '下注中...';
    document.getElementById('coin-flipper').classList.add('flipping');
    notyf.success('注單已提交，正在等待鏈上開獎...');

    try {
        // (★★★ 關鍵：調用 API 並等待完整的結算結果 ★★★)
        const settledBet = await api.placeBet(jwtToken, choice, amount);
        
        // (API 成功返回 = 結算完成)
        console.log('Bet settled:', settledBet);
        
        // (更新餘額 (註：Socket.IO 也會更新，但 API 回傳更快))
        // (我們直接使用 API 返回的注單來判斷，因為 user_info_updated 可能延遲)
        if (settledBet.status === 'won') {
            const newBalance = parseFloat(currentUser.balance) - parseFloat(settledBet.amount) + (parseFloat(settledBet.amount) * settledBet.payout_multiplier);
            currentUser.balance = newBalance;
            notyf.success(`恭喜中獎！贏得 ${parseFloat(settledBet.amount) * settledBet.payout_multiplier} USDT`);
        } else if (settledBet.status === 'lost') {
            currentUser.balance = parseFloat(currentUser.balance) - parseFloat(settledBet.amount);
            notyf.error('可惜，未中獎');
        }
        
        // (觸發連勝/餘額 UI 更新)
        // (後端 BetQueueService 會發送 'stats_updated' 和 'user_info_updated'，我們這裡手動更新以求即時)
        updateUI(); 
        
        // (顯示硬幣結果)
        const outcome = (parseInt(settledBet.tx_hash.slice(-1), 16) % 2 === 0) ? 'head' : 'tail';
        showCoinResult(outcome); // (假設 showCoinResult 會停止動畫)

    } catch (error) {
        // (API 失敗 = 下注失敗)
        console.warn('Bet failed:', error.message); // (改用 warn)
        
        // (★★★ M-Fix 2 修改 ★★★)
        // (400 餘額不足, 401 Token 過期)
        if (error.status === 400 || error.status === 401) {
             notyf.open({
                type: 'warning',
                message: `下注失敗：${error.message}`
            });
        } else {
            notyf.error(`下注失敗：${error.message}`);
        }
        
        document.getElementById('coin-flipper').classList.remove('flipping');
        
    } finally {
        isBetting = false;
        confirmBetBtn.disabled = false;
        confirmBetBtn.innerText = '确认下注';
    }
}

/**
 * (★★★ M5 新增：顯示硬幣結果的輔助函數 ★★★)
 */
function showCoinResult(result) { // 'head' or 'tail'
    const coin = document.getElementById('coin-flipper');
    coin.classList.remove('flipping');
    
    if (result === 'head') {
        coin.classList.remove('show-tail');
        coin.classList.add('show-head');
    } else {
        coin.classList.remove('show-head');
        coin.classList.add('show-tail');
    }
    // (我們不再需要 v1 的 2 秒後重置，因為下次點擊會自動加上 flipping)
}

// --- 應用程式啟動器 (★★★ v7-M2 修改 ★★★) ---
function initializeApp() {
    console.log("✅ [v7-M2] App initializing...");
    // 獲取所有 DOM 元素
    confirmBetBtn = document.getElementById('confirmBetBtn'); 
    betAmountInput = document.getElementById('betAmount'); 
    userStreakDisplay = document.getElementById('userStreakDisplay');
    userMaxStreakDisplay = document.getElementById('userMaxStreakDisplay');

    // (Auth 元素)
    loginBtn = document.getElementById('loginBtn');
    registerBtn = document.getElementById('registerBtn');
    logoutBtn = document.getElementById('logoutBtn');
    userInfoDisplay = document.getElementById('userInfoDisplay');
    usernameDisplay = document.getElementById('usernameDisplay');
    balanceDisplay = document.getElementById('balanceDisplay');
    
    // (登入 Modal)
    loginModal = document.getElementById('loginModal');
    closeLoginModalBtn = document.getElementById('closeLoginModalBtn');
    cancelLoginBtn = document.getElementById('cancelLoginBtn');
    confirmLoginBtn = document.getElementById('confirmLoginBtn');
    loginUsernameInput = document.getElementById('loginUsernameInput');
    loginPasswordInput = document.getElementById('loginPasswordInput');

    // (註冊 Modal)
    registerModal = document.getElementById('registerModal');
    closeRegisterModalBtn = document.getElementById('closeRegisterModalBtn');
    cancelRegisterBtn = document.getElementById('cancelRegisterBtn');
    confirmRegisterBtn = document.getElementById('confirmRegisterBtn');
    registerUsernameInput = document.getElementById('registerUsernameInput');
    registerPasswordInput = document.getElementById('registerPasswordInput');
    registerPasswordConfirmInput = document.getElementById('registerPasswordConfirmInput');
    
    // (★★★ v7-M2 修改：個人中心 Modal ★★★)
    personalCenterBtn = document.getElementById('personalCenterBtn');
    personalCenterModal = document.getElementById('personalCenterModal');
    closePersonalCenterModalBtn = document.getElementById('closePersonalCenterModalBtn');
    pc_cancelBtn = document.getElementById('pc_cancelBtn');
    // (Tab 1)
    pc_userId = document.getElementById('pc_userId');
    pc_username = document.getElementById('pc_username');
    pc_level = document.getElementById('pc_level');
    pc_maxStreak = document.getElementById('pc_maxStreak');
    pc_inviteCode = document.getElementById('pc_inviteCode');
    pc_referrerCode = document.getElementById('pc_referrerCode');
    // (Tab 2)
    pc_tab_info = document.getElementById('pc_tab_info');
    pc_tab_deposit = document.getElementById('pc_tab_deposit');
    pc_content_info = document.getElementById('pc_content_info');
    pc_content_deposit = document.getElementById('pc_content_deposit');
    pc_tron_address = document.getElementById('pc_tron_address');
    pc_copy_tron_btn = document.getElementById('pc_copy_tron_btn');


    // 綁定 Auth 事件
    loginBtn.addEventListener('click', showLoginModal);
    registerBtn.addEventListener('click', showRegisterModal);
    logoutBtn.addEventListener('click', handleLogout);
    
    // 綁定 Modal 關閉事件
    closeLoginModalBtn.addEventListener('click', hideLoginModal);
    cancelLoginBtn.addEventListener('click', hideLoginModal);
    closeRegisterModalBtn.addEventListener('click', hideRegisterModal);
    cancelRegisterBtn.addEventListener('click', hideRegisterModal);
    
    // 綁定 Modal 確認事件
    confirmLoginBtn.addEventListener('click', handleLogin);
    confirmRegisterBtn.addEventListener('click', handleRegister);
    
    // (★★★ v7-M2 修改：綁定個人中心 ★★★)
    personalCenterBtn.addEventListener('click', showPersonalCenterModal);
    closePersonalCenterModalBtn.addEventListener('click', hidePersonalCenterModal);
    pc_cancelBtn.addEventListener('click', hidePersonalCenterModal);
    // (綁定 Tab 切換)
    pc_tab_info.addEventListener('click', () => handlePcTabClick('info'));
    pc_tab_deposit.addEventListener('click', () => handlePcTabClick('deposit'));
    // (綁定複製按鈕)
    pc_copy_tron_btn.addEventListener('click', copyTronAddress);


    // 綁定遊戲事件
    confirmBetBtn.addEventListener('click', handleConfirmBet); // (目前是佔位符)
    
    // (點擊 Modal 外部灰色區域也可關閉)
    window.addEventListener('click', (event) => {
        if (event.target == loginModal) hideLoginModal();
        if (event.target == registerModal) hideRegisterModal();
        if (event.target == personalCenterModal) hidePersonalCenterModal();
    });

    // 啟動 App
    autoLogin(); // (會自動載入排行榜)
}

// --- 程式入口 (v6 不變) ---
function waitForSocketIO() {
    if (typeof window.io !== 'undefined') {
        initializeApp();
    } else {
        console.log("⏳ Waiting for Socket.io Client to load...");
        setTimeout(waitForSocketIO, 100);
    }
}
document.addEventListener('DOMContentLoaded', waitForSocketIO);