// backend/db.js

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // 從環境變數讀取資料庫連接字串
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool: pool // (★★★ M-Fix 4: 導出 pool ★★★)
};