// backend/db.js

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // 从环境变数读取资料库連接字串
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool: pool // (★★★ M-Fix 4: 导出 pool ★★★)
};