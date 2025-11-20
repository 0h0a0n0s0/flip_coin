// 档案: app.js (★★★ 完整版 - 包含出款功能 ★★★)

import { renderHistory } from './modules/history.js';
import * as api from './modules/api.js'; 

// --- Notyf 實例化 (不变) ---
const notyf = new Notyf({
    duration: 3500,
    position: { x: 'center', y: 'center' },
    ripple: false,
    dismissible: false,
    types: [
        {
            type: 'warning',
            background: 'rgba(0, 0, 0, 0.85)',
            icon: false,
            className: 'notyf-toast'
        },
        {
            type: 'success',
            background: 'rgba(0, 0, 0, 0.85)',
            icon: false,
            className: 'notyf-toast'
        },
        {
            type: 'error',
            background: 'rgba(0, 0, 0, 0.85)',
            icon: false,
            className: 'notyf-toast'
        }
    ]
});

let notyfDismissReady = false;
const armNotyfDismiss = () => {
    notyfDismissReady = false;
    setTimeout(() => { notyfDismissReady = true; }, 200);
};
['success', 'error', 'open'].forEach(method => {
    if (typeof notyf[method] === 'function') {
        const original = notyf[method].bind(notyf);
        notyf[method] = (...args) => {
            armNotyfDismiss();
            return original(...args);
        };
    }
});
document.addEventListener('click', (event) => {
    const activeToast = document.querySelector('.notyf__toast');
    if (!activeToast) return;
    if (!notyfDismissReady) return;
    if (event.target.closest('.notyf__toast')) return;
    notyf.dismissAll();
});

// --- 全局狀态 (新增) ---
let jwtToken = null;
let currentUser = null;
let socket = null;

// (遊戏元素)
let confirmBetBtn, betAmountInput, userStreakDisplay, userMaxStreakDisplay;
// (Auth 元素)
let loginBtn, registerBtn, logoutBtn, userInfoDisplay, usernameDisplay, balanceDisplay;
// (登入 Modal)
let loginModal, closeLoginModalBtn, cancelLoginBtn, confirmLoginBtn, loginUsernameInput, loginPasswordInput;
// (注册 Modal)
let registerModal, closeRegisterModalBtn, cancelRegisterBtn, confirmRegisterBtn, registerUsernameInput, registerPasswordInput, registerPasswordConfirmInput;
// (個人中心 Modal)
let personalCenterBtn, personalCenterModal, closePersonalCenterModalBtn, pc_cancelBtn;
// (Tab 1: Info)
let pc_userId, pc_username, pc_level, pc_maxStreak, pc_inviteCode, pc_referrerCode;
let pc_nicknameInput, pc_saveNicknameBtn, pc_referrerSection, pc_referrerInput, pc_bindReferrerBtn;
// (Tab 2: Deposit)
let pc_tab_info, pc_tab_deposit, pc_content_info, pc_content_deposit;
let pc_tron_address, pc_copy_tron_btn;
let pc_evm_address, pc_copy_evm_btn, pc_deposit_history_list;
// (★★★ 新增 Tab 3: Withdraw ★★★)
let pc_tab_withdraw, pc_content_withdraw;
let pc_withdrawal_pwd_status, pc_withdrawal_pwd_text, pc_set_withdrawal_pwd_btn, pc_change_withdrawal_pwd_btn;
let pc_withdraw_chain, pc_withdraw_address, pc_withdraw_amount, pc_withdraw_password, pc_submit_withdrawal_btn;
let pc_withdrawal_history_list;
// (★★★ 新增 密码 Modals ★★★)
let setWithdrawalPwdModal, closeSetPwdModalBtn, cancelSetPwdBtn, confirmSetPwdBtn;
let set_login_password, set_new_password, set_confirm_password;
let changeWithdrawalPwdModal, closeChangePwdModalBtn, cancelChangePwdBtn, confirmChangePwdBtn;
let change_old_password, change_new_password, change_confirm_password;

let isBetting = false; 

