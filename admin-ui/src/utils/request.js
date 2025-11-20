// 档案: admin-ui/src/utils/request.js (新档案)

import axios from 'axios';
import { ElMessage } from 'element-plus';

// 建立 Axios 實例
const service = axios.create({
    baseURL: '/', 
    timeout: 10000, 
});

// 请求拦截器 (Request Interceptor)
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

// 回应拦截器 (Response Interceptor)
service.interceptors.response.use(
    (response) => {
        return response.data;
    },
    (error) => {
        console.error('Response error:', error.response);
        
        let message = '请求失败';
        if (error.response) {
            if (error.response.data && error.response.data.error) {
                message = error.response.data.error;
            } else {
                message = `错误 ${error.response.status}: ${error.response.statusText}`;
            }

            // (★★★ 关键修复：区分 401 来源 ★★★)
            if (error.response.status === 401) {
                const originalRequestUrl = error.config.url;

                // 1. 如果是「登入 API」本身返回 401，代表帐号密码错误
                if (originalRequestUrl.includes('/api/admin/login')) {
                    // (不需要做任何事，让错误继续往下传遞到 Login.vue 的 catch 块)
                    // (ElMessage.error 会在下面统一处理)
                } else {
                    // 2. 如果是其他 API (例如 /stats) 返回 401，代表 Token 过期
                    ElMessage.error('Token 已过期或無效，请重新登入。');
                    localStorage.removeItem('admin_token');
                    
                    // (如果是 /admin/ 以外的路径，才跳转)
                    if (!window.location.pathname.startsWith('/admin/login')) {
                         window.location.href = '/admin/login'; 
                    }
                    
                    return new Promise(() => {}); // 中断 API 链
                }
            }
        }
        
        // (统一显示 400 业务错误、500 伺服器错误，或登入失败的 401 错误)
        ElMessage.error(message);
        return Promise.reject(error);
    }
);

export default service;