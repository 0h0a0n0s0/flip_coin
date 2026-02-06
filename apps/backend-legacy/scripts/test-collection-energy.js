// 測試歸集能量消耗記錄
// 用法: cd apps/backend-legacy && node scripts/test-collection-energy.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const db = require('@flipcoin/database');
const TronWeb = require('tronweb');

const NILE_NODE_HOST = process.env.NILE_NODE_HOST;

async function testEnergyTracking() {
    console.log('==========================================');
    console.log('測試歸集能量追蹤');
    console.log('==========================================\n');

    try {
        // 查詢最近的歸集記錄
        console.log('📋 查詢最近的歸集記錄...\n');
        const logsResult = await db.query(
            `SELECT 
                id, user_id, amount, tx_hash, 
                energy_used, bandwidth_used, energy_fee,
                status, created_at
             FROM collection_logs 
             ORDER BY created_at DESC 
             LIMIT 5`
        );

        if (logsResult.rows.length === 0) {
            console.log('⚠️  沒有找到歸集記錄\n');
            return;
        }

        console.log(`找到 ${logsResult.rows.length} 筆最近的歸集記錄:\n`);
        
        for (const log of logsResult.rows) {
            console.log(`記錄 ID: ${log.id}`);
            console.log(`用戶 ID: ${log.user_id}`);
            console.log(`金額: ${log.amount} USDT`);
            console.log(`狀態: ${log.status}`);
            console.log(`TX Hash: ${log.tx_hash || '無'}`);
            console.log(`能量消耗: ${log.energy_used !== null ? log.energy_used : '未記錄'}`);
            console.log(`帶寬消耗: ${log.bandwidth_used !== null ? log.bandwidth_used : '未記錄'}`);
            console.log(`能量費用: ${log.energy_fee !== null ? log.energy_fee + ' SUN' : '未記錄'}`);
            console.log(`創建時間: ${log.created_at}`);
            
            // 如果有 TX Hash，從鏈上查詢交易信息
            if (log.tx_hash && log.status === 'completed') {
                try {
                    const tronWeb = new TronWeb({
                        fullHost: NILE_NODE_HOST,
                        privateKey: '01'
                    });
                    
                    const txInfo = await tronWeb.trx.getTransactionInfo(log.tx_hash);
                    
                    if (txInfo && txInfo.receipt) {
                        const chainEnergyUsed = txInfo.receipt.energy_usage_total || 0;
                        const chainBandwidthUsed = txInfo.receipt.net_usage || 0;
                        const chainEnergyFee = txInfo.receipt.energy_fee || 0;
                        
                        console.log(`\n鏈上實際數據:`);
                        console.log(`  能量消耗: ${chainEnergyUsed}`);
                        console.log(`  帶寬消耗: ${chainBandwidthUsed}`);
                        console.log(`  能量費用: ${chainEnergyFee} SUN`);
                        
                        // 檢查是否一致
                        if (log.energy_used !== chainEnergyUsed) {
                            console.log(`  ⚠️  能量消耗不一致! 數據庫: ${log.energy_used}, 鏈上: ${chainEnergyUsed}`);
                        } else {
                            console.log(`  ✅ 能量消耗記錄正確`);
                        }
                        
                        if (log.bandwidth_used !== chainBandwidthUsed) {
                            console.log(`  ⚠️  帶寬消耗不一致! 數據庫: ${log.bandwidth_used}, 鏈上: ${chainBandwidthUsed}`);
                        } else {
                            console.log(`  ✅ 帶寬消耗記錄正確`);
                        }
                    }
                } catch (txError) {
                    console.log(`  ⚠️  無法獲取鏈上交易信息: ${txError.message}`);
                }
            }
            
            console.log('\n' + '─'.repeat(60) + '\n');
        }

        // 檢查能量租賃記錄
        console.log('\n📋 查詢能量租賃記錄...\n');
        const rentalsResult = await db.query(
            `SELECT * FROM energy_rentals ORDER BY created_at DESC LIMIT 5`
        );
        
        if (rentalsResult.rows.length === 0) {
            console.log('⚠️  沒有找到能量租賃記錄');
            console.log('說明: 歸集時可能使用了免費帶寬，沒有觸發能量租賃\n');
        } else {
            console.log(`找到 ${rentalsResult.rows.length} 筆能量租賃記錄:\n`);
            rentalsResult.rows.forEach(rental => {
                console.log(`租賃 ID: ${rental.id}`);
                console.log(`提供者地址: ${rental.provider_address}`);
                console.log(`接收者地址: ${rental.receiver_address}`);
                console.log(`能量數量: ${rental.energy_amount}`);
                console.log(`狀態: ${rental.status}`);
                console.log(`TX ID: ${rental.tx_id || '無'}`);
                console.log(`創建時間: ${rental.created_at}\n`);
            });
        }

        // 總結
        console.log('\n==========================================');
        console.log('測試總結');
        console.log('==========================================\n');
        
        const hasEnergyUsed = logsResult.rows.some(log => log.energy_used > 0);
        const hasBandwidthUsed = logsResult.rows.some(log => log.bandwidth_used > 0);
        
        if (hasEnergyUsed) {
            console.log('✅ 有歸集記錄消耗了能量');
        } else {
            console.log('⚠️  所有歸集記錄都沒有消耗能量');
        }
        
        if (hasBandwidthUsed) {
            console.log('✅ 有歸集記錄消耗了帶寬');
        } else {
            console.log('⚠️  所有歸集記錄都沒有消耗帶寬');
        }
        
        if (!hasEnergyUsed && !hasBandwidthUsed) {
            console.log('\n💡 可能的原因:');
            console.log('1. 歸集錢包有足夠的免費帶寬');
            console.log('2. 交易信息獲取失敗（等待時間不足）');
            console.log('3. 代碼邏輯有問題');
        }
        
        console.log('');

    } catch (error) {
        console.error('測試過程中發生錯誤:', error);
    } finally {
        await db.pool.end();
    }
}

testEnergyTracking();
