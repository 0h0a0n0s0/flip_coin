// 檔案: admin-ui/src/utils/request.js (新檔案)

import axios from 'axios';
import { ElMessage } from 'element-plus';

// 建立 Axios 實例
const service = axios.create({
    // (★★★ 關鍵 ★★★)
    // 基礎 URL。因為 Nginx 代理，我們所有的 API 請求都指向同一個來源 (Nginx)
    // Nginx 會自動將 /api/ 開頭的請求轉發到後端
    baseURL: '/', 
    timeout: 10000, // 請求超時
});

// 請求攔截器 (Request Interceptor)
service.interceptors.request.use(
    (config) => {
        // 在發送請求前，檢查 localStorage 中是否有 token
        const token = localStorage.getItem('admin_token');
        if (token) {
            // 如果有 token，則設置 Authorization 標頭
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        console.error('Request error:', error);
        return Promise.reject(error);
    }
);

// 回應攔截器 (Response Interceptor)
service.interceptors.response.use(
    (response) => {
        // 直接返回 response.data
        return response.data;
    },
    (error) => {
        console.error('Response error:', error.response);
        
        let message = '請求失敗';
        if (error.response) {
            if (error.response.data && error.response.data.error) {
                message = error.response.data.error;
            } else {
                message = `錯誤 ${error.response.status}: ${error.response.statusText}`;
            }

            // (★★★ 關鍵修改：只攔截 401，並跳轉到 /admin/login ★★★)
            if (error.response.status === 401) {
                ElMessage.error('Token 已過期或無效，請重新登入。');
                localStorage.removeItem('admin_token');
                
                // (使用 /admin/login 來確保跳轉到正確的後台登入頁)
                window.location.href = '/admin/login'; 
                
                // (返回一個 pending 的 Promise 來中斷當前的 API 鏈)
                return new Promise(() => {});
            }
        }
        
        // (對於 400 業務錯誤 或 500 伺服器錯誤，只彈出提示)
        ElMessage.error(message);
        return Promise.reject(error);
    }
);

export default service;