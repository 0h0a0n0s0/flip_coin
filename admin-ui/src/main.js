// 檔案: admin-ui/src/main.js (★★★ v7.4 修正版 ★★★)

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as api from './api'
import permissionsStore from './store' // (★★★ 導入 Store ★★★)

const app = createApp(App)

// (全局掛載 API 和權限存儲)
app.config.globalProperties.$api = api;
app.config.globalProperties.$permissions = permissionsStore;

app.use(router)
app.use(ElementPlus)
app.mount('#app')