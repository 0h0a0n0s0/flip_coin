<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="card-header">
          <span>FlipCoin 管理後台登入</span>
        </div>
      </template>
      
      <el-form :model="loginForm" @submit.native.prevent="handleLogin">
        <el-form-item label="帳號">
          <el-input v-model="loginForm.username" placeholder="請輸入帳號" clearable></el-input>
        </el-form-item>
        <el-form-item label="密碼">
          <el-input v-model="loginForm.password" type="password" placeholder="請輸入密碼" show-password></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleLogin" :loading="loading" style="width: 100%;">
            {{ loading ? '登入中...' : '登 入' }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script>
// (★★★ 修改 ★★★)
// 我們不再需要 ElMessage，因為 request.js 攔截器會自動處理錯誤提示
// import { ElMessage } from 'element-plus' 

export default {
  name: 'LoginView',
  data() {
    return {
      loading: false,
      loginForm: {
        username: 'admin',
        password: 'admin123',
      },
    };
  },
  methods: {
    // (★★★ v2 關鍵修改 ★★★)
    // 替換 handleLogin 為真實 API 呼叫
    async handleLogin() {
      if (this.loading) return;
      this.loading = true;

      try {
        // (★★★ 關鍵 ★★★)
        // 呼叫我們在 main.js 中掛載的全局 API
        // $api.login() 會返回 request.js 處理過的 response.data
        const responseData = await this.$api.login(this.loginForm);

        if (responseData && responseData.token) {
            // (★★★ 關鍵 ★★★)
            // 登入成功
            console.log("登入成功，收到 Token:", responseData.token);
            
            // 1. 將 Token 儲存到 localStorage
            localStorage.setItem('admin_token', responseData.token);
            
            // 2. 跳轉到儀表板頁面 (我們稍後建立)
            this.$router.push('/dashboard'); 

        } else {
            // (理論上不會走到這裡，因為 request.js 會攔截錯誤)
             console.error('登入失敗，但未拋出錯誤。');
        }

      } catch (error) {
        // (錯誤會被 request.js 攔截並自動彈出 ElMessage 提示)
        console.error('Login failed (handled by interceptor):', error);
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f0f2f5;
}
.login-card {
  width: 400px;
}
.card-header {
  text-align: center;
  font-size: 20px;
  font-weight: bold;
}
</style>