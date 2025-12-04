// 游戏相关模块
// 处理下注、开奖等游戏逻辑

import * as api from './api.js';
import { getToken, getCurrentUser, setBettingState, getBettingState } from './state.js';
import { notifySuccess, notifyError, notifyWarning } from './notify.js';
import { getElement } from './ui.js';

/**
 * 处理确认下注
 */
export async function handleConfirmBet() {
    if (getBettingState()) {
        notifyError('正在处理上一笔下注，请稍候...');
        return;
    }

    const choice = document.querySelector('input[name="flipChoice"]:checked')?.value;
    const betAmountInput = getElement('betAmountInput');
    const amount = parseFloat(betAmountInput.value);
    const currentUser = getCurrentUser();

    if (!choice) {
        notifyError('请选择正面或反面');
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        notifyError('请输入有效的下注金额');
        return;
    }
    if (currentUser && amount > parseFloat(currentUser.balance)) {
        notifyError('余额不足');
        return;
    }

    setBettingState(true);
    const confirmBetBtn = getElement('confirmBetBtn');
    confirmBetBtn.disabled = true;
    confirmBetBtn.innerText = '下注中...';
    
    const coinFlipper = document.getElementById('coin-flipper');
    if (coinFlipper) {
        coinFlipper.classList.add('flipping');
    }
    
    notifySuccess('注单已提交，正在等待链上开奖...');

    try {
        const token = getToken();
        const settledBet = await api.placeBet(token, choice, amount);
        
        console.log('Bet settled:', settledBet);
        
        // 余额更新将由 Socket.IO 的 'user_info_updated' 事件统一处理

        if (settledBet.status === 'won') {
            notifySuccess(`恭喜中奖！`);
        } else if (settledBet.status === 'lost') {
            notifyError('可惜，未中奖');
        }
        
        // 显示硬币结果
        const outcome = (parseInt(settledBet.tx_hash.slice(-1), 16) % 2 === 0) ? 'head' : 'tail';
        showCoinResult(outcome);

    } catch (error) {
        console.warn('Bet failed:', error.message); 
        
        if (error.status === 400 || error.status === 401) {
            notifyWarning(`下注失败：${error.message}`);
        } else {
            notifyError(`下注失败：${error.message}`);
        }
        
        const coinFlipper = document.getElementById('coin-flipper');
        if (coinFlipper) {
            coinFlipper.classList.remove('flipping');
        }
        
    } finally {
        setBettingState(false);
        const confirmBetBtn = getElement('confirmBetBtn');
        confirmBetBtn.disabled = false;
        confirmBetBtn.innerText = '确认下注';
    }
}

/**
 * 显示硬币结果
 */
function showCoinResult(result) {
    const coin = document.getElementById('coin-flipper');
    if (!coin) return;
    
    coin.classList.remove('flipping');
    
    if (result === 'head') {
        coin.classList.remove('show-tail');
        coin.classList.add('show-head');
    } else {
        coin.classList.remove('show-head');
        coin.classList.add('show-tail');
    }
}

