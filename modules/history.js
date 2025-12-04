// 历史记录渲染模块

import { getHistory } from './api.js';

export async function renderHistory(token) {
    if (!token) {
        console.log('No token provided, skipping history render.');
        document.getElementById('historyList').innerHTML = '<li>登入後以查看历史记录</li>';
        return;
    }

    const historyListEl = document.getElementById('historyList');
    if (historyListEl.children.length === 0 || historyListEl.children[0].innerText.includes("...")) {
        historyListEl.innerHTML = '<li>Loading...</li>';
    }

    try {
        const history = await getHistory(token); // (★★★ 修改：传入 token ★★★)
        
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
            
            switch(item.status) {
                case 'won': statusText = '✅ 已中奖'; break;
                case 'lost': statusText = '❌ 未中奖'; break;
                case 'pending': statusText = '⌛️ 待开奖'; break;
                case 'failed': statusText = '⚠️ 处理失败'; break;
                default: statusText = '⌛️ 处理中';
            }
            const txLink = item.tx_hash ? `<a href="https://sepolia.etherscan.io/tx/${item.tx_hash}" target="_blank">${item.tx_hash.substring(0, 10)}...</a>` : 'N/A';
            
            li.innerHTML = `[${betTime}] 选择: ${choiceText} | 金额: ${item.amount} | 状态: ${statusText} | 开奖TX: ${txLink}`;
            historyListEl.appendChild(li);
        });
    } catch (error) {
        historyListEl.innerHTML = '<li>Failed to load history.</li>';
        console.error('Failed to render history:', error);
    }
}