// --- Socket 連线 (修改) ---
function initializeSocket(token) {
    if (socket) socket.disconnect();
    
    // (使用相对路径，Nginx 会自动处理)
    socket = io({
        auth: {
            token: token
        }
    });

    socket.on('connect', () => {
        console.log(`[Socket.io] Connected with token.`);
    });
    
    socket.on('connect_error', (err) => {
        console.error('[Socket.io] Connection Error:', err.message);
        if (err.message === 'Authentication error: Invalid token' || err.message === 'Authentication error: User not found or disabled.') {
            handleLogout();
            notyf.error('連线已过期，请重新登入。');
        }
    });
    
    socket.on('bet_updated', (betData) => {
        console.log('[Socket.io] Received bet update (for history):', betData);
        if (jwtToken) {
            renderHistory(jwtToken);
            // (★★★ 如果充值页开启，也刷新充值历史 ★★★)
            if (personalCenterModal.style.display === 'block' && pc_content_deposit.classList.contains('active')) {
                fetchDepositHistory(); // (我们将在下面新增此函数)
            }
            // (保留原有的提款历史刷新逻辑)
            if (personalCenterModal.style.display === 'block' && pc_content_withdraw.classList.contains('active')) {
                fetchWithdrawalHistory();
            }
        }
    });

    // (★★★ 修改：确保 user_info_updated 会更新 currentUser ★★★)
    socket.on('user_info_updated', (fullUser) => {
        console.log('[Socket.io] Received FULL user info update:', fullUser);
        if (currentUser && currentUser.id === fullUser.id) {
            const oldBalance = currentUser.balance;
            currentUser = fullUser; // (★★★ 关键：更新全局 currentUser ★★★)
            updateUI();
            
            // 只有在非下注狀态 且 余额真的变动时 才弹出提示
            if (!isBetting && oldBalance !== fullUser.balance) {
                notyf.success(`帐户已更新！新余额: ${parseFloat(fullUser.balance).toFixed(2)} USDT`);
            }
        }
    });
    socket.on('leaderboard_updated', (leaderboardData) => {
        console.log('[Socket.io] Received leaderboard update:', leaderboardData);
        renderLeaderboardData(leaderboardData);
    });
    socket.on('disconnect', () => console.log('[Socket.io] Disconnected.'));
}


