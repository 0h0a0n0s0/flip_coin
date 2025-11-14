// 檔案: backend/services/KmsService.js (★★★ v8.49 修正版 ★★★)

const { ethers } = require('ethers');
const bip39 = require('bip39');
const HDKey = require('hdkey');
const TronWeb = require('tronweb');
const db = require('../db');

// (HD 錢包派生路徑)
const EVM_PATH = "m/44'/60'/0'/0"; // (用於 BSC, ETH, Polygon)
const TRON_PATH = "m/44'/195'/0'/0"; // (用於 TRC20)

// (★★★ v8.49 修正：從 .env 讀取節點 ★★★)
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
        
        // (★★★ v8.49 修正：使用 tronweb@5.3.2 的建構函式並指定新節點 ★★★)
        this.tronWeb = new TronWeb({
            fullHost: NILE_NODE_HOST,
            solidityHost: NILE_NODE_HOST,
            privateKey: '01' // 佔位符
        });
        this.tronWeb.setFullNode(NILE_NODE_HOST);
        this.tronWeb.setSolidityNode(NILE_NODE_HOST);
        this.tronWeb.setEventServer(NILE_NODE_HOST);
        
        this.PLATFORM_RESERVED_INDEX_UNTIL = 100;

        console.log("✅ [v7] KmsService initialized successfully.");
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
        // ... (保持不變) ...
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
        // ... (保持不變) ...
        const result = await client.query(
            'SELECT MAX(deposit_path_index) FROM users'
        );
        const maxIndexInDb = result.rows[0].max || 0; 
        const maxIndex = Math.max(maxIndexInDb, this.PLATFORM_RESERVED_INDEX_UNTIL);
        const newIndex = maxIndex + 1;
        const evmWallet = this._deriveEvmWallet(newIndex);
        const tronWallet = this._deriveTronWallet(newIndex);
        console.log(`[KMS] Generated new wallet set for index ${newIndex}: EVM (${evmWallet.address}), TRON (${tronWallet.address})`);
        return {
            deposit_path_index: newIndex,
            evm_deposit_address: evmWallet.address,
            tron_deposit_address: tronWallet.address
        };
    }
}

// (單例模式保持不變)
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