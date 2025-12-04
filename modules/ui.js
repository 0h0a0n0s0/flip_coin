// UI 操作模块
// 集中管理所有 DOM 操作和 UI 更新

import { getCurrentUser, getToken } from './state.js';

// DOM 元素引用（延迟初始化）
let domElements = {};

/**
 * 初始化 DOM 元素引用
 */
export function initializeDOMElements() {
    domElements = {
        // 游戏元素
        confirmBetBtn: document.getElementById('confirmBetBtn'),
        betAmountInput: document.getElementById('betAmount'),
        userStreakDisplay: document.getElementById('userStreakDisplay'),
        userMaxStreakDisplay: document.getElementById('userMaxStreakDisplay'),
        
        // Auth 元素
        loginBtn: document.getElementById('loginBtn'),
        registerBtn: document.getElementById('registerBtn'),
        logoutBtn: document.getElementById('logoutBtn'),
        userInfoDisplay: document.getElementById('userInfoDisplay'),
        usernameDisplay: document.getElementById('usernameDisplay'),
        balanceDisplay: document.getElementById('balanceDisplay'),
        
        // 登录 Modal
        loginModal: document.getElementById('loginModal'),
        closeLoginModalBtn: document.getElementById('closeLoginModalBtn'),
        cancelLoginBtn: document.getElementById('cancelLoginBtn'),
        confirmLoginBtn: document.getElementById('confirmLoginBtn'),
        loginUsernameInput: document.getElementById('loginUsernameInput'),
        loginPasswordInput: document.getElementById('loginPasswordInput'),
        
        // 注册 Modal
        registerModal: document.getElementById('registerModal'),
        closeRegisterModalBtn: document.getElementById('closeRegisterModalBtn'),
        cancelRegisterBtn: document.getElementById('cancelRegisterBtn'),
        confirmRegisterBtn: document.getElementById('confirmRegisterBtn'),
        registerUsernameInput: document.getElementById('registerUsernameInput'),
        registerPasswordInput: document.getElementById('registerPasswordInput'),
        registerPasswordConfirmInput: document.getElementById('registerPasswordConfirmInput'),
        
        // 个人中心 Modal
        personalCenterBtn: document.getElementById('personalCenterBtn'),
        personalCenterModal: document.getElementById('personalCenterModal'),
        closePersonalCenterModalBtn: document.getElementById('closePersonalCenterModalBtn'),
        pc_cancelBtn: document.getElementById('pc_cancelBtn'),
        
        // Tab 1: Info
        pc_userId: document.getElementById('pc_userId'),
        pc_username: document.getElementById('pc_username'),
        pc_level: document.getElementById('pc_level'),
        pc_maxStreak: document.getElementById('pc_maxStreak'),
        pc_inviteCode: document.getElementById('pc_inviteCode'),
        pc_referrerCode: document.getElementById('pc_referrerCode'),
        pc_nicknameInput: document.getElementById('pc_nicknameInput'),
        pc_saveNicknameBtn: document.getElementById('pc_saveNicknameBtn'),
        pc_referrerSection: document.getElementById('pc_referrerSection'),
        pc_referrerInput: document.getElementById('pc_referrerInput'),
        pc_bindReferrerBtn: document.getElementById('pc_bindReferrerBtn'),
        
        // Tab 2: Deposit
        pc_tab_info: document.getElementById('pc_tab_info'),
        pc_tab_deposit: document.getElementById('pc_tab_deposit'),
        pc_content_info: document.getElementById('pc_content_info'),
        pc_content_deposit: document.getElementById('pc_content_deposit'),
        pc_tron_address: document.getElementById('pc_tron_address'),
        pc_copy_tron_btn: document.getElementById('pc_copy_tron_btn'),
        pc_evm_address: document.getElementById('pc_evm_address'),
        pc_copy_evm_btn: document.getElementById('pc_copy_evm_btn'),
        pc_deposit_history_list: document.getElementById('pc_deposit_history_list'),
        
        // Tab 3: Withdraw
        pc_tab_withdraw: document.getElementById('pc_tab_withdraw'),
        pc_content_withdraw: document.getElementById('pc_content_withdraw'),
        pc_withdrawal_pwd_status: document.getElementById('pc_withdrawal_pwd_status'),
        pc_withdrawal_pwd_text: document.getElementById('pc_withdrawal_pwd_text'),
        pc_set_withdrawal_pwd_btn: document.getElementById('pc_set_withdrawal_pwd_btn'),
        pc_change_withdrawal_pwd_btn: document.getElementById('pc_change_withdrawal_pwd_btn'),
        pc_withdraw_chain: document.getElementById('pc_withdraw_chain'),
        pc_withdraw_address: document.getElementById('pc_withdraw_address'),
        pc_withdraw_amount: document.getElementById('pc_withdraw_amount'),
        pc_withdraw_password: document.getElementById('pc_withdraw_password'),
        pc_submit_withdrawal_btn: document.getElementById('pc_submit_withdrawal_btn'),
        pc_withdrawal_history_list: document.getElementById('pc_withdrawal_history_list'),
        
        // 密码 Modals
        setWithdrawalPwdModal: document.getElementById('setWithdrawalPwdModal'),
        closeSetPwdModalBtn: document.getElementById('closeSetPwdModalBtn'),
        cancelSetPwdBtn: document.getElementById('cancelSetPwdBtn'),
        confirmSetPwdBtn: document.getElementById('confirmSetPwdBtn'),
        set_login_password: document.getElementById('set_login_password'),
        set_new_password: document.getElementById('set_new_password'),
        set_confirm_password: document.getElementById('set_confirm_password'),
        
        changeWithdrawalPwdModal: document.getElementById('changeWithdrawalPwdModal'),
        closeChangePwdModalBtn: document.getElementById('closeChangePwdModalBtn'),
        cancelChangePwdBtn: document.getElementById('cancelChangePwdBtn'),
        confirmChangePwdBtn: document.getElementById('confirmChangePwdBtn'),
        change_old_password: document.getElementById('change_old_password'),
        change_new_password: document.getElementById('change_new_password'),
        change_confirm_password: document.getElementById('change_confirm_password'),
    };
    
    return domElements;
}