// --- 渲染排行榜 (不变) ---
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
            <span>🔥 ${player.max_streak} 連胜</span>
        `;
        listEl.appendChild(li);
    });
}
async function renderLeaderboard() {
    const listEl = document.getElementById('leaderboardList');
    if (!listEl) return;
    listEl.innerHTML = '<li>Loading...</li>'; 
    try {
        const leaderboardData = await api.getLeaderboard();
        renderLeaderboardData(leaderboardData);
    } catch (error) {
        console.error("Failed to render leaderboard:", error);
        listEl.innerHTML = '<li>无法加载排行榜</li>';
    }
}

// --- UI 更新 (★★★ 修改 ★★★) ---
function updateUI() {
    if (currentUser && jwtToken) {
        // --- 登入狀态 ---
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        
        userInfoDisplay.style.display = 'inline-block';
        personalCenterBtn.style.display = 'block';
        logoutBtn.style.display = 'block';

        usernameDisplay.innerText = currentUser.nickname || currentUser.username;
        const balance = typeof currentUser.balance === 'string' 
            ? parseFloat(currentUser.balance) 
            : currentUser.balance;
        balanceDisplay.innerText = (balance || 0).toFixed(2); 

        // (更新連胜)
        const streak = currentUser.current_streak || 0;
        userStreakDisplay.style.display = 'inline-block'; 
        if (streak > 0) {
            userStreakDisplay.innerText = `🔥 連胜 ${streak} 场`;
            userStreakDisplay.style.backgroundColor = '#e0f8e0';
            userStreakDisplay.style.color = '#006400';
        } else if (streak < 0) {
            userStreakDisplay.innerText = `🥶 連败 ${Math.abs(streak)} 场`;
            userStreakDisplay.style.backgroundColor = '#f8e0e0';
            userStreakDisplay.style.color = '#a00000';
        } else {
            userStreakDisplay.innerText = `😐 連胜 0 场`;
            userStreakDisplay.style.backgroundColor = '#eee';
            userStreakDisplay.style.color = '#333';
        }
        const maxStreak = currentUser.max_streak || 0;
        userMaxStreakDisplay.style.display = 'inline-block'; 
        userMaxStreakDisplay.innerText = `🏆 最高連胜: ${maxStreak}`;

        // (★★★ 新增：更新個人中心内的提款密码狀态 ★★★)
        // (确保 currentUser.has_withdrawal_password 存在)
        if (currentUser.has_withdrawal_password) {
            pc_withdrawal_pwd_text.innerText = '已设置';
            pc_withdrawal_pwd_text.style.color = '#67c23a';
            pc_set_withdrawal_pwd_btn.style.display = 'none';
            pc_change_withdrawal_pwd_btn.style.display = 'inline-block';
        } else {
            pc_withdrawal_pwd_text.innerText = '未设置';
            pc_withdrawal_pwd_text.style.color = '#f56c6c';
            pc_set_withdrawal_pwd_btn.style.display = 'inline-block';
            pc_change_withdrawal_pwd_btn.style.display = 'none';
        }

    } else {
        // --- 登出狀态 ---
        loginBtn.style.display = 'block';
        registerBtn.style.display = 'block';
        
        userInfoDisplay.style.display = 'none';
        personalCenterBtn.style.display = 'none';
        logoutBtn.style.display = 'none';

        userStreakDisplay.style.display = 'none';
        userMaxStreakDisplay.style.display = 'none';
        
        document.getElementById('historyList').innerHTML = '<li>登入後以查看历史记录</li>';
    }
}

// --- Auth 处理函数 (不变) ---
function showLoginModal() { loginModal.style.display = 'block'; }
function hideLoginModal() { loginModal.style.display = 'none'; }
function showRegisterModal() { registerModal.style.display = 'block'; }
function hideRegisterModal() { registerModal.style.display = 'none'; }

async function handleRegister() {
    const username = registerUsernameInput.value;
    const password = registerPasswordInput.value;
    const confirmPassword = registerPasswordConfirmInput.value;

    if (password !== confirmPassword) {
        notyf.error('两次输入的密码不一致');
        return;
    }
    if (username.length < 3 || username.length > 20) {
         notyf.error('帐号长度必须在 3-20 字元之间');
        return;
    }
     if (password.length < 6) {
         notyf.error('密码长度至少需要 6 位');
        return;
    }

    const btn = confirmRegisterBtn;
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = '注册中...';
    
    try {
        const { user, token } = await api.register(username, password);
        notyf.success('注册成功！已自动登入。');
        hideRegisterModal();
        
        localStorage.setItem('jwt_token', token);
        jwtToken = token;
        currentUser = user;
        
        updateUI();
        initializeSocket(token);
        await renderHistory(token);
        
    } catch (error) {
        if (error.status === 400) {
            notyf.open({
                type: 'warning', 
                message: `${error.message}` 
            });
        } else {
            notyf.error(`注册失败：${error.message}`);
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
        notyf.error('请输入帐号和密码');
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
        if (error.status === 401) {
            notyf.open({
                type: 'warning',
                message: `${error.message}`
            });
        } else {
            notyf.error(`登入失败：${error.message}`);
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
        currentUser = user; // (★★★ 确保 /me API 返回 has_withdrawal_password ★★★)
        updateUI();
        initializeSocket(token);
        await renderHistory(token);
    } catch (error) {
        console.error('Auto-login failed:', error.message);
        handleLogout();
    }
}

async function autoLogin() {
    const savedToken = localStorage.getItem('jwt_token');
    if (savedToken) {
        console.log('Found saved JWT, attempting to login...');
        jwtToken = savedToken;
        await fetchUserInfo(savedToken);
    } else {
        updateUI(); 
    }
    await renderLeaderboard();
}

// --- 個人中心 (★★★ 修改 ★★★) ---
function showPersonalCenterModal() {
    if (!currentUser) return;
    
    // (Tab 1: 填充基本资讯)
    pc_userId.innerText = currentUser.user_id;
    pc_username.innerText = currentUser.username;
    pc_level.innerText = `Level ${currentUser.level}`;
    pc_maxStreak.innerText = currentUser.max_streak;
    pc_inviteCode.innerText = currentUser.invite_code || 'N/A';
    pc_referrerCode.innerText = currentUser.referrer_code || '(未绑定)';
    pc_tron_address.value = currentUser.tron_deposit_address || '地址生成中...';
    pc_evm_address.value = currentUser.evm_deposit_address || '地址生成中...';
    pc_nicknameInput.value = currentUser.nickname || '';
    pc_referrerInput.value = ''; // (清空推薦码输入)
    
    if (currentUser.referrer_code) {
        pc_referrerSection.style.display = 'none'; // (已绑定，隐藏)
    } else {
        pc_referrerSection.style.display = 'block'; // (未绑定，显示)
    }
    
    // (Tab 2: 填充充值资讯)
    pc_tron_address.value = currentUser.tron_deposit_address || '地址生成中...';
    
    // (重置 Tab 狀态为显示 "基本资讯")
    handlePcTabClick('info');
    
    // (清空提款表单)
    pc_withdraw_chain.value = 'TRC20';
    pc_withdraw_address.value = '';
    pc_withdraw_amount.value = '';
    pc_withdraw_password.value = '';
    
    personalCenterModal.style.display = 'block';
}

function hidePersonalCenterModal() {
    personalCenterModal.style.display = 'none';
}

// (★★★ 修改 Tab 切换逻辑 ★★★)
function handlePcTabClick(tabName) {
    // (先隐藏所有)
    pc_tab_info.classList.remove('active');
    pc_content_info.classList.remove('active');
    pc_tab_deposit.classList.remove('active');
    pc_content_deposit.classList.remove('active');
    pc_tab_withdraw.classList.remove('active');
    pc_content_withdraw.classList.remove('active');

    // (再显示选中的)
    if (tabName === 'info') {
        pc_tab_info.classList.add('active');
        pc_content_info.classList.add('active');
    } else if (tabName === 'deposit') {
        pc_tab_deposit.classList.add('active');
        pc_content_deposit.classList.add('active');
        fetchDepositHistory();
    } else if (tabName === 'withdraw') {
        pc_tab_withdraw.classList.add('active');
        pc_content_withdraw.classList.add('active');
        // (★★★ 切换到提款页时，载入历史纪录 ★★★)
        fetchWithdrawalHistory();
    }
}
// (复制地址逻辑)
function copyTronAddress() {
    if (!navigator.clipboard) {
        notyf.error('您的浏览器不支持复制功能');
        return;
    }
    navigator.clipboard.writeText(pc_tron_address.value).then(() => {
        notyf.success('TRC20 地址已复制');
    }, (err) => {
        notyf.error('复制失败');
        console.error('Failed to copy text: ', err);
    });
}

function copyEvmAddress() {
    if (!navigator.clipboard) {
        notyf.error('您的浏览器不支持复制功能');
        return;
    }
    navigator.clipboard.writeText(pc_evm_address.value).then(() => {
        notyf.success('EVM (0x) 地址已复制');
    }, (err) => {
        notyf.error('复制失败');
        console.error('Failed to copy text: ', err);
    });
}

// (储存昵称)
async function handleSaveNickname() {
    const newNickname = pc_nicknameInput.value.trim();
    if (newNickname.length > 50) {
        notyf.error('昵称长度不能超过 50 個字元');
        return;
    }
    if (!newNickname || newNickname === (currentUser.nickname || '')) {
        notyf.open({ type: 'warning', message: '昵称未变更' });
        return;
    }

    const btn = pc_saveNicknameBtn;
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = '储存中...';

    try {
        const updatedUser = await api.updateNickname(jwtToken, newNickname);
        currentUser = updatedUser; // (更新本地狀态)
        updateUI(); // (更新 Header 显示)
        // (不需要 showPersonalCenterModal，因为弹窗还开著)
        notyf.success('昵称更新成功！');
    } catch (error) {
        notyf.error(`更新失败：${error.message}`);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// (绑定推薦人)
async function handleBindReferrer() {
    const referrerCode = pc_referrerInput.value.trim();
    if (!referrerCode) {
        notyf.error('请输入推薦码');
        return;
    }
    if (referrerCode === currentUser.invite_code) {
        notyf.error('不能绑定自己的邀请码');
        return;
    }

    const btn = pc_bindReferrerBtn;
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = '绑定中...';

    try {
        const updatedUser = await api.bindReferrer(jwtToken, referrerCode);
        currentUser = updatedUser; // (更新本地狀态)
        updateUI(); // (更新 Header 显示)
        showPersonalCenterModal(); // (更新弹窗，将隐藏绑定区块)
        notyf.success('推薦人绑定成功！');
    } catch (error) {
        notyf.open({ type: 'warning', message: `绑定失败：${error.message}` });
    } finally {
        btn.disabled = false;
        btn.innerText = '绑定';
    }
}

// (★★★ 新增：获取充值历史函数 ★★★)
async function fetchDepositHistory() {
    pc_deposit_history_list.innerHTML = '<li>Loading...</li>';
    try {
        const history = await api.getDepositHistory(jwtToken);
        if (history.length === 0) {
            pc_deposit_history_list.innerHTML = '<li>暂無充值记录</li>';
            return;
        }
        pc_deposit_history_list.innerHTML = history.map(item => {
            // (注意：created_at 是发起时间，也是到帐时间，因为 TronListener 是即时上分的)
            const time = new Date(item.created_at).toLocaleString();
            let statusText = '已到帐';
            let statusClass = 'history-status-completed'; // (目前 TronListener 只有 completed 狀态)
            
            // (如果未来 TronListener 更新了 status，這里可以扩展)
            // if (item.status === 'pending') {
            //     statusText = '未到帐';
            //     statusClass = 'history-status-pending';
            // }

            // (★★★ 建立測試网連结的逻辑 ★★★)
            let txLink = '#';
            if (item.tx_hash) {
                if (item.chain === 'TRC20') txLink = `https://nile.tronscan.org/#/transaction/${item.tx_hash}`;
                else if (item.chain === 'BSC') txLink = `https://testnet.bscscan.com/tx/${item.tx_hash}`;
                else if (item.chain === 'ETH') txLink = `https://sepolia.etherscan.io/tx/${item.tx_hash}`;
                // (其他链...)
            }
            const hashDisplay = item.tx_hash_masked || (item.tx_hash ? `${item.tx_hash.substring(0, 10)}...` : '');

            return `
                <li>
                    <span class="history-amount">${item.amount} USDT (${item.chain})</span>
                    <span>时间: ${time}</span>
                    <span class="${statusClass}">狀态: ${statusText}</span>
                    ${item.tx_hash ? `<span>TX: <a href="${txLink}" target="_blank">${hashDisplay}</a></span>` : ''}
                </li>
            `;
        }).join('');
    } catch (error) {
        pc_deposit_history_list.innerHTML = '<li>加载失败</li>';
    }
}

