// 认证相关模块
// 处理登录、注册、登出等认证逻辑

import * as api from './api.js';
import { setToken, setCurrentUser, clearState, getToken } from './state.js';
import { notifySuccess, notifyError, notifyWarning } from './notify.js';
import { updateUI } from './ui.js';
import { initializeSocket } from './socket.js';
import { renderHistory } from './history.js';

/**
 * 处理用户注册
 */
export async function handleRegister(username, password, confirmPassword) {
    if (password !== confirmPassword) {
        notifyError('两次输入的密码不一致');
        return false;
    }
    if (username.length < 3 || username.length > 20) {
        notifyError('帐号长度必须在 3-20 字元之间');
        return false;
    }
    if (password.length < 6) {
        notifyError('密码长度至少需要 6 位');
        return false;
    }

    try {
        const { user, token } = await api.register(username, password);
        notifySuccess('注册成功！已自动登入。');
        
        setToken(token);
        setCurrentUser(user);
        
        updateUI();
        initializeSocket(token);
        await renderHistory(token);
        
        return true;
    } catch (error) {
        if (error.status === 400) {
            notifyWarning(error.message);
        } else {
            notifyError(`注册失败：${error.message}`);
        }
        return false;
    }
}

/**
 * 处理用户登录
 */
export async function handleLogin(username, password) {
    if (!username || !password) {
        notifyError('请输入帐号和密码');
        return false;
    }
    
    try {
        const { user, token } = await api.login(username, password);
        notifySuccess('登入成功！');
        
        setToken(token);
        setCurrentUser(user);
        
        updateUI();
        initializeSocket(token);
        await renderHistory(token);
        
        return true;
    } catch (error) {
        if (error.status === 401) {
            notifyWarning(error.message);
        } else {
            notifyError(`登入失败：${error.message}`);
        }
        return false;
    }
}

/**
 * 处理用户登出
 */
export function handleLogout() {
    clearState();
    updateUI();
    notifySuccess('您已成功登出。');
}

/**
 * 自动登录（从 localStorage 恢复）
 */
export async function autoLogin() {
    const savedToken = localStorage.getItem('jwt_token');
    if (savedToken) {
        setToken(savedToken);
        await fetchUserInfo(savedToken);
    } else {
        updateUI();
    }
}

/**
 * 获取用户信息
 */
export async function fetchUserInfo(token) {
    try {
        const user = await api.getUserInfo(token);
        setCurrentUser(user);
        updateUI();
        initializeSocket(token);
        await renderHistory(token);
    } catch (error) {
        // Auto-login failed
        handleLogout();
    }
}

