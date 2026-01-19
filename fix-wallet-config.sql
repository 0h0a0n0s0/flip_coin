-- 修复钱包配置冲突
-- 将归集钱包从能量提供者角色中移除

-- 方案1：将归集钱包从能量提供者角色中移除（推荐）
UPDATE platform_wallets 
SET is_energy_provider = false 
WHERE address = 'TQxXoL3uCx3BKTBffQLA1rExjv6a3fzaDh' 
  AND is_energy_provider = true 
  AND is_collection = true;

-- 验证修复结果
SELECT address, name, is_energy_provider, is_collection, is_payout 
FROM platform_wallets 
WHERE address = 'TQxXoL3uCx3BKTBffQLA1rExjv6a3fzaDh';

-- 检查是否还有其他冲突
SELECT address, name, is_energy_provider, is_collection, is_payout 
FROM platform_wallets 
WHERE chain_type = 'TRC20' 
  AND is_active = true 
  AND is_energy_provider = true 
  AND (is_collection = true OR is_payout = true);