// (★★★ 新增：提款密码相关函数 ★★★)
function showSetPwdModal() { 
    set_login_password.value = '';
    set_new_password.value = '';
    set_confirm_password.value = '';
    setWithdrawalPwdModal.style.display = 'block'; 
}
function hideSetPwdModal() { setWithdrawalPwdModal.style.display = 'none'; }

function showChangePwdModal() { 
    change_old_password.value = '';
    change_new_password.value = '';
    change_confirm_password.value = '';
    changeWithdrawalPwdModal.style.display = 'block'; 
}
function hideChangePwdModal() { changeWithdrawalPwdModal.style.display = 'none'; }

async function handleSubmitSetPwd() {
    const loginPwd = set_login_password.value;
    const newPwd = set_new_password.value;
    const confirmPwd = set_confirm_password.value;
    
    if (newPwd !== confirmPwd) {
        notyf.error('两次输入的新密码不一致'); return;
    }
    if (!loginPwd || newPwd.length < 6) {
        notyf.error('请输入登入密码，且新密码至少 6 位'); return;
    }

    const btn = confirmSetPwdBtn;
    btn.disabled = true; btn.innerText = '设置中...';
    try {
        // (★★★ 确保传遞 jwtToken ★★★)
        await api.setWithdrawalPassword(jwtToken, loginPwd, newPwd);
        notyf.success('提款密码设置成功！');
        hideSetPwdModal();
        // (手动更新本地狀态)
        currentUser.has_withdrawal_password = true;
        updateUI();
    } catch (error) {
        notyf.error(`设置失败：${error.message}`);
    } finally {
        btn.disabled = false; btn.innerText = '确认设置';
    }
}

