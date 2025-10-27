/**
 * Implements WalletService interface using browser extension (e.g., MetaMask)
 */
export class BrowserExtensionWalletService {
    constructor() {
        if (typeof window.ethereum === 'undefined') {
            throw new Error('MetaMask（或兼容扩展）未安装。');
        }
        // ★★★ 在使用前确保 window.ethers 已定义 ★★★
        if (typeof window.ethers === 'undefined') {
            throw new Error('Ethers.js 库未加载，请检查 index.html。');
        }
        this.ethereum = window.ethereum;
        // ★★★ 在此使用 window.ethers ★★★
        this.provider = new window.ethers.BrowserProvider(this.ethereum); 
        this.signer = null; 
        this.account = null; 
    }

    async connect() {
        try {
            const accounts = await this.ethereum.request({ method: 'eth_requestAccounts' });
            if (!accounts || accounts.length === 0) {
                throw new Error('未选择账号或拒绝权限。');
            }
            this.account = accounts[0].toLowerCase();
            this.signer = await this.provider.getSigner();
            console.log("[WalletService] 已连接：", this.account);
            return this.account;
        } catch (err) {
            console.error("[WalletService] 连接错误：", err);
            if (err.code === 4001 || err.message?.includes('User rejected')) {
                throw new Error('用户拒绝连接请求。');
            }
            throw new Error(`连接钱包失败：${err.message || err}`);
        }
    }

    async disconnect() {
        console.log("[WalletService] 正在断开连接（撤销权限）...");
        try {
            await this.ethereum.request({
                method: 'wallet_revokePermissions',
                params: [{ eth_accounts: {} }]
            });
            this.account = null;
            this.signer = null;
            console.log("[WalletService] 权限已撤销。");
        } catch (err) {
            console.error("[WalletService] 断开连接错误：", err);
            this.account = null;
            this.signer = null;
            console.error(`撤销权限失败：${err.message || err}`);
        }
    }

    getAccount() {
        return this.account;
    }

    getProvider() {
        return this.provider;
    }

    getSigner() {
        if (!this.signer) {
            throw new Error("钱包未连接或 signer 初始化失败。"); 
        }
        return this.signer;
    }

    on(event, callback) {
        this.ethereum.on(event, callback);
    }

    off(event, callback) {
        this.ethereum.removeListener(event, callback);
    }

    static isAvailable() {
        return typeof window.ethereum !== 'undefined';
    }
}