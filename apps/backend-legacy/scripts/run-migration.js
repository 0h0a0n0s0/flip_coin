// 运行数据库迁移脚本
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const migrationFile = process.argv[2];

if (!migrationFile) {
    console.error('Usage: node run-migration.js <migration-file.sql>');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log(`[Migration] Reading migration file: ${migrationFile}`);
        const migrationPath = path.resolve(__dirname, '..', '..', '..', 'packages', 'database', 'migrations', migrationFile);
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('[Migration] Executing migration...');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        
        console.log('[Migration] ✅ Migration completed successfully!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Migration] ❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();