async function handleSubmitChangePwd() {
    const oldPwd = change_old_password.value;
    const newPwd = change_new_password.value;
    const confirmPwd = change_confirm_password.value;

    if (newPwd !== confirmPwd) {
        notyf.error('两次输入的新密码不一致'); return;
    }
    if (!oldPwd || newPwd.length < 6) {
        notyf.error('请输入旧密码，且新密码至少 6 位'); return;
    }

    const btn = confirmChangePwdBtn;
    btn.disabled = true; btn.innerText = '修改中...';
    try {
        await api.updateWithdrawalPassword(jwtToken, oldPwd, newPwd);
        notyf.success('提款密码修改成功！');
        hideChangePwdModal();
    } catch (error) {
        notyf.error(`修改失败：${error.message}`);
    } finally {
        btn.disabled = false; btn.innerText = '确认修改';
    }
}

// (★★★ 新增：提款相关函数 ★★★)
async function fetchWithdrawalHistory() {
    pc_withdrawal_history_list.innerHTML = '<li>Loading...</li>';
    try {
        const history = await api.getWithdrawalHistory(jwtToken);
        if (history.length === 0) {
            pc_withdrawal_history_list.innerHTML = '<li>暂無提款记录</li>';
            return;
        }
        pc_withdrawal_history_list.innerHTML = history.map(item => {
            const reqTime = new Date(item.request_time).toLocaleString();
            let statusText = item.status;
            let statusClass = `history-status-${item.status}`; // pending, completed, rejected
            
            switch(item.status) {
                case 'pending': statusText = '待審核'; break;
                case 'processing': statusText = '出款中'; break;
                case 'completed': statusText = '出款完成'; break;
                case 'rejected': statusText = `已拒绝 (${item.rejection_reason || 'N/A'})`; break;
            }
            
            // (★★★ 建立測試网連结的逻辑 ★★★)
            let txLink = '#';
            if (item.tx_hash) {
                if (item.chain_type === 'TRC20') txLink = `https://nile.tronscan.org/#/transaction/${item.tx_hash}`;
                else if (item.chain_type === 'BSC') txLink = `https://testnet.bscscan.com/tx/${item.tx_hash}`;
                else if (item.chain_type === 'ETH') txLink = `https://sepolia.etherscan.io/tx/${item.tx_hash}`;
                else if (item.chain_type === 'POLYGON') txLink = `https://mumbai.polygonscan.com/tx/${item.tx_hash}`;
                else if (item.chain_type === 'SOL') txLink = `https://solscan.io/tx/${item.tx_hash}?cluster=testnet`;
            }
            const hashDisplay = item.tx_hash_masked || (item.tx_hash ? `${item.tx_hash.substring(0, 10)}...` : '');
            const addressDisplay = item.address_masked || item.address || '-';

            return `
                <li>
                    <span class="history-amount">${item.amount} USDT (${item.chain_type})</span>
                    <span>地址: ${addressDisplay}</span>
                    <span>时间: ${reqTime}</span>
                    <span class="${statusClass}">狀态: ${statusText}</span>
                    ${item.tx_hash ? `<span>TX: <a href="${txLink}" target="_blank">${hashDisplay}</a></span>` : ''}
                </li>
            `;
        }).join('');
    } catch (error) {
        pc_withdrawal_history_list.innerHTML = '<li>加载失败</li>';
    }
}

