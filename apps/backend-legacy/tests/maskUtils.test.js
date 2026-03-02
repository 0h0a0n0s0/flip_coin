// maskUtils.test.js
// 測試遮罩工具函數

const {
    maskValue,
    maskAddress,
    maskTxHash,
    maskUserId,
    maskEmail,
    maskIP,
    maskDeviceId,
    maskPhone,
    maskSensitive
} = require('../utils/maskUtils');

console.log('=== maskUtils 測試 ===\n');

// 測試 maskAddress
console.log('1. maskAddress():');
console.log('  輸入: TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf');
console.log('  輸出:', maskAddress('TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf'));
console.log('  預期: TXYZop***AeBf\n');

// 測試 maskTxHash
console.log('2. maskTxHash():');
console.log('  輸入: 0xabc123def456ghi789jkl012mno345pqr678stu901');
console.log('  輸出:', maskTxHash('0xabc123def456ghi789jkl012mno345pqr678stu901'));
console.log('  預期: 0xabc1***tu901\n');

// 測試 maskUserId
console.log('3. maskUserId():');
console.log('  輸入: U1234567');
console.log('  輸出:', maskUserId('U1234567'));
console.log('  預期: U12***67\n');

// 測試 maskEmail
console.log('4. maskEmail():');
console.log('  輸入: admin@example.com');
console.log('  輸出:', maskEmail('admin@example.com'));
console.log('  預期: a***@example.com');
console.log('  輸入: a@test.com');
console.log('  輸出:', maskEmail('a@test.com'));
console.log('  預期: a***@test.com\n');

// 測試 maskIP
console.log('5. maskIP():');
console.log('  輸入: 192.168.1.100');
console.log('  輸出:', maskIP('192.168.1.100'));
console.log('  預期: 192.168.***.***');
console.log('  輸入: 2001:0db8:85a3:0000:0000:8a2e:0370:7334');
console.log('  輸出:', maskIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334'));
console.log('  預期: 2001:0db8:***:***\n');

// 測試 maskDeviceId
console.log('6. maskDeviceId():');
console.log('  輸入: abc123def456ghi789');
console.log('  輸出:', maskDeviceId('abc123def456ghi789'));
console.log('  預期: abc123de***\n');

// 測試 maskPhone
console.log('7. maskPhone():');
console.log('  輸入: +886912345678');
console.log('  輸出:', maskPhone('+886912345678'));
console.log('  預期: +88***5678\n');

// 測試 maskSensitive
console.log('8. maskSensitive():');
console.log('  輸入: mySecretPassword123');
console.log('  輸出:', maskSensitive('mySecretPassword123'));
console.log('  預期: [REDACTED]\n');

// 邊界情況測試
console.log('9. 邊界情況測試:');
console.log('  空字串:', maskEmail(''));
console.log('  null:', maskEmail(null));
console.log('  undefined:', maskEmail(undefined));
console.log('  短 IP:', maskIP('1.1'));
console.log('  異常 Email:', maskEmail('notanemail'));

console.log('\n=== 測試完成 ===');
