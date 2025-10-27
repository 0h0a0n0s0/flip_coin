// app.js
// ★★★ 導入 WalletService，移除 game.js ★★★
import { BrowserExtensionWalletService } from './modules/BrowserExtensionWalletService.js'; 
import { renderHistory } from './modules/history.js';
import { registerOrLogin, getLeaderboard, placeBet } from './modules/api.js'; // <-- 導入 placeBet
import { SUPPORTED_CHAIN_ID, GAME_WALLET_ADDRESS } from './config.js';

// --- Notyf 實例化 (完整且正確的版本) ---
const notyf = new Notyf({
    duration: 5000,
    position: { x: 'right', y: 'top' },
    dismissible: true,
    types: [
        {
            type: 'warning',
            background: '#f5a623',
            icon: {
                className: 'notyf__icon--warning',
                tagName: 'i',
                text: '⚠️'
            }
        }
    ]
});

// --- 全局狀態 (包含所有 UI 元素) ---
let walletService = null; 
let currentAccount = null; 
let currentUser = null;
let socket = null;
let connectWalletBtn, logoutBtn, confirmBetBtn, userIdDisplay, betAmountInput, userWalletAddressDisplay, userStreakDisplay, userMaxStreakDisplay;

// --- 遮罩 ---
function showNetworkOverlay(message) {
    let overlay = document.getElementById('networkOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'networkOverlay';
        overlay.style = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); color: white; display: flex;
            justify-content: center; align-items: center; text-align: center;
            font-size: 24px; z-index: 1000;
        `;
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = message;
    overlay.style.display = 'flex';
}
function hideNetworkOverlay() {
    let overlay = document.getElementById('networkOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// --- Socket 連線 (包含 leaderboard_updated) ---
function initializeSocket(walletAddress) {
    if (socket) socket.disconnect();
    const lowerAddress = walletAddress.toLowerCase();
    socket = io('http://localhost:3000');
    socket.on('connect', () => {
        console.log(`[Socket.io] Connected: ${socket.id}`);
        socket.emit('register', lowerAddress);
    });
    socket.on('bet_updated', (betData) => {
        console.log('[Socket.io] Received bet update:', betData);
        const coin = document.getElementById('coin-flipper');
        coin.classList.remove('flipping');
        if (betData.status === 'won') {
            coin.classList.add('show-head');
            notyf.success(`恭喜中獎！贏得 ${betData.amount * 2} ETH`);
        } else if (betData.status === 'lost') {
            coin.classList.add('show-tail');
            notyf.error('很遺憾，未中獎...');
        } else if (betData.status === 'prize_pending') { 
            coin.classList.add('show-head');
            notyf.open({ type: 'warning', message: `恭喜中獎！<br>獎金派發中，請稍後...` });
        } else if (betData.status === 'failed') {
            notyf.error('投注處理失敗，請聯繫客服。');
        }
        setTimeout(() => coin.className = 'coin', 3000);
        if (currentAccount) {
            renderHistory(currentAccount);
        }
    });
    socket.on('disconnect', () => console.log('[Socket.io] Disconnected.'));
    socket.on('stats_updated', (stats) => {
        console.log('[Socket.io] Received stats update:', stats);
        if (currentUser) {
            currentUser.current_streak = stats.current_streak;
            currentUser.max_streak = stats.max_streak;
            updateUI();
        }
    });
    socket.on('leaderboard_updated', (leaderboardData) => {
        console.log('[Socket.io] Received leaderboard update:', leaderboardData);
        renderLeaderboardData(leaderboardData); // 使用新的輔助函數渲染
    });
}

// --- ★★★ 新增：渲染排行榜數據的輔助函數 ★★★ ---
function renderLeaderboardData(leaderboardData) {
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
            <span>${index + 1}. <span class="address">${player.display_address}</span></span>
            <span>🔥 ${player.max_streak} 連勝</span>
        `;
        listEl.appendChild(li);
    });
}
// --- ★★★ 獲取並渲染排行榜函數 (使用輔助函數) ★★★ ---
async function renderLeaderboard() {
    const listEl = document.getElementById('leaderboardList');
    if (!listEl) return;
    listEl.innerHTML = '<li>Loading...</li>'; 
    try {
        const leaderboardData = await getLeaderboard(); 
        renderLeaderboardData(leaderboardData); // <-- 使用輔助函數
    } catch (error) {
        console.error("Failed to render leaderboard:", error);
        listEl.innerHTML = '<li>无法加载排行榜</li>';
        notyf.error('加载排行榜失败！');
    }
}