async function handleSubmitWithdrawal() {
    const data = {
        chain_type: pc_withdraw_chain.value,
        address: pc_withdraw_address.value.trim(),
        amount: parseFloat(pc_withdraw_amount.value),
        withdrawal_password: pc_withdraw_password.value,
    };

    if (!data.chain_type || !data.address || !data.amount || data.amount <= 0 || !data.withdrawal_password) {
        notyf.error('请填寫所有提款栏位');
        return;
    }
    
    const btn = pc_submit_withdrawal_btn;
    btn.disabled = true; btn.innerText = '提交中...';
    
    try {
        const result = await api.requestWithdrawal(jwtToken, data);
        notyf.success(result.message || '提款请求已提交！');
        
        // (清空表单)
        pc_withdraw_address.value = '';
        pc_withdraw_amount.value = '';
        pc_withdraw_password.value = '';
        
        // (刷新余额和历史)
        // (不需要手动 fetchUserInfo，後端 API 会透过 Socket.IO 推送 user_info_updated)
        await fetchWithdrawalHistory();
        if (pc_content_deposit.classList.contains('active')) {
            await fetchDepositHistory();
        }

    } catch (error) {
        notyf.error(`提交失败：${error.message}`);
    } finally {
        btn.disabled = false; btn.innerText = '确认提款';
    }
}


