// 档案: backend/services/KmsService.js (★★★ v8.49 修正版 ★★★)

const { ethers } = require('ethers');
const bip39 = require('bip39');
const HDKey = require('hdkey');
const TronWeb = require('tronweb');
const db = require('@flipcoin/database');

// (HD 钱包派生路径)
const EVM_PATH = "m/44'/60'/0'/0"; // (用于 BSC, ETH, Polygon)
const TRON_PATH = "m/44'/195'/0'/0"; // (用于 TRC20)

// (★★★ v8.49 修正：从 .env 读取节点 ★★★)
const NILE_NODE_HOST = process.env.NILE_NODE_HOST;
if (!NILE_NODE_HOST) {
    throw new Error("CRITICAL: NILE_NODE_HOST is not set in .env file! (e.g., https://go.getblock.io/YOUR_API_KEY/)");
}

class KmsService {
    constructor() {
        if (!process.env.MASTER_MNEMONIC) {
            throw new Error('CRITICAL: MASTER_MNEMONIC is not set in .env file!');
        }
        
        const seed = bip39.mnemonicToSeedSync(process.env.MASTER_MNEMONIC);
        this.masterNode = HDKey.fromMasterSeed(seed);
        
        // (★★★ v8.49 修正：使用 tronweb@5.3.2 的建构函式并指定新节点 ★★★)
        this.tronWeb = new TronWeb({
            fullHost: NILE_NODE_HOST,
            solidityHost: NILE_NODE_HOST,
            privateKey: '01' // 占位符
        });
        this.tronWeb.setFullNode(NILE_NODE_HOST);
        this.tronWeb.setSolidityNode(NILE_NODE_HOST);
        this.tronWeb.setEventServer(NILE_NODE_HOST);
        
        // (★★★ 修復：從環境變數讀取用戶起始索引，符合規則 3.1 ★★★)
        // WALLET_START_INDEX 表示用戶起始索引（預設 1000000），平台保留索引為其減 1
        const walletStartIndex = parseInt(process.env.WALLET_START_INDEX || '1000000', 10);
        this.PLATFORM_RESERVED_INDEX_UNTIL = walletStartIndex - 1;
        
        console.log(`✅ [v7] KmsService initialized successfully. Wallet start index: ${walletStartIndex} (platform reserved until: ${this.PLATFORM_RESERVED_INDEX_UNTIL})`);
    }
    
    // (★★★ v8.49 修正：使用 tronweb@5.3.2 的方式 ★★★)
    _deriveEvmWallet(index) {
        const childNode = this.masterNode.derive(`${EVM_PATH}/${index}`);
        const privateKeyBuffer = childNode.privateKey;
        const privateKeyHex = privateKeyBuffer.toString('hex');
        const wallet = new ethers.Wallet('0x' + privateKeyHex); 
        const address = wallet.address;
        return { address, privateKey: '0x' + privateKeyHex };
    }

    _deriveTronWallet(index) {
        const childNode = this.masterNode.derive(`${TRON_PATH}/${index}`);
        const privateKeyBuffer = childNode.privateKey;
        const privateKey = privateKeyBuffer.toString('hex');
        const address = this.tronWeb.address.fromPrivateKey(privateKey);
        return { address, privateKey };
    }
    
    getPrivateKey(chainType, index) {
        // ... (保持不变) ...
        console.log(`[KMS] Getting private key for chain ${chainType}, index ${index}`);
        if (chainType === 'EVM') {
            return this._deriveEvmWallet(index).privateKey;
        }
        if (chainType === 'TRC20') {
            return this._deriveTronWallet(index).privateKey;
        }
        throw new Error(`[KMS] Unsupported chainType: ${chainType}`);
    }

