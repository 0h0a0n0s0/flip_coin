// 檔案: admin-ui/src/main.js (修改)

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

// (★★★ v2 新增 ★★★) 引入 API 模組
import * as api from './api'

const app = createApp(App)

// (★★★ v2 新增 ★★★) 全局掛載 API
// 這樣在 .vue 檔案中就可以透過 this.$api.login() 訪問
app.config.globalProperties.$api = api;

app.use(router)
app.use(ElementPlus)
app.mount('#app')