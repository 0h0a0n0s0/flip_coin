// 檔案: modules/history.js (片段修改)

import { getHistory } from './api.js';

export async function renderHistory(token) { // (★★★ 修改：傳入 token ★★★)
    if (!token) { // (★★★ 修改：檢查 token ★★★)
        console.log('No token provided, skipping history render.');
        document.getElementById('historyList').innerHTML = '<li>登入後以查看歷史記錄</li>'; // (★★★ 修改：提示 ★★★)
        return;
    }

    const historyListEl = document.getElementById('historyList');
    if (historyListEl.children.length === 0 || historyListEl.children[0].innerText.includes("...")) {
        historyListEl.innerHTML = '<li>Loading...</li>';
    }

    try {
        const history = await getHistory(token); // (★★★ 修改：傳入 token ★★★)
        
        if (history.length === 0) {
            historyListEl.innerHTML = '<li>暂无投注记录</li>';
            return;
        }

        historyListEl.innerHTML = ''; // 清空列表
        history.forEach(item => {
            const li = document.createElement('li');
            const betTime = new Date(item.bet_time).toLocaleString();
            const choiceText = item.choice === 'head' ? '正面' : '反面';
            let statusText = '';
            
            // (★★★ v6 修改：移除 prize_pending，因為 v6 餘額是即時扣款/派發 ★★★)
            switch(item.status) {
                case 'won': statusText = '✅ 已中奖'; break;
                case 'lost': statusText = '❌ 未中奖'; break;
                // case 'prize_pending': statusText = '💰 獎金待發'; break; // (v6 移除)
                case 'pending': statusText = '⌛️ 待開獎'; break;
                case 'failed': statusText = '⚠️ 處理失敗'; break;
                default: statusText = '⌛️ 處理中';
            }
            
            // (★★★ v6 修改：tx_hash 是平台開獎 hash，不再是派獎 hash ★★★)
            const txLink = item.tx_hash ? `<a href="https://sepolia.etherscan.io/tx/${item.tx_hash}" target="_blank">${item.tx_hash.substring(0, 10)}...</a>` : 'N/A';
            
            li.innerHTML = `[${betTime}] 选择: ${choiceText} | 金额: ${item.amount} | 状态: ${statusText} | 開獎TX: ${txLink}`;
            historyListEl.appendChild(li);
        });
    } catch (error) {
        historyListEl.innerHTML = '<li>Failed to load history.</li>';
        console.error('Failed to render history:', error);
    }
}