// --- (M5 核心：實作下注功能) (不变) ---
async function handleConfirmBet() {
    if (isBetting) {
        notyf.error('正在处理上一笔下注，请稍候...');
        return;
    }

    const choice = document.querySelector('input[name="flipChoice"]:checked')?.value;
    const amount = parseFloat(betAmountInput.value);

    if (!choice) {
        notyf.error('请选择正面或反面');
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        notyf.error('请输入有效的下注金额');
        return;
    }
    if (currentUser && amount > parseFloat(currentUser.balance)) {
         notyf.error('余额不足');
        return;
    }

    isBetting = true;
    confirmBetBtn.disabled = true;
    confirmBetBtn.innerText = '下注中...';
    document.getElementById('coin-flipper').classList.add('flipping');
    notyf.success('注单已提交，正在等待链上开奖...');

    try {
        const settledBet = await api.placeBet(jwtToken, choice, amount);
        
        console.log('Bet settled:', settledBet);
        
        // (余额更新将由 Socket.IO 的 'user_info_updated' 事件统一处理)

        if (settledBet.status === 'won') {
            notyf.success(`恭喜中奖！`);
        } else if (settledBet.status === 'lost') {
            notyf.error('可惜，未中奖');
        }
        
        // (显示硬币结果)
        const outcome = (parseInt(settledBet.tx_hash.slice(-1), 16) % 2 === 0) ? 'head' : 'tail';
        showCoinResult(outcome);

    } catch (error) {
        console.warn('Bet failed:', error.message); 
        
        if (error.status === 400 || error.status === 401) {
             notyf.open({
                type: 'warning',
                message: `下注失败：${error.message}`
            });
        } else {
            notyf.error(`下注失败：${error.message}`);
        }
        
        document.getElementById('coin-flipper').classList.remove('flipping');
        
    } finally {
        isBetting = false;
        confirmBetBtn.disabled = false;
        confirmBetBtn.innerText = '确认下注';
    }
}

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
}