    async getNewDepositWallets(client) { 
        // (★★★ 修復競態條件：使用悲觀鎖確保索引分配的原子性 ★★★)
        // 使用 SELECT ... FOR UPDATE 鎖定索引追蹤記錄，防止並發衝突
        // 添加重試邏輯以處理併發衝突（最多重試 3 次）
        const maxRetries = 3;
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                // 使用 FOR UPDATE NOWAIT 快速失敗，避免長時間等待
                // 如果鎖定失敗，立即拋出錯誤，由外層重試邏輯處理
                const lockResult = await client.query(
                    `SELECT current_index FROM platform_wallets 
                     WHERE name = 'HD_WALLET_INDEX_TRACKER' 
                     FOR UPDATE NOWAIT`
                );
                
                let currentIndex;
                if (lockResult.rows.length === 0) {
                    // 如果追蹤記錄不存在，創建它（這種情況不應該發生，但作為安全措施）
                    // 注意：address 必須是唯一的，使用與遷移文件相同的值
                    await client.query(
                        `INSERT INTO platform_wallets (name, chain_type, address, current_index, is_active)
                         VALUES ('HD_WALLET_INDEX_TRACKER', 'MULTI', 'HD_INDEX_TRACKER_PLACEHOLDER', $1, false)
                         ON CONFLICT (address) DO NOTHING`,
                        [this.PLATFORM_RESERVED_INDEX_UNTIL]
                    );
                    // 重新查詢（使用 NOWAIT 確保立即獲得鎖）
                    const retryResult = await client.query(
                        `SELECT current_index FROM platform_wallets 
                         WHERE name = 'HD_WALLET_INDEX_TRACKER' 
                         FOR UPDATE NOWAIT`
                    );
                    if (retryResult.rows.length === 0) {
                        throw new Error('[KMS] CRITICAL: Failed to initialize HD_WALLET_INDEX_TRACKER record');
                    }
                    currentIndex = parseInt(retryResult.rows[0].current_index) || this.PLATFORM_RESERVED_INDEX_UNTIL;
                } else {
                    currentIndex = parseInt(lockResult.rows[0].current_index) || this.PLATFORM_RESERVED_INDEX_UNTIL;
                }
                
                // 確保新索引至少從用戶起始索引開始（PLATFORM_RESERVED_INDEX_UNTIL + 1）
                const minStartIndex = this.PLATFORM_RESERVED_INDEX_UNTIL + 1;
                const newIndex = Math.max(currentIndex + 1, minStartIndex);
                
                // 更新索引追蹤記錄（在同一事務中，確保原子性）
                await client.query(
                    `UPDATE platform_wallets 
                     SET current_index = $1 
                     WHERE name = 'HD_WALLET_INDEX_TRACKER'`,
                    [newIndex]
                );
                
                // 派生新錢包地址
                const evmWallet = this._deriveEvmWallet(newIndex);
                const tronWallet = this._deriveTronWallet(newIndex);
                
                console.log(`[KMS] Generated new wallet set for index ${newIndex}: EVM (${evmWallet.address}), TRON (${tronWallet.address})`);
                return {
                    deposit_path_index: newIndex,
                    evm_deposit_address: evmWallet.address,
                    tron_deposit_address: tronWallet.address
                };
            } catch (error) {
                // 如果是鎖定衝突錯誤（55P03），進行重試
                if (error.code === '55P03' && retryCount < maxRetries - 1) {
                    retryCount++;
                    const waitTime = Math.min(50 * retryCount, 200); // 指數退避，最多等待 200ms
                    console.warn(`[KMS] Lock conflict on getNewDepositWallets, retrying (${retryCount}/${maxRetries}) after ${waitTime}ms`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
                // 其他錯誤或達到最大重試次數，直接拋出
                throw error;
            }
        }
        
        // 理論上不會到達這裡，但作為安全措施
        throw new Error('[KMS] Failed to get new deposit wallets after maximum retries');
    }
}

// (单例模式保持不变)
let instance = null;

function getKmsInstance() {
if (!instance) {
    instance = new KmsService();
}
return instance;
}

module.exports = {
getKmsInstance
};