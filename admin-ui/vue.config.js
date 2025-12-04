// 档案: admin-ui/vue.config.js (★★★ 关键步骤 1：必须存在 ★★★)
const { defineConfig } = require('@vue/cli-service');

module.exports = defineConfig({
  transpileDependencies: true,
  
  publicPath: '/admin/',

  // (★★★ 新增這一行：禁用生产环境的 Source Map ★★★)
  // 這将停止生成 .map 档案，并防止使用 'eval'，以修复 CSP 错误
  productionSourceMap: false,

  // 开发环境代理配置
  devServer: {
    proxy: {
      '/api': {
        target: process.env.VUE_APP_API_URL || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        logLevel: 'debug'
      }
    }
  }
});