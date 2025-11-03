// 檔案: admin-ui/vue.config.js (★★★ 關鍵步驟 1：必須存在 ★★★)
const { defineConfig } = require('@vue/cli-service');

module.exports = defineConfig({
  transpileDependencies: true,
  
  publicPath: '/admin/',

  // (★★★ 新增這一行：禁用生產環境的 Source Map ★★★)
  // 這將停止生成 .map 檔案，並防止使用 'eval'，以修復 CSP 錯誤
  productionSourceMap: false
});