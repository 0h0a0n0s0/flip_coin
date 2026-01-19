// 诊断脚本：检查钱包配置冲突
// 用法：node scripts/check-wallet-config.js

const db = require('@flipcoin/database');

async function checkWalletConfig() {
    try {
        console.log('=== 钱包配置诊断 ===\n');
        
        // 检查所有活跃的钱包
        const allWallets = await db.query(
            `SELECT address, name, 
                    is_energy_provider, 
                    is_collection, 
                    is_payout, 
                    is_gas_reserve,
                    is_active
             FROM platform_wallets 
             WHERE chain_type = 'TRC20' AND is_active = true
             ORDER BY address`
        );
        
        console.log(`找到 ${allWallets.rows.length} 个活跃的 TRC20 钱包：\n`);
        
        // 检查能量提供者钱包
        const energyProviders = allWallets.rows.filter(w => w.is_energy_provider);
        console.log(`能量提供者钱包 (${energyProviders.length} 个)：`);
        energyProviders.forEach(w => {
            const conflicts = [];
            if (w.is_collection) conflicts.push('归集');
            if (w.is_payout) conflicts.push('出款');
            if (w.is_gas_reserve) conflicts.push('Gas储备');
            
            if (conflicts.length > 0) {
                console.log(`  ⚠️  ${w.address} (${w.name || 'N/A'})`);
                console.log(`     冲突功能: ${conflicts.join(', ')}`);
                console.log(`     ⚠️  警告：能量提供者钱包被用于其他功能，会导致能量被消耗！`);
            } else {
                console.log(`  ✅ ${w.address} (${w.name || 'N/A'}) - 配置正常`);
            }
        });
        
        console.log('\n');
        
        // 检查归集钱包
        const collectionWallets = allWallets.rows.filter(w => w.is_collection);
        console.log(`归集钱包 (${collectionWallets.length} 个)：`);
        collectionWallets.forEach(w => {
            const info = [];
            if (w.is_energy_provider) info.push('⚠️ 同时是能量提供者');
            console.log(`  ${w.is_energy_provider ? '⚠️' : '✅'} ${w.address} (${w.name || 'N/A'})${info.length > 0 ? ' - ' + info.join(', ') : ''}`);
        });
        
        console.log('\n');
        
        // 检查出款钱包
        const payoutWallets = allWallets.rows.filter(w => w.is_payout);
        console.log(`出款钱包 (${payoutWallets.length} 个)：`);
        payoutWallets.forEach(w => {
            const info = [];
            if (w.is_energy_provider) info.push('⚠️ 同时是能量提供者');
            console.log(`  ${w.is_energy_provider ? '⚠️' : '✅'} ${w.address} (${w.name || 'N/A'})${info.length > 0 ? ' - ' + info.join(', ') : ''}`);
        });
        
        console.log('\n=== 配置总结 ===\n');
        
        // 检查是否有冲突
        const conflicts = allWallets.rows.filter(w => 
            w.is_energy_provider && (w.is_collection || w.is_payout)
        );
        
        if (conflicts.length > 0) {
            console.log(`❌ 发现 ${conflicts.length} 个配置冲突：\n`);
            conflicts.forEach(w => {
                console.log(`  地址: ${w.address}`);
                console.log(`  名称: ${w.name || 'N/A'}`);
                console.log(`  冲突: 能量提供者 + ${w.is_collection ? '归集' : ''}${w.is_collection && w.is_payout ? ' + ' : ''}${w.is_payout ? '出款' : ''}`);
                console.log(`  建议: 将归集/出款功能迁移到其他钱包，保持能量提供者钱包仅用于能量租赁\n`);
            });
        } else {
            console.log('✅ 未发现配置冲突\n');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ 诊断失败:', error);
        process.exit(1);
    }
}

checkWalletConfig();