// --- UI 更新 (包含連勝狀態) ---
function updateUI() {
    if (currentUser && currentAccount) {
        // --- 登入狀態 ---
        userIdDisplay.style.display = 'inline-block'; 
        userIdDisplay.innerText = `用户ID: ${currentUser.user_id}`;
        userWalletAddressDisplay.style.display = 'inline-block';
        userWalletAddressDisplay.innerText = `${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}`;
        logoutBtn.style.display = 'block';
        connectWalletBtn.style.display = 'none';
        const streak = currentUser.current_streak || 0;
        userStreakDisplay.style.display = 'inline-block'; 
        if (streak > 0) {
            userStreakDisplay.innerText = `🔥 連勝 ${streak} 場`;
            userStreakDisplay.style.backgroundColor = '#e0f8e0';
            userStreakDisplay.style.color = '#006400';
        } else if (streak < 0) {
            userStreakDisplay.innerText = `🥶 連敗 ${Math.abs(streak)} 場`;
            userStreakDisplay.style.backgroundColor = '#f8e0e0';
            userStreakDisplay.style.color = '#a00000';
        } else {
            userStreakDisplay.innerText = `😐 連勝 0 場`;
            userStreakDisplay.style.backgroundColor = '#eee';
            userStreakDisplay.style.color = '#333';
        }
        const maxStreak = currentUser.max_streak || 0;
        userMaxStreakDisplay.style.display = 'inline-block'; 
        userMaxStreakDisplay.innerText = `🏆 最高連勝: ${maxStreak}`;
        userMaxStreakDisplay.style.backgroundColor = '#f8f8e0'; 
        userMaxStreakDisplay.style.color = '#646400';
    } else {
        // --- 登出狀態 ---
        userIdDisplay.style.display = 'none';
        userWalletAddressDisplay.style.display = 'none';
        logoutBtn.style.display = 'none';
        connectWalletBtn.style.display = 'block';
        connectWalletBtn.innerText = '连接钱包 / 注册';
        userStreakDisplay.style.display = 'none';
        userMaxStreakDisplay.style.display = 'none';
    }
}

// --- 登出 (使用 walletService) ---
async function handleLogout() {
    console.log("Handling logout...");
    localStorage.removeItem('userWalletAddress');
    currentAccount = null;
    currentUser = null;
    if (socket) socket.disconnect();
    
    if (walletService) {
        try {
            await walletService.disconnect();
            notyf.success('您已成功登出，錢包權限已撤銷。');
        } catch (err) {
            console.error("斷開錢包時發生錯誤:", err);
            notyf.open({ type: 'warning', message: '您已在應用程式中登出。' });
        } finally {
            walletService = null; 
        }
    } else {
         notyf.success('您已成功登出。'); 
    }
    updateUI(); 
}

// --- 連接錢包 (使用 walletService) ---
async function handleConnectWallet() {
    if (!walletService) {
        try {
            if (BrowserExtensionWalletService.isAvailable()) {
                walletService = new BrowserExtensionWalletService();
            } else {
                 const userAgrees = confirm('未偵測到錢包擴充。\n\n點擊「確定」前往 MetaMask 官網？');
                 if (userAgrees) window.open('https://metamask.io/download/', '_blank');
                 return; 
            }
        } catch (initError) {
             console.error("Wallet Service initialization failed:", initError);
             notyf.error(`錢包服務初始化失敗: ${initError.message}`);
             return;
        }
    }
    try {
        const account = await walletService.connect();
        if (account) {
            currentAccount = account; 
            try {
                const user = await registerOrLogin(currentAccount); 
                currentUser = user;
                localStorage.setItem('userWalletAddress', currentAccount); 
                updateUI(); 
                await renderHistory(currentAccount);
                initializeSocket(currentAccount);
                checkNetwork(); 
                setupWalletListeners(); 
            } catch (error) {
                console.error('Login failed:', error);
                notyf.error('後端登入或註冊失敗！');
            }
        }
    } catch (err) {
        console.error("連接錢包時發生錯誤:", err);
        if (err.message === 'User rejected connection request.') {
            notyf.open({ type: 'warning', message: '您已取消錢包連接請求。' });
        } else {
            notyf.error(`連接錢包失敗: ${err.message}`);
        }
        walletService = null; 
    }
}

