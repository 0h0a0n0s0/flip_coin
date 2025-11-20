<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="card-header">
          <span>FlipCoin 管理後台登入</span>
        </div>
      </template>
      
      <el-form :model="loginForm" @submit.native.prevent="handleLogin">
        <el-form-item label="帐号">
          <el-input v-model="loginForm.username" placeholder="请输入帐号" clearable></el-input>
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" show-password></el-input>
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
        password: '', // (★★★ 错误修复：移除寫死的密码，改为空字串 ★★★)
      },
    };
  },
  methods: {
    async handleLogin() {
      if (this.loading) return;
      this.loading = true;

      // (★★★ 新增：检查密码是否为空 ★★★)
      if (!this.loginForm.username || !this.loginForm.password) {
          // (我们使用 ElMessage，因为 request.js 拦截器不会拦截*未发出*的请求)
          this.$message.error('帐号和密码不能为空');
          this.loading = false;
          return;
      }

      try {
        const responseData = await this.$api.login(this.loginForm);

        if (responseData && responseData.token) {
            localStorage.setItem('admin_token', responseData.token);
            this.$router.push('/dashboard'); 
        } else {
             console.error('登入失败，但未拋出错误。');
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
/* ... (样式不变) ... */
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