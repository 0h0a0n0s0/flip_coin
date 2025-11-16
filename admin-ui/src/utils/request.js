// 檔案: admin-ui/src/utils/request.js (新檔案)

import axios from 'axios';
import { ElMessage } from 'element-plus';

// 建立 Axios 實例
const service = axios.create({
    baseURL: '/', 
    timeout: 10000, 
});

// 請求攔截器 (Request Interceptor)
service.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('admin_token');
        if (token) {
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

            // (★★★ 關鍵修復：區分 401 來源 ★★★)
            if (error.response.status === 401) {
                const originalRequestUrl = error.config.url;

                // 1. 如果是「登入 API」本身返回 401，代表帳號密碼錯誤
                if (originalRequestUrl.includes('/api/admin/login')) {
                    // (不需要做任何事，讓錯誤繼續往下傳遞到 Login.vue 的 catch 塊)
                    // (ElMessage.error 會在下面統一處理)
                } else {
                    // 2. 如果是其他 API (例如 /stats) 返回 401，代表 Token 過期
                    ElMessage.error('Token 已過期或無效，請重新登入。');
                    localStorage.removeItem('admin_token');
                    
                    // (如果是 /admin/ 以外的路徑，才跳轉)
                    if (!window.location.pathname.startsWith('/admin/login')) {
                         window.location.href = '/admin/login'; 
                    }
                    
                    return new Promise(() => {}); // 中斷 API 鏈
                }
            }
        }
        
        // (統一顯示 400 業務錯誤、500 伺服器錯誤，或登入失敗的 401 錯誤)
        ElMessage.error(message);
        return Promise.reject(error);
    }
);

export default service;