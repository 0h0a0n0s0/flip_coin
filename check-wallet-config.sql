-- 检查钱包配置冲突的诊断 SQL
-- 在数据库中执行此查询以检查配置冲突

-- 1. 检查所有活跃的钱包配置
SELECT 
    address, 
    name,
    is_energy_provider,
    is_collection,
    is_payout,
    is_gas_reserve,
    is_active
FROM platform_wallets
WHERE chain_type = 'TRC20' 
  AND is_active = true
ORDER BY address;

-- 2. 检查能量提供者钱包配置
SELECT 
    address, 
    name,
    is_energy_provider,
    is_collection,
    is_payout,
    is_gas_reserve
FROM platform_wallets
WHERE chain_type = 'TRC20' 
  AND is_active = true
  AND is_energy_provider = true
ORDER BY address;

-- 3. 检查配置冲突（能量提供者同时用于其他功能）
SELECT 
    address, 
    name,
    is_energy_provider,
    is_collection,
    is_payout,
    CASE 
        WHEN is_collection THEN '归集'
        WHEN is_payout THEN '出款'
        ELSE ''
    END as conflict_role
FROM platform_wallets
WHERE chain_type = 'TRC20' 
  AND is_active = true
  AND is_energy_provider = true
  AND (is_collection = true OR is_payout = true)
ORDER BY address;
