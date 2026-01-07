// packages/database/index.js

// 修复 pnpm workspace 的模块解析问题
// pnpm 使用符号链接，需要解析到实际路径
const path = require('path');
const fs = require('fs');

function resolvePnpmModule(moduleName) {
    const rootNodeModules = path.resolve(__dirname, '../../node_modules');
    const symlinkPath = path.join(rootNodeModules, moduleName);
    
    // 如果是符号链接，解析实际路径
    try {
        const stats = fs.lstatSync(symlinkPath);
        if (stats.isSymbolicLink()) {
            const realPath = fs.readlinkSync(symlinkPath);
            // pnpm 符号链接是相对路径，需要基于 rootNodeModules 解析
            return path.resolve(rootNodeModules, realPath);
        }
        return symlinkPath;
    } catch (e) {
        // 如果找不到，尝试直接 require
        return moduleName;
    }
}

// 尝试解析 pg 模块
let pg;
try {
    const pgPath = resolvePnpmModule('pg');
    // 调试：输出解析的路径
    // console.log('Resolved pg path:', pgPath);
    pg = require(pgPath);
} catch (e) {
    // 如果失败，尝试直接使用已知的 pnpm 路径
    try {
        const rootNodeModules = path.resolve(__dirname, '../../node_modules');
        const pnpmPgPath = path.join(rootNodeModules, '.pnpm/pg@8.16.3/node_modules/pg');
        pg = require(pnpmPgPath);
    } catch (e2) {
        // 最后尝试直接 require（可能 NODE_PATH 已设置）
        pg = require('pg');
    }
}

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // 从环境变数读取资料库連接字串
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool: pool
};