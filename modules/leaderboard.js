// 排行榜模块

import * as api from './api.js';
// 排行榜模块 - 不依赖 notify 以避免循环依赖

/**
 * 渲染排行榜数据
 */
export function renderLeaderboardData(leaderboardData) {
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

/**
 * 渲染排行榜（从 API 获取）
 */
export async function renderLeaderboard() {
    const listEl = document.getElementById('leaderboardList');
    if (!listEl) return;
    
    listEl.innerHTML = '<li>Loading...</li>'; 
    try {
        const leaderboardData = await api.getLeaderboard();
        renderLeaderboardData(leaderboardData);
    } catch (error) {
        console.error("Failed to render leaderboard:", error);
        listEl.innerHTML = '<li>无法加载排行榜</li>';
        // 排行榜加载失败，已在 UI 显示错误信息
    }
}

