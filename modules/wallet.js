// 钱包相关模块
// 处理充值、提款、密码设置等钱包功能

import * as api from './api.js';
import { getToken, getCurrentUser, setCurrentUser } from './state.js';
import { notifySuccess, notifyError, notifyWarning } from './notify.js';
import { getElement, updateUI, showPersonalCenterModal } from './ui.js';

/**
 * 获取充值历史
 */
export async function fetchDepositHistory() {
    const pc_deposit_history_list = getElement('pc_deposit_history_list');
    if (!pc_deposit_history_list) return;
    
    pc_deposit_history_list.innerHTML = '<li>Loading...</li>';
    try {
        const token = getToken();
        const history = await api.getDepositHistory(token);
        if (history.length === 0) {
            pc_deposit_history_list.innerHTML = '<li>暂無充值记录</li>';
            return;
        }
        
        pc_deposit_history_list.innerHTML = history.map(item => {
            const time = new Date(item.created_at).toLocaleString();
            let statusText = '已到帐';
            let statusClass = 'history-status-completed';
            
            // 建立测试网连结的逻辑
            let txLink = '#';
            if (item.tx_hash) {
                if (item.chain === 'TRC20') txLink = `https://nile.tronscan.org/#/transaction/${item.tx_hash}`;
                else if (item.chain === 'BSC') txLink = `https://testnet.bscscan.com/tx/${item.tx_hash}`;
                else if (item.chain === 'ETH') txLink = `https://sepolia.etherscan.io/tx/${item.tx_hash}`;
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
        console.error('Failed to fetch deposit history:', error);
    }
}

/**
 * 获取提款历史
 */
export async function fetchWithdrawalHistory() {
    const pc_withdrawal_history_list = getElement('pc_withdrawal_history_list');
    if (!pc_withdrawal_history_list) return;
    
    pc_withdrawal_history_list.innerHTML = '<li>Loading...</li>';
    try {
        const token = getToken();
        const history = await api.getWithdrawalHistory(token);
        if (history.length === 0) {
            pc_withdrawal_history_list.innerHTML = '<li>暂無提款记录</li>';
            return;
        }
        
        pc_withdrawal_history_list.innerHTML = history.map(item => {
            const reqTime = new Date(item.request_time).toLocaleString();
            let statusText = item.status;
            let statusClass = `history-status-${item.status}`;
            
            switch(item.status) {
                case 'pending': statusText = '待審核'; break;
                case 'processing': statusText = '出款中'; break;
                case 'completed': statusText = '出款完成'; break;
                case 'rejected': statusText = `已拒绝 (${item.rejection_reason || 'N/A'})`; break;
            }
            
            // 建立测试网连结的逻辑
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
        console.error('Failed to fetch withdrawal history:', error);
    }
}

/**
 * 复制 TRC20 地址
 */
export function copyTronAddress() {
    if (!navigator.clipboard) {
        notifyError('您的浏览器不支持复制功能');
        return;
    }
    const pc_tron_address = getElement('pc_tron_address');
    navigator.clipboard.writeText(pc_tron_address.value).then(() => {
        notifySuccess('TRC20 地址已复制');
    }, (err) => {
        notifyError('复制失败');
        console.error('Failed to copy text: ', err);
    });
}

/**
 * 复制 EVM 地址
 */
export function copyEvmAddress() {
    if (!navigator.clipboard) {
        notifyError('您的浏览器不支持复制功能');
        return;
    }
    const pc_evm_address = getElement('pc_evm_address');
    navigator.clipboard.writeText(pc_evm_address.value).then(() => {
        notifySuccess('EVM (0x) 地址已复制');
    }, (err) => {
        notifyError('复制失败');
        console.error('Failed to copy text: ', err);
    });
}

/**
 * 保存昵称
 */
export async function handleSaveNickname() {
    const pc_nicknameInput = getElement('pc_nicknameInput');
    const newNickname = pc_nicknameInput.value.trim();
    const currentUser = getCurrentUser();
    
    if (newNickname.length > 50) {
        notifyError('昵称长度不能超过 50 個字元');
        return;
    }
    if (!newNickname || newNickname === (currentUser.nickname || '')) {
        notifyWarning('昵称未变更');
        return;
    }

    const btn = getElement('pc_saveNicknameBtn');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = '储存中...';

    try {
        const token = getToken();
        const updatedUser = await api.updateNickname(token, newNickname);
        setCurrentUser(updatedUser);
        updateUI();
        notifySuccess('昵称更新成功！');
    } catch (error) {
        notifyError(`更新失败：${error.message}`);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

/**
 * 绑定推荐人
 */
export async function handleBindReferrer() {
    const pc_referrerInput = getElement('pc_referrerInput');
    const referrerCode = pc_referrerInput.value.trim();
    const currentUser = getCurrentUser();
    
    if (!referrerCode) {
        notifyError('请输入推薦码');
        return;
    }
    if (referrerCode === currentUser.invite_code) {
        notifyError('不能绑定自己的邀请码');
        return;
    }

    const btn = getElement('pc_bindReferrerBtn');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = '绑定中...';

    try {
        const token = getToken();
        const updatedUser = await api.bindReferrer(token, referrerCode);
        setCurrentUser(updatedUser);
        updateUI();
        showPersonalCenterModal();
        notifySuccess('推薦人绑定成功！');
    } catch (error) {
        notifyWarning(`绑定失败：${error.message}`);
    } finally {
        btn.disabled = false;
        btn.innerText = '绑定';
    }
}

/**
 * 设置提款密码
 */
export async function handleSubmitSetPwd() {
    const set_login_password = getElement('set_login_password');
    const set_new_password = getElement('set_new_password');
    const set_confirm_password = getElement('set_confirm_password');
    
    const loginPwd = set_login_password.value;
    const newPwd = set_new_password.value;
    const confirmPwd = set_confirm_password.value;
    
    if (newPwd !== confirmPwd) {
        notifyError('两次输入的新密码不一致');
        return;
    }
    if (!loginPwd || newPwd.length < 6) {
        notifyError('请输入登入密码，且新密码至少 6 位');
        return;
    }

    const btn = getElement('confirmSetPwdBtn');
    btn.disabled = true;
    btn.innerText = '设置中...';
    
    try {
        const token = getToken();
        await api.setWithdrawalPassword(token, loginPwd, newPwd);
        notifySuccess('提款密码设置成功！');
        
        const { hideSetPwdModal } = require('./ui.js');
        hideSetPwdModal();
        
        // 手动更新本地状态
        const currentUser = getCurrentUser();
        if (currentUser) {
            currentUser.has_withdrawal_password = true;
        }
        updateUI();
    } catch (error) {
        notifyError(`设置失败：${error.message}`);
    } finally {
        btn.disabled = false;
        btn.innerText = '确认设置';
    }
}

/**
 * 修改提款密码
 */
export async function handleSubmitChangePwd() {
    const change_old_password = getElement('change_old_password');
    const change_new_password = getElement('change_new_password');
    const change_confirm_password = getElement('change_confirm_password');
    
    const oldPwd = change_old_password.value;
    const newPwd = change_new_password.value;
    const confirmPwd = change_confirm_password.value;

    if (newPwd !== confirmPwd) {
        notifyError('两次输入的新密码不一致');
        return;
    }
    if (!oldPwd || newPwd.length < 6) {
        notifyError('请输入旧密码，且新密码至少 6 位');
        return;
    }

    const btn = getElement('confirmChangePwdBtn');
    btn.disabled = true;
    btn.innerText = '修改中...';
    
    try {
        const token = getToken();
        await api.updateWithdrawalPassword(token, oldPwd, newPwd);
        notifySuccess('提款密码修改成功！');
        
        const { hideChangePwdModal } = require('./ui.js');
        hideChangePwdModal();
    } catch (error) {
        notifyError(`修改失败：${error.message}`);
    } finally {
        btn.disabled = false;
        btn.innerText = '确认修改';
    }
}

/**
 * 提交提款请求
 */
export async function handleSubmitWithdrawal() {
    const pc_withdraw_chain = getElement('pc_withdraw_chain');
    const pc_withdraw_address = getElement('pc_withdraw_address');
    const pc_withdraw_amount = getElement('pc_withdraw_amount');
    const pc_withdraw_password = getElement('pc_withdraw_password');
    const pc_content_deposit = getElement('pc_content_deposit');
    
    const data = {
        chain_type: pc_withdraw_chain.value,
        address: pc_withdraw_address.value.trim(),
        amount: parseFloat(pc_withdraw_amount.value),
        withdrawal_password: pc_withdraw_password.value,
    };

    if (!data.chain_type || !data.address || !data.amount || data.amount <= 0 || !data.withdrawal_password) {
        notifyError('请填寫所有提款栏位');
        return;
    }
    
    const btn = getElement('pc_submit_withdrawal_btn');
    btn.disabled = true;
    btn.innerText = '提交中...';
    
    try {
        const token = getToken();
        const result = await api.requestWithdrawal(token, data);
        notifySuccess(result.message || '提款请求已提交！');
        
        // 清空表单
        pc_withdraw_address.value = '';
        pc_withdraw_amount.value = '';
        pc_withdraw_password.value = '';
        
        // 刷新余额和历史
        await fetchWithdrawalHistory();
        if (pc_content_deposit && pc_content_deposit.classList.contains('active')) {
            await fetchDepositHistory();
        }

    } catch (error) {
        notifyError(`提交失败：${error.message}`);
    } finally {
        btn.disabled = false;
        btn.innerText = '确认提款';
    }
}

