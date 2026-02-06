// 診斷歸集服務腳本
// 用法: cd apps/backend-legacy && node ../../scripts/diagnose-collection.js

const path = require('path');
// 從專案根目錄載入 .env
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('@flipcoin/database');
const TronWeb = require('tronweb');

const NILE_NODE_HOST = process.env.NILE_NODE_HOST;
const USDT_CONTRACT_ADDRESS = process.env.USDT_CONTRACT_ADDRESS || 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';
const USDT_DECIMALS = 6;

async function diagnose() {
    console.log('==========================================');
    console.log('歸集服務診斷工具');
    console.log('==========================================\n');

    try {
        // 1. 檢查歸集設定
        console.log('1️⃣  檢查歸集設定 (collection_settings)...');
        const settingsResult = await db.query(
            `SELECT * FROM collection_settings ORDER BY created_at DESC`
        );
        
        if (settingsResult.rows.length === 0) {
            console.log('❌ 未找到任何歸集設定！');
            console.log('   請先在後台管理界面創建歸集設定。\n');
        } else {
            settingsResult.rows.forEach(setting => {
                console.log(`   設定 ID: ${setting.id}`);
                console.log(`   歸集錢包地址: ${setting.collection_wallet_address}`);
                console.log(`   是否啟用: ${setting.is_active ? '✅ 是' : '❌ 否'}`);
                console.log(`   無充值天數閾值: ${setting.days_without_deposit} 天`);
                console.log(`   掃描間隔: ${setting.scan_interval_days} 天`);
                console.log(`   創建時間: ${setting.created_at}`);
                console.log(`   更新時間: ${setting.updated_at}\n`);
            });
        }

        // 2. 檢查歸集游標
        console.log('2️⃣  檢查歸集游標 (collection_cursor)...');
        const cursorResult = await db.query(`SELECT * FROM collection_cursor LIMIT 1`);
        
        if (cursorResult.rows.length === 0) {
            console.log('❌ 游標未初始化！');
            console.log('   將在首次執行歸集時自動創建。\n');
        } else {
            const cursor = cursorResult.rows[0];
            console.log(`   當前游標位置: ${cursor.last_processed_user_id}`);
            console.log(`   最後更新時間: ${cursor.updated_at}\n`);
        }

        // 3. 檢查 hans01 和 hans02 用戶
        console.log('3️⃣  檢查目標用戶 (hans01, hans02)...');
        const usersResult = await db.query(
            `SELECT id, user_id, username, deposit_path_index, tron_deposit_address, created_at
             FROM users 
             WHERE username IN ('hans01', 'hans02')
             ORDER BY id ASC`
        );
        
        if (usersResult.rows.length === 0) {
            console.log('❌ 未找到 hans01 或 hans02 用戶！\n');
        } else {
            console.log(`   找到 ${usersResult.rows.length} 個用戶：\n`);
            
            for (const user of usersResult.rows) {
                console.log(`   ───────────────────────────────────────`);
                console.log(`   用戶名: ${user.username}`);
                console.log(`   用戶 ID: ${user.user_id}`);
                console.log(`   數據庫 ID: ${user.id}`);
                console.log(`   充值地址: ${user.tron_deposit_address}`);
                console.log(`   派生路徑索引: ${user.deposit_path_index}`);
                console.log(`   註冊時間: ${user.created_at}`);

                // 檢查 USDT 余額
                try {
                    const tronWeb = new TronWeb({
                        fullHost: NILE_NODE_HOST,
                        privateKey: '01'
                    });
                    
                    const usdtContractHex = tronWeb.address.toHex(USDT_CONTRACT_ADDRESS);
                    const userAddressHex = tronWeb.address.toHex(user.tron_deposit_address);
                    
                    const transaction = await tronWeb.transactionBuilder.triggerConstantContract(
                        usdtContractHex,
                        'balanceOf(address)',
                        {},
                        [{ type: 'address', value: userAddressHex }]
                    );
                    
                    if (transaction && transaction.constant_result && transaction.constant_result[0]) {
                        const balance = '0x' + transaction.constant_result[0];
                        const balanceBigInt = BigInt(balance);
                        const balanceUSDT = parseFloat(balanceBigInt.toString()) / (10**USDT_DECIMALS);
                        console.log(`   💰 USDT 餘額: ${balanceUSDT.toFixed(6)} USDT`);
                        
                        if (balanceUSDT > 0) {
                            console.log(`   ✅ 有餘額可歸集`);
                        } else {
                            console.log(`   ⚠️  無餘額`);
                        }
                    } else {
                        console.log(`   ❌ 無法獲取 USDT 餘額`);
                    }
                } catch (balanceError) {
                    console.log(`   ❌ 獲取 USDT 餘額失敗: ${balanceError.message}`);
                }

                // 檢查最後充值時間
                const depositResult = await db.query(
                    `SELECT created_at FROM platform_transactions 
                     WHERE user_id = $1 AND type = 'deposit' AND status = 'completed' 
                     ORDER BY created_at DESC LIMIT 1`,
                    [user.user_id]
                );
                
                if (depositResult.rows.length > 0) {
                    const lastDeposit = depositResult.rows[0].created_at;
                    const daysSince = (Date.now() - new Date(lastDeposit).getTime()) / (1000 * 60 * 60 * 24);
                    console.log(`   最後充值時間: ${lastDeposit}`);
                    console.log(`   距今天數: ${daysSince.toFixed(1)} 天`);
                } else {
                    const daysSinceCreation = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24);
                    console.log(`   ⚠️  無充值記錄`);
                    console.log(`   註冊距今: ${daysSinceCreation.toFixed(1)} 天`);
                }

                // 檢查歸集日誌
                const collectionLogsResult = await db.query(
                    `SELECT * FROM collection_logs 
                     WHERE user_id = $1 
                     ORDER BY created_at DESC LIMIT 3`,
                    [user.user_id]
                );
                
                if (collectionLogsResult.rows.length > 0) {
                    console.log(`   📋 歸集記錄 (最近 ${collectionLogsResult.rows.length} 筆):`);
                    collectionLogsResult.rows.forEach(log => {
                        console.log(`      - ${log.created_at}: ${log.status} (${log.amount} USDT)`);
                        if (log.error_message) {
                            console.log(`        錯誤: ${log.error_message.substring(0, 100)}...`);
                        }
                    });
                } else {
                    console.log(`   ⚠️  無歸集記錄`);
                }

                // 檢查重試隊列
                const retryQueueResult = await db.query(
                    `SELECT * FROM collection_retry_queue WHERE user_id = $1`,
                    [user.user_id]
                );
                
                if (retryQueueResult.rows.length > 0) {
                    const retry = retryQueueResult.rows[0];
                    console.log(`   🔄 重試隊列狀態:`);
                    console.log(`      重試次數: ${retry.retry_count}`);
                    console.log(`      下次重試: ${retry.next_retry_at}`);
                    console.log(`      錯誤原因: ${retry.error_reason ? retry.error_reason.substring(0, 100) : '無'}`);
                } else {
                    console.log(`   ✅ 不在重試隊列中`);
                }
                
                console.log('');
            }
        }

        // 4. 檢查歸集錢包
        console.log('\n4️⃣  檢查歸集錢包狀態...');
        const walletsResult = await db.query(
            `SELECT * FROM platform_wallets 
             WHERE chain_type = 'TRC20' AND is_collection = true AND is_active = true`
        );
        
        if (walletsResult.rows.length === 0) {
            console.log('❌ 未找到啟用的歸集錢包！\n');
        } else {
            for (const wallet of walletsResult.rows) {
                console.log(`   錢包地址: ${wallet.address}`);
                console.log(`   是否啟用: ${wallet.is_active ? '✅ 是' : '❌ 否'}`);
                
                // 檢查私鑰是否在環境變量中
                const pkEnvVar = `TRON_PK_${wallet.address}`;
                const hasPK = !!process.env[pkEnvVar];
                console.log(`   私鑰 (${pkEnvVar}): ${hasPK ? '✅ 已配置' : '❌ 未配置'}`);
                
                // 檢查能量
                try {
                    const tronWeb = new TronWeb({
                        fullHost: NILE_NODE_HOST,
                        privateKey: '01'
                    });
                    
                    const resources = await tronWeb.trx.getAccountResources(wallet.address);
                    const energyLimit = Number(resources?.EnergyLimit || 0);
                    const energyUsed = Number(resources?.EnergyUsed || 0);
                    const availableEnergy = energyLimit - energyUsed;
                    
                    console.log(`   能量狀態:`);
                    console.log(`      總能量: ${energyLimit}`);
                    console.log(`      已使用: ${energyUsed}`);
                    console.log(`      可用: ${availableEnergy}`);
                    
                    if (availableEnergy < 35000) {
                        console.log(`   ⚠️  能量不足 (建議至少 35000)`);
                    } else {
                        console.log(`   ✅ 能量充足`);
                    }
                } catch (energyError) {
                    console.log(`   ❌ 獲取能量失敗: ${energyError.message}`);
                }
                
                console.log('');
            }
        }

        // 5. 檢查最近的歸集日誌
        console.log('\n5️⃣  檢查最近的歸集日誌 (所有用戶)...');
        const recentLogsResult = await db.query(
            `SELECT cl.*, u.username 
             FROM collection_logs cl
             LEFT JOIN users u ON cl.user_id = u.user_id
             ORDER BY cl.created_at DESC 
             LIMIT 10`
        );
        
        if (recentLogsResult.rows.length === 0) {
            console.log('⚠️  無任何歸集記錄！這表示歸集服務可能從未執行過。\n');
        } else {
            console.log(`   最近 ${recentLogsResult.rows.length} 筆歸集記錄:\n`);
            recentLogsResult.rows.forEach(log => {
                console.log(`   [${log.created_at}] ${log.username || log.user_id}: ${log.status} (${log.amount} USDT)`);
                if (log.tx_hash) {
                    console.log(`      TX: ${log.tx_hash}`);
                }
                if (log.error_message) {
                    console.log(`      錯誤: ${log.error_message.substring(0, 100)}...`);
                }
            });
            console.log('');
        }

        // 6. 總結與建議
        console.log('\n==========================================');
        console.log('診斷總結與建議');
        console.log('==========================================\n');

        // 檢查關鍵問題
        const activeSettings = settingsResult.rows.filter(s => s.is_active);
        const hasCollectionWallet = walletsResult.rows.length > 0;
        const hasRecentLogs = recentLogsResult.rows.length > 0;

        if (activeSettings.length === 0) {
            console.log('❌ 關鍵問題：未找到啟用的歸集設定');
            console.log('   解決方案：在後台管理界面的「歸集設定」頁面創建並啟用歸集設定\n');
        }

        if (!hasCollectionWallet) {
            console.log('❌ 關鍵問題：未找到啟用的歸集錢包');
            console.log('   解決方案：在 platform_wallets 表中配置歸集錢包，並確保 is_collection = true, is_active = true\n');
        }

        if (!hasRecentLogs) {
            console.log('⚠️  警告：無任何歸集記錄');
            console.log('   可能原因：');
            console.log('   1. 歸集服務從未執行（檢查服務是否正常啟動）');
            console.log('   2. 所有用戶都不符合歸集條件（檢查 days_without_deposit 設定）');
            console.log('   3. 能量不足導致無法執行歸集\n');
        }

        // 針對 hans01 和 hans02 的建議
        if (usersResult.rows.length > 0) {
            console.log('📌 針對 hans01 和 hans02 的建議:\n');
            
            const cursor = cursorResult.rows[0];
            if (cursor) {
                const maxUserId = Math.max(...usersResult.rows.map(u => u.id));
                if (cursor.last_processed_user_id < maxUserId) {
                    console.log(`   ✅ 游標位置 (${cursor.last_processed_user_id}) 尚未處理到這些用戶 (ID: ${usersResult.rows.map(u => u.id).join(', ')})`);
                    console.log('      等待下一次歸集循環即可。\n');
                } else {
                    console.log(`   ⚠️  游標已超過這些用戶的位置`);
                    console.log('      需要等待游標重置（到達用戶列表末尾時自動重置）\n');
                }
            }

            if (activeSettings.length > 0) {
                const setting = activeSettings[0];
                console.log(`   當前歸集條件: 無充值天數 >= ${setting.days_without_deposit} 天`);
                console.log('   如果用戶最近有充值，需要等待達到條件後才會歸集。\n');
            }
        }

        console.log('建議操作步驟:');
        console.log('1. 確保 collection_settings 表中有啟用的設定');
        console.log('2. 確保 platform_wallets 表中有啟用的歸集錢包');
        console.log('3. 確保歸集錢包有足夠的能量');
        console.log('4. 檢查服務日誌，確認歸集服務是否正常運行');
        console.log('5. 如需立即歸集，可以在後台管理界面手動觸發歸集任務\n');

    } catch (error) {
        console.error('診斷過程中發生錯誤:', error);
    } finally {
        await db.pool.end();
    }
}

diagnose();
