// 檔案: admin-ui/vue.config.js (★★★ 關鍵步驟 1：必須存在 ★★★)
const { defineConfig } = require('@vue/cli-service');

module.exports = defineConfig({
  transpileDependencies: true,
  
  // (★★★ 關鍵：告訴 Vue App 它的部署路徑是 /admin/ ★★★)
  // 這會讓所有靜態資源 (JS/CSS) 都從 /admin/ 路徑請求
  publicPath: '/admin/',
});