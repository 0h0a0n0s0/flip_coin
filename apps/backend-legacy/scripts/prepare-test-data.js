#!/usr/bin/env node
// 測試資料準備腳本
// 用於創建測試管理員和測試用戶

const db = require('@flipcoin/database');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function createTestAdmin() {
    try {
        console.log('正在創建測試管理員...');
        
        // 獲取 super_admin 角色 ID
        const roleResult = await db.query('SELECT id FROM admin_roles WHERE name = $1', ['super_admin']);
        if (roleResult.rows.length === 0) {
            console.error('錯誤：找不到 super_admin 角色，請先執行 init.sql');
            process.exit(1);
        }
        const roleId = roleResult.rows[0].id;
        
        // 檢查管理員是否已存在
        const existingAdmin = await db.query('SELECT id FROM admin_users WHERE username = $1', ['admin']);
        if (existingAdmin.rows.length > 0) {
            console.log('測試管理員已存在，跳過創建');
            return;
        }
        
        // 生成密碼哈希
        const passwordHash = await bcrypt.hash('admin123', 10);
        
        // 創建管理員
        await db.query(
            `INSERT INTO admin_users (username, password_hash, role_id, status, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            ['admin', passwordHash, roleId, 'active']
        );
        
        console.log('✓ 測試管理員創建成功');
        console.log('  用戶名: admin');
        console.log('  密碼: admin123');
    } catch (error) {
        console.error('創建測試管理員失敗:', error.message);
        process.exit(1);
    }
}

async function main() {
    console.log('=== 測試資料準備腳本 ===\n');
    
    await createTestAdmin();
    
    console.log('\n✓ 測試資料準備完成');
    console.log('\n注意：測試用戶可以通過 API 註冊端點創建');
    
    process.exit(0);
}

main();
