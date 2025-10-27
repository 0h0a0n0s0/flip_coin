// modules/history.js
import { getHistory } from './api.js';

// 我們不再需要 addHistory，因為所有歷史都由後端管理
// const HISTORY_KEY = 'flipCoinBetHistory';

export async function renderHistory(walletAddress) {
    if (!walletAddress) {
        console.log('No wallet connected, skipping history render.');
        return;
    }

    const historyListEl = document.getElementById('historyList');
    // 保留載入提示，防止重複呼叫時閃爍
    if (historyListEl.children.length === 0 || historyListEl.children[0].innerText.includes("...")) {
        historyListEl.innerHTML = '<li>Loading...</li>';
    }

    try {
        const history = await getHistory(walletAddress);
        
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
            
            // ★★★ 確保 switch 判斷中有 prize_pending ★★★
            switch(item.status) {
                case 'won': statusText = '✅ 已中奖'; break;
                case 'lost': statusText = '❌ 未中奖'; break;
                case 'prize_pending': statusText = '💰 獎金待發'; break; // 確保這一行存在
                case 'pending': statusText = '⌛️ 待開獎'; break;
                case 'failed': statusText = '⚠️ 處理失敗'; break;
                default: statusText = '⌛️ 處理中';
            }
            
            const txLink = item.tx_hash ? `<a href="https://sepolia.etherscan.io/tx/${item.tx_hash}" target="_blank">${item.tx_hash.substring(0, 10)}...</a>` : 'N/A';
            
            // 顯示派獎 Hash
            let prizeLink = '';
            if (item.prize_tx_hash) {
                prizeLink = ` | 派獎TX: <a href="https://sepolia.etherscan.io/tx/${item.prize_tx_hash}" target="_blank">${item.prize_tx_hash.substring(0, 10)}...</a>`;
            } else if (item.status === 'prize_pending') {
                prizeLink = ' | 派獎TX: (待處理)';
            }

            li.innerHTML = `[${betTime}] 选择: ${choiceText} | 金额: ${item.amount} | 状态: ${statusText} | TX: ${txLink}${prizeLink}`;
            historyListEl.appendChild(li);
        });
    } catch (error) {
        historyListEl.innerHTML = '<li>Failed to load history.</li>';
        console.error('Failed to render history:', error);
    }
}