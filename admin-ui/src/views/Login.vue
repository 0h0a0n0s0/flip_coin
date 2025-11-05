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
export default {
  name: 'LoginView',
  data() {
    return {
      loading: false,
      loginForm: {
        username: 'admin',
        password: '', // (★★★ 錯誤修復：移除寫死的密碼，改為空字串 ★★★)
      },
    };
  },
  methods: {
    async handleLogin() {
      if (this.loading) return;
      this.loading = true;

      // (★★★ 新增：檢查密碼是否為空 ★★★)
      if (!this.loginForm.username || !this.loginForm.password) {
          // (我們使用 ElMessage，因為 request.js 攔截器不會攔截*未發出*的請求)
          this.$message.error('帳號和密碼不能為空');
          this.loading = false;
          return;
      }

      try {
        const responseData = await this.$api.login(this.loginForm);

        if (responseData && responseData.token) {
            localStorage.setItem('admin_token', responseData.token);
            this.$router.push('/dashboard'); 
        } else {
             console.error('登入失敗，但未拋出錯誤。');
        }

      } catch (error) {
        console.error('Login failed (handled by interceptor):', error);
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
/* ... (樣式不變) ... */
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