// --- ★★★ 確認下注 (交易邏輯移至此處) ★★★ ---
async function handleConfirmBet() {
    const choice = document.querySelector('input[name="flipChoice"]:checked')?.value;
    const amount = parseFloat(betAmountInput.value);

    if (!currentUser || !currentAccount || !walletService) {
        notyf.error('请先连接钱包并登入');
        return;
    }
    if (!choice) {
        notyf.error('请选择正面或反面');
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        notyf.error('请输入有效的下注金额');
        return;
    }
    
    const originalButtonText = confirmBetBtn.innerText;
    try {
        confirmBetBtn.disabled = true;
        confirmBetBtn.innerText = '處理中...';

        const provider = walletService.getProvider(); 
        const signer = walletService.getSigner();   
        const balance = await provider.getBalance(currentAccount);
        
        // ★★★ 修正：使用 window.ethers ★★★
        const betAmountInWei = window.ethers.parseEther(amount.toString()); 

        if (balance < betAmountInWei) {
            notyf.error('您的錢包餘額不足以支付此次下注！');
            throw new Error('Insufficient funds'); 
        }

        confirmBetBtn.innerText = '請在錢包中確認...';
        const tx = await signer.sendTransaction({
            to: GAME_WALLET_ADDRESS,
            value: betAmountInWei
        });

        confirmBetBtn.innerText = '交易已送出...';
        console.log('Transaction sent! Hash:', tx.hash);
        notyf.success('交易已送出！等待伺服器記錄...');
        
        await placeBet(currentAccount, choice, amount, tx.hash);

        notyf.success('下注成功！等待開獎...');
        document.getElementById('coin-flipper').className = 'coin flipping';
        
        await renderHistory(currentAccount);

    } catch (error) {
        if (error.code === 'ACTION_REJECTED' || error.message?.includes('User denied transaction')) {
            notyf.error('您已在錢包中取消了交易。');
        } else if (error.message !== 'Insufficient funds') {
            console.error("交易失敗:", error);
            notyf.error(`交易失敗：${error.message}`);
        }
    } finally {
        confirmBetBtn.disabled = false;
        confirmBetBtn.innerText = originalButtonText;
    }
    
    betAmountInput.value = '';
}

// --- 自動登入 (使用 walletService) ---
async function autoLogin() {
    const savedAddress = localStorage.getItem('userWalletAddress');
    if (savedAddress) {
        console.log(`Found saved address: ${savedAddress}`);
        currentAccount = savedAddress; 
        try {
             if (BrowserExtensionWalletService.isAvailable()) {
                walletService = new BrowserExtensionWalletService();
                const accounts = await walletService.ethereum.request({ method: 'eth_accounts' });
                if (!accounts || accounts.length === 0 || accounts[0].toLowerCase() !== currentAccount) {
                    console.log("Wallet permission expired or account mismatch. Clearing.");
                    localStorage.removeItem('userWalletAddress');
                    currentAccount = null;
                    walletService = null; 
                    updateUI();
                    renderLeaderboard(); 
                    return; 
                }
                 walletService.signer = await walletService.provider.getSigner();
                 walletService.account = currentAccount; 
            } else {
                 console.log("Not in browser extension environment.");
                 updateUI(); 
                 renderLeaderboard();
                 return;
            }
            const user = await registerOrLogin(currentAccount);
            currentUser = user;
            updateUI();
            await renderHistory(currentAccount);
            initializeSocket(currentAccount);
            await renderLeaderboard();
            checkNetwork();
            setupWalletListeners();
        } catch (error) {
            console.error('Auto-login failed:', error);
            localStorage.removeItem('userWalletAddress');
            currentAccount = null; 
            currentUser = null;
            walletService = null;
            updateUI(); 
            renderLeaderboard();
        }
    } else {
        updateUI(); 
        renderLeaderboard(); 
    }
}

