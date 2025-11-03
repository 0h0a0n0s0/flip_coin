// 檔案: app.js (★★★ v6.1 中心化 Auth 版 ★★★)

// (★★★ v6 導入：只導入需要的 API ★★★)
import { renderHistory } from './modules/history.js';
import * as api from './modules/api.js'; 
// (★★★ v6 移除：BrowserExtensionWalletService 和 config.js ★★★)

// --- Notyf 實例化 (不變) ---
const notyf = new Notyf({
    duration: 5000,
    position: { x: 'right', y: 'top' },
    dismissible: true,
    types: [ /* ... (不變) ... */ ]
});

// --- 全局狀態 (★★★ v6 修改 ★★★) ---
let jwtToken = null;      // (取代 walletService)
let currentUser = null; // (取代 currentAccount)
let socket = null;

// (遊戲元素)
let confirmBetBtn, betAmountInput, userStreakDisplay, userMaxStreakDisplay;
// (Auth 元素)
let loginBtn, registerBtn, logoutBtn, userInfoDisplay, usernameDisplay, balanceDisplay;
// (登入 Modal)
let loginModal, closeLoginModalBtn, cancelLoginBtn, confirmLoginBtn, loginUsernameInput, loginPasswordInput;
// (註冊 Modal)
let registerModal, closeRegisterModalBtn, cancelRegisterBtn, confirmRegisterBtn, registerUsernameInput, registerPasswordInput, registerPasswordConfirmInput;
// (個人中心 Modal)
let personalCenterBtn, personalCenterModal, closePersonalCenterModalBtn, pc_cancelBtn;
let pc_userId, pc_username, pc_level, pc_maxStreak, pc_inviteCode, pc_referrerCode;


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
        // (★★★ v6 移除：不再需要 register 事件 ★★★)
    });
    
    socket.on('connect_error', (err) => {
        console.error('[Socket.io] Connection Error:', err.message);
        if (err.message === 'Authentication error: Invalid token') {
            // Token 過期或無效，強制登出
            handleLogout();
            notyf.error('連線已過期，請重新登入。');
        }
    });

    // (★★★ v6 佔位符：下注相關的 socket 監聽，將在 v6.2 中實作 ★★★)
    socket.on('bet_updated', (betData) => {
        console.log('[Socket.io] Received bet update:', betData);
        // (v6.2 待辦：停止轉盤、彈窗、更新歷史)
    });
    socket.on('stats_updated', (stats) => {
        console.log('[Socket.io] Received stats update:', stats);
        if (currentUser) {
            currentUser.current_streak = stats.current_streak;
            currentUser.max_streak = stats.max_streak;
            updateUI(); // (更新 UI 上的連勝)
        }
    });
    socket.on('user_info_updated', (fullUser) => {
        console.log('[Socket.io] Received FULL user info update:', fullUser);
        if (currentUser && currentUser.id === fullUser.id) {
            currentUser = fullUser;
            updateUI(); // (更新餘額、等級等)
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
        balanceDisplay.innerText = parseFloat(currentUser.balance || 0).toFixed(2); // 顯示平台餘額

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
        
        // (直接設定 token 和 user)
        localStorage.setItem('jwt_token', token);
        jwtToken = token;
        currentUser = user;
        
        updateUI();
        initializeSocket(token);
        await renderHistory(token);
        
    } catch (error) {
        notyf.error(`註冊失敗：${error.message}`);
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
         notyf.error(`登入失敗：${error.message}`);
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
    
    // (填充資訊)
    pc_userId.innerText = currentUser.user_id;
    pc_username.innerText = currentUser.username;
    pc_level.innerText = `Level ${currentUser.level}`;
    pc_maxStreak.innerText = currentUser.max_streak;
    pc_inviteCode.innerText = currentUser.invite_code || 'N/A';
    pc_referrerCode.innerText = currentUser.referrer_code || '(未綁定)';
    
    // (v6.3 待辦：顯示充值/提現表單)
    
    personalCenterModal.style.display = 'block';
}
function hidePersonalCenterModal() {
    personalCenterModal.style.display = 'none';
}

// --- v6.2 佔位符 ---
async function handleConfirmBet() {
    notyf.error('下注功能 (v6.2) 正在重構中，即將上線！');
}

// --- 應用程式啟動器 (★★★ v6 重構 ★★★) ---
function initializeApp() {
    console.log("✅ [v6] App initializing...");
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
    
    // (個人中心 Modal)
    personalCenterBtn = document.getElementById('personalCenterBtn');
    personalCenterModal = document.getElementById('personalCenterModal');
    closePersonalCenterModalBtn = document.getElementById('closePersonalCenterModalBtn');
    pc_cancelBtn = document.getElementById('pc_cancelBtn');
    pc_userId = document.getElementById('pc_userId');
    pc_username = document.getElementById('pc_username');
    pc_level = document.getElementById('pc_level');
    pc_maxStreak = document.getElementById('pc_maxStreak');
    pc_inviteCode = document.getElementById('pc_inviteCode');
    pc_referrerCode = document.getElementById('pc_referrerCode');

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
    
    // 綁定個人中心
    personalCenterBtn.addEventListener('click', showPersonalCenterModal);
    closePersonalCenterModalBtn.addEventListener('click', hidePersonalCenterModal);
    pc_cancelBtn.addEventListener('click', hidePersonalCenterModal);

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

// --- 程式入口 (★★★ v6 修改：不再等待 Ethers.js ★★★) ---
function waitForSocketIO() {
    if (typeof window.io !== 'undefined') {
        initializeApp();
    } else {
        console.log("⏳ Waiting for Socket.io Client to load...");
        setTimeout(waitForSocketIO, 100);
    }
}
document.addEventListener('DOMContentLoaded', waitForSocketIO);