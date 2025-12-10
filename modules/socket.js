// Socket.IO 连接管理模块

import { getToken, getCurrentUser, setCurrentUser, setSocket, getSocket } from './state.js';
import { renderHistory } from './history.js';
import { updateUI } from './ui.js';
import { notifySuccess, notifyError } from './notify.js';
import { handleLogout } from './auth.js';
import { getBettingState } from './state.js';
// 延迟导入 wallet 模块以避免循环依赖

/**
 * 初始化 Socket.IO 连接
 */
export function initializeSocket(token) {
    const existingSocket = getSocket();
    if (existingSocket) {
        existingSocket.disconnect();
    }
    
    const socket = io({
        auth: {
            token: token
        }
    });

    socket.on('connect', () => {
        // Socket connected
    });
    
    socket.on('connect_error', (err) => {
        console.error('[Socket.io] Connection Error:', err.message);
        if (err.message === 'Authentication error: Invalid token' || 
            err.message === 'Authentication error: User not found or disabled.') {
            handleLogout();
            notifyError('連线已过期，请重新登入。');
        }
    });
    
    socket.on('bet_updated', async (betData) => {
        const token = getToken();
        if (token) {
            renderHistory(token);
            
            // 如果充值页开启，也刷新充值历史
            const personalCenterModal = document.getElementById('personalCenterModal');
            const pc_content_deposit = document.getElementById('pc_content_deposit');
            if (personalCenterModal && personalCenterModal.style.display === 'block' && 
                pc_content_deposit && pc_content_deposit.classList.contains('active')) {
                const { fetchDepositHistory } = await import('./wallet.js');
                fetchDepositHistory();
            }
            
            // 如果提款页开启，也刷新提款历史
            const pc_content_withdraw = document.getElementById('pc_content_withdraw');
            if (personalCenterModal && personalCenterModal.style.display === 'block' && 
                pc_content_withdraw && pc_content_withdraw.classList.contains('active')) {
                const { fetchWithdrawalHistory } = await import('./wallet.js');
                fetchWithdrawalHistory();
            }
        }
    });

    socket.on('user_info_updated', (fullUser) => {
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.id === fullUser.id) {
            const oldBalance = currentUser.balance;
            setCurrentUser(fullUser);
            updateUI();
            
            // 只有在非下注状态 且 余额真的变动时 才弹出提示
            if (!getBettingState() && oldBalance !== fullUser.balance) {
                notifySuccess(`帐户已更新！新余额: ${parseFloat(fullUser.balance).toFixed(2)} USDT`);
            }
        }
    });
    
    socket.on('leaderboard_updated', async (leaderboardData) => {
        const { renderLeaderboardData } = await import('./leaderboard.js');
        renderLeaderboardData(leaderboardData);
    });
    
    socket.on('disconnect', () => {
        // Socket disconnected
    });

    setSocket(socket);
    return socket;
}