// --- Wallet 事件監聽器回呼函數 ---
const handleChainChanged = (chainId) => {
    console.log(`[WalletService] Network changed to: ${chainId}`);
    if (chainId !== SUPPORTED_CHAIN_ID) {
        showNetworkOverlay(`網路不正確！<br>請在 MetaMask 中切換回 Sepolia 網路。`);
    } else {
        hideNetworkOverlay();
        // 最好還是刷新一下，確保 Provider 狀態正確
        window.location.reload(); 
    }
};
const handleAccountsChanged = (accounts) => {
    console.log('[WalletService] Account changed.');
    let message = '';
    if (accounts.length === 0) {
        message = '您已斷開錢包連線。將為您登出。';
    } else if (currentAccount && accounts[0].toLowerCase() !== currentAccount) {
        message = '偵測到您已切換錢包帳號，將為您登出。';
    }
    if (message) {
        notyf.open({ type: 'warning', message: message });
        localStorage.removeItem('userWalletAddress');
        if (walletService) {
             walletService.disconnect().catch(err => console.error("Error disconnecting on account change:", err));
             walletService = null; 
        }
        currentAccount = null;
        currentUser = null; 
        updateUI(); 
        setTimeout(() => window.location.reload(), 1500); 
    }
};

// --- 設定 Wallet 監聽器 ---
function setupWalletListeners() {
    if (!walletService) return;
    console.log("Setting up wallet listeners...");
    walletService.off('chainChanged', handleChainChanged);
    walletService.off('accountsChanged', handleAccountsChanged);
    walletService.on('chainChanged', handleChainChanged);
    walletService.on('accountsChanged', handleAccountsChanged);
}

// --- 檢查網路 ---
async function checkNetwork() {
     if (!walletService) return;
     try {
         const network = await walletService.getProvider().getNetwork();
         const chainId = `0x${network.chainId.toString(16)}`; 
         console.log("[WalletService] Current Chain ID:", chainId);
         if (chainId !== SUPPORTED_CHAIN_ID) {
            showNetworkOverlay(`網路不正確！<br>請在 MetaMask 中切換回 Sepolia 網路。`);
         } else {
            hideNetworkOverlay();
         }
     } catch (error) {
         console.error("Failed to check network:", error);
         showNetworkOverlay(`無法檢查網路狀態，請稍後再試。`);
     }
}

// --- 應用程式啟動器 ---
function initializeApp() {
    console.log("✅ Ethers.js is ready. Initializing the app...");
    // 獲取所有 DOM 元素
    connectWalletBtn = document.getElementById('connectWalletBtn');
    logoutBtn = document.getElementById('logoutBtn');
    confirmBetBtn = document.getElementById('confirmBetBtn'); 
    userIdDisplay = document.getElementById('userIdDisplay'); 
    userWalletAddressDisplay = document.getElementById('userWalletAddressDisplay');
    betAmountInput = document.getElementById('betAmount'); 
    userStreakDisplay = document.getElementById('userStreakDisplay');
    userMaxStreakDisplay = document.getElementById('userMaxStreakDisplay');

    // 綁定事件
    connectWalletBtn.addEventListener('click', handleConnectWallet);
    logoutBtn.addEventListener('click', handleLogout);
    confirmBetBtn.addEventListener('click', handleConfirmBet);

    // 初始化 UI 和列表
    updateUI(); 
    document.getElementById('historyList').innerHTML = '<li>连接钱包以查看历史记录</li>';
    document.getElementById('leaderboardList').innerHTML = '<li>Loading...</li>'; 

    if (typeof io !== 'undefined') {
        console.log("✅ Socket.io Client is ready.");
        autoLogin(); // 直接嘗試自動登入
    } else {
        console.error("Socket.io Client failed to load!");
        updateUI(); 
        renderLeaderboard(); 
    }
}

// --- 程式入口 ---
function waitForEthers() {
    // ★★★ 確保這裡檢查的是 window.ethers ★★★
    if (typeof window.ethers !== 'undefined') { 
        waitForSocketIO();
    } else {
        console.log("⏳ Waiting for Ethers.js to load...");
        setTimeout(waitForEthers, 100);
    }
}
function waitForSocketIO() {
    if (typeof window.io !== 'undefined') {
        initializeApp();
    } else {
        console.log("⏳ Waiting for Socket.io Client to load...");
        setTimeout(waitForSocketIO, 100);
    }
}
document.addEventListener('DOMContentLoaded', waitForEthers);