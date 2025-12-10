// 主应用入口文件
// 重构后的模块化版本

import { initializeDOMElements, 
         showLoginModal, hideLoginModal, 
         showRegisterModal, hideRegisterModal,
         showPersonalCenterModal, hidePersonalCenterModal,
         handlePcTabClick,
         showSetPwdModal, hideSetPwdModal,
         showChangePwdModal, hideChangePwdModal,
         getElement } from './modules/ui.js';

import { handleLogin, handleRegister, handleLogout, autoLogin } from './modules/auth.js';
import { handleConfirmBet } from './modules/game.js';
import { copyTronAddress, copyEvmAddress, 
         handleSaveNickname, handleBindReferrer,
         handleSubmitSetPwd, handleSubmitChangePwd,
         handleSubmitWithdrawal } from './modules/wallet.js';
import { renderLeaderboard } from './modules/leaderboard.js';
import * as api from './modules/api.js';

/**
 * 加载平台名称
 */
async function loadPlatformName() {
    try {
        const data = await api.getPlatformName();
        const platformName = data.platform_name || 'FlipCoin';
        
        // 更新页签标题
        document.title = platformName;
        
        // 更新header标题
        const headerTitle = document.querySelector('header h1');
        if (headerTitle) {
            headerTitle.textContent = platformName;
        }
    } catch (error) {
        // 使用默认值
        document.title = 'FlipCoin';
        const headerTitle = document.querySelector('header h1');
        if (headerTitle) {
            headerTitle.textContent = 'FlipCoin';
        }
    }
}

/**
 * 应用初始化
 */
function initializeApp() {
    
    // 初始化 DOM 元素引用
    initializeDOMElements();
    
    // 绑定 Auth 事件
    getElement('loginBtn').addEventListener('click', showLoginModal);
    getElement('registerBtn').addEventListener('click', showRegisterModal);
    getElement('logoutBtn').addEventListener('click', handleLogout);
    
    // 绑定 Modal 关闭事件
    getElement('closeLoginModalBtn').addEventListener('click', hideLoginModal);
    getElement('cancelLoginBtn').addEventListener('click', hideLoginModal);
    getElement('closeRegisterModalBtn').addEventListener('click', hideRegisterModal);
    getElement('cancelRegisterBtn').addEventListener('click', hideRegisterModal);
    
    // 绑定 Modal 确认事件（需要包装以获取输入值）
    getElement('confirmLoginBtn').addEventListener('click', async () => {
        const username = getElement('loginUsernameInput').value;
        const password = getElement('loginPasswordInput').value;
        if (await handleLogin(username, password)) {
            hideLoginModal();
        }
    });
    
    getElement('confirmRegisterBtn').addEventListener('click', async () => {
        const username = getElement('registerUsernameInput').value;
        const password = getElement('registerPasswordInput').value;
        const confirmPassword = getElement('registerPasswordConfirmInput').value;
        if (await handleRegister(username, password, confirmPassword)) {
            hideRegisterModal();
        }
    });
    
    // 绑定个人中心
    getElement('personalCenterBtn').addEventListener('click', showPersonalCenterModal);
    getElement('closePersonalCenterModalBtn').addEventListener('click', hidePersonalCenterModal);
    getElement('pc_cancelBtn').addEventListener('click', hidePersonalCenterModal);
    
    // 绑定 Tab 切换
    getElement('pc_tab_info').addEventListener('click', () => handlePcTabClick('info'));
    getElement('pc_tab_deposit').addEventListener('click', () => handlePcTabClick('deposit'));
    getElement('pc_tab_withdraw').addEventListener('click', () => handlePcTabClick('withdraw'));
    
    // 绑定复制按钮
    getElement('pc_copy_tron_btn').addEventListener('click', copyTronAddress);
    getElement('pc_copy_evm_btn').addEventListener('click', copyEvmAddress);
    
    // 绑定个人中心表单事件
    getElement('pc_saveNicknameBtn').addEventListener('click', handleSaveNickname);
    getElement('pc_bindReferrerBtn').addEventListener('click', handleBindReferrer);
    
    // 绑定提款相关
    getElement('pc_set_withdrawal_pwd_btn').addEventListener('click', showSetPwdModal);
    getElement('pc_change_withdrawal_pwd_btn').addEventListener('click', showChangePwdModal);
    getElement('pc_submit_withdrawal_btn').addEventListener('click', handleSubmitWithdrawal);
    
    // 绑定密码 Modal
    getElement('closeSetPwdModalBtn').addEventListener('click', hideSetPwdModal);
    getElement('cancelSetPwdBtn').addEventListener('click', hideSetPwdModal);
    getElement('confirmSetPwdBtn').addEventListener('click', handleSubmitSetPwd);
    
    getElement('closeChangePwdModalBtn').addEventListener('click', hideChangePwdModal);
    getElement('cancelChangePwdBtn').addEventListener('click', hideChangePwdModal);
    getElement('confirmChangePwdBtn').addEventListener('click', handleSubmitChangePwd);
    
    // 绑定游戏事件
    getElement('confirmBetBtn').addEventListener('click', handleConfirmBet);
    
    // 点击 Modal 外部灰色区域也可关闭
    window.addEventListener('click', (event) => {
        if (event.target == getElement('loginModal')) hideLoginModal();
        if (event.target == getElement('registerModal')) hideRegisterModal();
        if (event.target == getElement('personalCenterModal')) hidePersonalCenterModal();
        if (event.target == getElement('setWithdrawalPwdModal')) hideSetPwdModal();
        if (event.target == getElement('changeWithdrawalPwdModal')) hideChangePwdModal();
    });
    
    // 加载平台名称
    loadPlatformName();
    
    // 启动 App
    autoLogin();
    renderLeaderboard();
}

/**
 * 等待 Socket.IO 加载完成
 */
function waitForSocketIO() {
    if (typeof window.io !== 'undefined') {
        initializeApp();
    } else {
        setTimeout(waitForSocketIO, 100);
    }
}

// 程序入口
document.addEventListener('DOMContentLoaded', waitForSocketIO);