/**
 * 获取 DOM 元素
 */
export function getElement(key) {
    return domElements[key];
}

/**
 * 更新 UI（根据登录状态）
 */
export function updateUI() {
    const currentUser = getCurrentUser();
    const token = getToken();
    
    if (currentUser && token) {
        // 登录状态
        domElements.loginBtn.style.display = 'none';
        domElements.registerBtn.style.display = 'none';
        
        domElements.userInfoDisplay.style.display = 'inline-block';
        domElements.personalCenterBtn.style.display = 'block';
        domElements.logoutBtn.style.display = 'block';

        domElements.usernameDisplay.innerText = currentUser.nickname || currentUser.username;
        const balance = typeof currentUser.balance === 'string' 
            ? parseFloat(currentUser.balance) 
            : currentUser.balance;
        domElements.balanceDisplay.innerText = (balance || 0).toFixed(2); 

        // 更新连胜
        const streak = currentUser.current_streak || 0;
        domElements.userStreakDisplay.style.display = 'inline-block'; 
        if (streak > 0) {
            domElements.userStreakDisplay.innerText = `🔥 連胜 ${streak} 场`;
            domElements.userStreakDisplay.style.backgroundColor = '#e0f8e0';
            domElements.userStreakDisplay.style.color = '#006400';
        } else if (streak < 0) {
            domElements.userStreakDisplay.innerText = `🥶 連败 ${Math.abs(streak)} 场`;
            domElements.userStreakDisplay.style.backgroundColor = '#f8e0e0';
            domElements.userStreakDisplay.style.color = '#a00000';
        } else {
            domElements.userStreakDisplay.innerText = `😐 連胜 0 场`;
            domElements.userStreakDisplay.style.backgroundColor = '#eee';
            domElements.userStreakDisplay.style.color = '#333';
        }
        
        const maxStreak = currentUser.max_streak || 0;
        domElements.userMaxStreakDisplay.style.display = 'inline-block'; 
        domElements.userMaxStreakDisplay.innerText = `🏆 最高連胜: ${maxStreak}`;

        // 更新个人中心内的提款密码状态
        if (currentUser.has_withdrawal_password) {
            domElements.pc_withdrawal_pwd_text.innerText = '已设置';
            domElements.pc_withdrawal_pwd_text.style.color = '#67c23a';
            domElements.pc_set_withdrawal_pwd_btn.style.display = 'none';
            domElements.pc_change_withdrawal_pwd_btn.style.display = 'inline-block';
        } else {
            domElements.pc_withdrawal_pwd_text.innerText = '未设置';
            domElements.pc_withdrawal_pwd_text.style.color = '#f56c6c';
            domElements.pc_set_withdrawal_pwd_btn.style.display = 'inline-block';
            domElements.pc_change_withdrawal_pwd_btn.style.display = 'none';
        }

    } else {
        // 登出状态
        domElements.loginBtn.style.display = 'block';
        domElements.registerBtn.style.display = 'block';
        
        domElements.userInfoDisplay.style.display = 'none';
        domElements.personalCenterBtn.style.display = 'none';
        domElements.logoutBtn.style.display = 'none';

        domElements.userStreakDisplay.style.display = 'none';
        domElements.userMaxStreakDisplay.style.display = 'none';
        
        const historyList = document.getElementById('historyList');
        if (historyList) {
            historyList.innerHTML = '<li>登入後以查看历史记录</li>';
        }
    }
}

