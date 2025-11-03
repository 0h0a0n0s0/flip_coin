// 檔案: backend/services/KmsService.js (★★★ v7.1 新檔案 ★★★)

const { ethers } = require('ethers');
const bip39 = require('bip39');
const HDKey = require('hdkey');
const TronWeb = require('tronweb');
const db = require('../db');

// (★★★ v7 HD 錢包派生路徑 ★★★)
const EVM_PATH = "m/44'/60'/0'/0"; // (用於 BSC, ETH, Polygon)
const TRON_PATH = "m/44'/195'/0'/0"; // (用於 TRC20)

/**
 * Key Management Service (KMS)
 * 負責從主助記詞派生所有用戶的錢包。
 * * !!! 警告 !!!
 * 此服務持有根私鑰，是系統最高安全級別。
 * 嚴禁將主助記詞 (MASTER_MNEMONIC) 或任何私鑰洩漏到日誌中。
 */
class KmsService {
    constructor() {
        if (!process.env.MASTER_MNEMONIC) {
            throw new Error('CRITICAL: MASTER_MNEMONIC is not set in .env file!');
        }
        
        // 1. 從助記詞生成根種子 (root seed)
        const seed = bip39.mnemonicToSeedSync(process.env.MASTER_MNEMONIC);
        
        // 2. 從根種子生成主節點 (master node)
        this.masterNode = HDKey.fromMasterSeed(seed);
        
        // 3. 初始化 TronWeb (僅用於地址計算，不需私鑰)
        this.tronWeb = new TronWeb({
            fullHost: 'https://api.trongrid.io', // 使用公共節點
            // (不需要私鑰)
        });
        
        console.log("✅ [v7] KmsService initialized successfully.");
    }

    /**
     * 派生指定索引的 EVM (0x...) 錢包
     * @param {number} index - 用戶的 deposit_path_index
     * @returns {{address: string, privateKey: string}}
     */
    _deriveEvmWallet(index) {
        // 1. 派生子節點
        const childNode = this.masterNode.derive(`${EVM_PATH}/${index}`);
        
        // 2. 獲取私鑰 (Buffer)
        const privateKeyBuffer = childNode.getWallet().getPrivateKey();
        
        // 3. 獲取錢包地址 (0x...)
        const address = childNode.getWallet().getAddressString();
        
        // 4. 轉換私鑰為 Hex 字串 (★★★ 警告：極度敏感 ★★★)
        const privateKey = privateKeyBuffer.toString('hex');
        
        return { address, privateKey };
    }

    /**
     * 派生指定索引的 TRON (T...) 錢包
     * @param {number} index - 用戶的 deposit_path_index
     * @returns {{address: string, privateKey: string}}
     */
    _deriveTronWallet(index) {
        // 1. 派生 TRON 子節點
        const childNode = this.masterNode.derive(`${TRON_PATH}/${index}`);
        
        // 2. 獲取私鑰 (Buffer)
        const privateKeyBuffer = childNode.getWallet().getPrivateKey();
        
        // 3. 轉換私鑰為 Hex 字串 (★★★ 警告：極度敏感 ★★★)
        const privateKey = privateKeyBuffer.toString('hex');
        
        // 4. 使用 TronWeb 從私鑰計算地址 (T...)
        const address = this.tronWeb.address.fromPrivateKey(privateKey);
        
        return { address, privateKey };
    }
    
    /**
     * (供歸集服務使用) 根據路徑索引獲取特定鏈的私鑰
     * @param {string} chainType - 'EVM' or 'TRC20'
     * @param {number} index - deposit_path_index
     * @returns {string} Private Key (Hex)
     */
    getPrivateKey(chainType, index) {
        console.log(`[KMS] Getting private key for chain ${chainType}, index ${index}`);
        if (chainType === 'EVM') {
            return this._deriveEvmWallet(index).privateKey;
        }
        if (chainType === 'TRC20') {
            return this._deriveTronWallet(index).privateKey;
        }
        throw new Error(`[KMS] Unsupported chainType: ${chainType}`);
    }

    /**
     * (供註冊時使用) 獲取下一組可用的新充值地址
     * @returns {Promise<{ deposit_path_index: number, evm_deposit_address: string, tron_deposit_address: string }>}
     */
    async getNewDepositWallets() {
        // 1. 查找當前最大的索引
        // (我們使用 PostgreSQL 的 COALESCE 來處理 DB 為空的情況)
        const result = await db.query('SELECT MAX(deposit_path_index) FROM users');
        const maxIndex = result.rows[0].max || 0; // 如果是 null，則為 0
        
        const newIndex = maxIndex + 1;

        // 2. 派生 EVM 地址
        const evmWallet = this._deriveEvmWallet(newIndex);
        
        // 3. 派生 TRON 地址
        const tronWallet = this._deriveTronWallet(newIndex);

        console.log(`[KMS] Generated new wallet set for index ${newIndex}: EVM (${evmWallet.address}), TRON (${tronWallet.address})`);
        
        // 4. 返回索引和地址 (★★★ 絕不返回私鑰 ★★★)
        return {
            deposit_path_index: newIndex,
            evm_deposit_address: evmWallet.address,
            tron_deposit_address: tronWallet.address
        };
    }
}

// (使用單例模式，確保整個應用程式只有一個 KMS 實例)
let instance = null;

/**
 * 獲取 KMS 服務的單一實例
 * @returns {KmsService}
 */
function getKmsInstance() {
    if (!instance) {
        instance = new KmsService();
    }
    return instance;
}

module.exports = {
    getKmsInstance
};