// 档案: backend/generate-hash.js (新档案)

const bcrypt = require('bcryptjs');
const password = 'admin'; // (我们想要的密码)

async function generate() {
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        
        console.log('--- 请将此杂湊值复制到 init.sql ---');
        console.log(hash);
        console.log('-----------------------------------');
    } catch (e) {
        console.error('Error generating hash:', e);
    }
}

generate();