/**
 * Modal 控制函数
 */
export function showLoginModal() {
    domElements.loginModal.style.display = 'block';
}

export function hideLoginModal() {
    domElements.loginModal.style.display = 'none';
}

export function showRegisterModal() {
    domElements.registerModal.style.display = 'block';
}

export function hideRegisterModal() {
    domElements.registerModal.style.display = 'none';
}

export function showPersonalCenterModal() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    // Tab 1: 填充基本资讯
    domElements.pc_userId.innerText = currentUser.user_id;
    domElements.pc_username.innerText = currentUser.username;
    domElements.pc_level.innerText = `Level ${currentUser.level}`;
    domElements.pc_maxStreak.innerText = currentUser.max_streak;
    domElements.pc_inviteCode.innerText = currentUser.invite_code || 'N/A';
    domElements.pc_referrerCode.innerText = currentUser.referrer_code || '(未绑定)';
    domElements.pc_tron_address.value = currentUser.tron_deposit_address || '地址生成中...';
    domElements.pc_evm_address.value = currentUser.evm_deposit_address || '地址生成中...';
    domElements.pc_nicknameInput.value = currentUser.nickname || '';
    domElements.pc_referrerInput.value = '';
    
    if (currentUser.referrer_code) {
        domElements.pc_referrerSection.style.display = 'none';
    } else {
        domElements.pc_referrerSection.style.display = 'block';
    }
    
    // 重置 Tab 状态为显示 "基本资讯"
    handlePcTabClick('info');
    
    // 清空提款表单
    domElements.pc_withdraw_chain.value = 'TRC20';
    domElements.pc_withdraw_address.value = '';
    domElements.pc_withdraw_amount.value = '';
    domElements.pc_withdraw_password.value = '';
    
    domElements.personalCenterModal.style.display = 'block';
}

export function hidePersonalCenterModal() {
    domElements.personalCenterModal.style.display = 'none';
}

/**
 * Tab 切换逻辑
 */
export function handlePcTabClick(tabName) {
    // 先隐藏所有
    domElements.pc_tab_info.classList.remove('active');
    domElements.pc_content_info.classList.remove('active');
    domElements.pc_tab_deposit.classList.remove('active');
    domElements.pc_content_deposit.classList.remove('active');
    domElements.pc_tab_withdraw.classList.remove('active');
    domElements.pc_content_withdraw.classList.remove('active');

    // 再显示选中的
    if (tabName === 'info') {
        domElements.pc_tab_info.classList.add('active');
        domElements.pc_content_info.classList.add('active');
    } else if (tabName === 'deposit') {
        domElements.pc_tab_deposit.classList.add('active');
        domElements.pc_content_deposit.classList.add('active');
        const { fetchDepositHistory } = require('./wallet.js');
        fetchDepositHistory();
    } else if (tabName === 'withdraw') {
        domElements.pc_tab_withdraw.classList.add('active');
        domElements.pc_content_withdraw.classList.add('active');
        const { fetchWithdrawalHistory } = require('./wallet.js');
        fetchWithdrawalHistory();
    }
}

/**
 * 密码 Modal 控制
 */
export function showSetPwdModal() {
    domElements.set_login_password.value = '';
    domElements.set_new_password.value = '';
    domElements.set_confirm_password.value = '';
    domElements.setWithdrawalPwdModal.style.display = 'block';
}

export function hideSetPwdModal() {
    domElements.setWithdrawalPwdModal.style.display = 'none';
}

export function showChangePwdModal() {
    domElements.change_old_password.value = '';
    domElements.change_new_password.value = '';
    domElements.change_confirm_password.value = '';
    domElements.changeWithdrawalPwdModal.style.display = 'block';
}

export function hideChangePwdModal() {
    domElements.changeWithdrawalPwdModal.style.display = 'none';
}