// --- 应用程式启动器 (★★★ 修改 ★★★) ---
function initializeApp() {
    console.log("✅ [v7-Withdrawal] App initializing...");
    // 获取所有 DOM 元素
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

    // (注册 Modal)
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
    // (Tab 1)
    pc_userId = document.getElementById('pc_userId');
    pc_username = document.getElementById('pc_username');
    pc_level = document.getElementById('pc_level');
    pc_maxStreak = document.getElementById('pc_maxStreak');
    pc_inviteCode = document.getElementById('pc_inviteCode');
    pc_referrerCode = document.getElementById('pc_referrerCode');
    
    pc_nicknameInput = document.getElementById('pc_nicknameInput');
    pc_saveNicknameBtn = document.getElementById('pc_saveNicknameBtn');
    pc_referrerSection = document.getElementById('pc_referrerSection');
    pc_referrerInput = document.getElementById('pc_referrerInput');
    pc_bindReferrerBtn = document.getElementById('pc_bindReferrerBtn');

    // (Tab 2)
    pc_tab_info = document.getElementById('pc_tab_info');
    pc_tab_deposit = document.getElementById('pc_tab_deposit');
    pc_content_info = document.getElementById('pc_content_info');
    pc_content_deposit = document.getElementById('pc_content_deposit');
    pc_tron_address = document.getElementById('pc_tron_address');
    pc_copy_tron_btn = document.getElementById('pc_copy_tron_btn');
    pc_evm_address = document.getElementById('pc_evm_address');
    pc_copy_evm_btn = document.getElementById('pc_copy_evm_btn');
    pc_deposit_history_list = document.getElementById('pc_deposit_history_list');
    
    // (★★★ 新增获取 Tab 3 (提款) 的 DOM ★★★)
    pc_tab_withdraw = document.getElementById('pc_tab_withdraw');
    pc_content_withdraw = document.getElementById('pc_content_withdraw');
    pc_withdrawal_pwd_status = document.getElementById('pc_withdrawal_pwd_status');
    pc_withdrawal_pwd_text = document.getElementById('pc_withdrawal_pwd_text');
    pc_set_withdrawal_pwd_btn = document.getElementById('pc_set_withdrawal_pwd_btn');
    pc_change_withdrawal_pwd_btn = document.getElementById('pc_change_withdrawal_pwd_btn');
    pc_withdraw_chain = document.getElementById('pc_withdraw_chain');
    pc_withdraw_address = document.getElementById('pc_withdraw_address');
    pc_withdraw_amount = document.getElementById('pc_withdraw_amount');
    pc_withdraw_password = document.getElementById('pc_withdraw_password');
    pc_submit_withdrawal_btn = document.getElementById('pc_submit_withdrawal_btn');
    pc_withdrawal_history_list = document.getElementById('pc_withdrawal_history_list');

    // (★★★ 新增获取密码 Modals 的 DOM ★★★)
    setWithdrawalPwdModal = document.getElementById('setWithdrawalPwdModal');
    closeSetPwdModalBtn = document.getElementById('closeSetPwdModalBtn');
    cancelSetPwdBtn = document.getElementById('cancelSetPwdBtn');
    confirmSetPwdBtn = document.getElementById('confirmSetPwdBtn');
    set_login_password = document.getElementById('set_login_password');
    set_new_password = document.getElementById('set_new_password');
    set_confirm_password = document.getElementById('set_confirm_password');

    changeWithdrawalPwdModal = document.getElementById('changeWithdrawalPwdModal');
    closeChangePwdModalBtn = document.getElementById('closeChangePwdModalBtn');
    cancelChangePwdBtn = document.getElementById('cancelChangePwdBtn');
    confirmChangePwdBtn = document.getElementById('confirmChangePwdBtn');
    change_old_password = document.getElementById('change_old_password');
    change_new_password = document.getElementById('change_new_password');
    change_confirm_password = document.getElementById('change_confirm_password');


    // 绑定 Auth 事件
    loginBtn.addEventListener('click', showLoginModal);
    registerBtn.addEventListener('click', showRegisterModal);
    logoutBtn.addEventListener('click', handleLogout);
    
    // 绑定 Modal 关闭事件
    closeLoginModalBtn.addEventListener('click', hideLoginModal);
    cancelLoginBtn.addEventListener('click', hideLoginModal);
    closeRegisterModalBtn.addEventListener('click', hideRegisterModal);
    cancelRegisterBtn.addEventListener('click', hideRegisterModal);
    
    // 绑定 Modal 确认事件
    confirmLoginBtn.addEventListener('click', handleLogin);
    confirmRegisterBtn.addEventListener('click', handleRegister);
    
    // (绑定個人中心)
    personalCenterBtn.addEventListener('click', showPersonalCenterModal);
    closePersonalCenterModalBtn.addEventListener('click', hidePersonalCenterModal);
    pc_cancelBtn.addEventListener('click', hidePersonalCenterModal);
    // (绑定 Tab 切换)
    pc_tab_info.addEventListener('click', () => handlePcTabClick('info'));
    pc_tab_deposit.addEventListener('click', () => handlePcTabClick('deposit'));
    pc_tab_withdraw.addEventListener('click', () => handlePcTabClick('withdraw')); // (★★★ 新增 ★★★)
    // (绑定复制按钮)
    pc_copy_tron_btn.addEventListener('click', copyTronAddress);
    pc_copy_evm_btn.addEventListener('click', copyEvmAddress);
    // (绑定個人中心表单事件)
    pc_saveNicknameBtn.addEventListener('click', handleSaveNickname);
    pc_bindReferrerBtn.addEventListener('click', handleBindReferrer);

    // (★★★ 新增绑定 ★★★)
    pc_set_withdrawal_pwd_btn.addEventListener('click', showSetPwdModal);
    pc_change_withdrawal_pwd_btn.addEventListener('click', showChangePwdModal);
    pc_submit_withdrawal_btn.addEventListener('click', handleSubmitWithdrawal);
    
    // (密码 Modal 绑定)
    closeSetPwdModalBtn.addEventListener('click', hideSetPwdModal);
    cancelSetPwdBtn.addEventListener('click', hideSetPwdModal);
    confirmSetPwdBtn.addEventListener('click', handleSubmitSetPwd);
    
    closeChangePwdModalBtn.addEventListener('click', hideChangePwdModal);
    cancelChangePwdBtn.addEventListener('click', hideChangePwdModal);
    confirmChangePwdBtn.addEventListener('click', handleSubmitChangePwd);

    // 绑定遊戏事件
    confirmBetBtn.addEventListener('click', handleConfirmBet);
    
    // (点击 Modal 外部灰色区域也可关闭)
    window.addEventListener('click', (event) => {
        if (event.target == loginModal) hideLoginModal();
        if (event.target == registerModal) hideRegisterModal();
        if (event.target == personalCenterModal) hidePersonalCenterModal();
        if (event.target == setWithdrawalPwdModal) hideSetPwdModal(); // (★★★ 新增 ★★★)
        if (event.target == changeWithdrawalPwdModal) hideChangePwdModal(); // (★★★ 新增 ★★★)
    });

    // 启动 App
    autoLogin();
}

// --- 程式入口 (不变) ---
function waitForSocketIO() {
    if (typeof window.io !== 'undefined') {
        initializeApp();
    } else {
        console.log("⏳ Waiting for Socket.io Client to load...");
        setTimeout(waitForSocketIO, 100);
    }
}
document.addEventListener('DOMContentLoaded', waitForSocketIO);