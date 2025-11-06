// 檔案: backend/generate-hash.js (新檔案)

const bcrypt = require('bcryptjs');
const password = 'admin'; // (我們想要的密碼)

async function generate() {
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        
        console.log('--- 請將此雜湊值複製到 init.sql ---');
        console.log(hash);
        console.log('-----------------------------------');
    } catch (e) {
        console.error('Error generating hash:', e);
    }
}

generate();