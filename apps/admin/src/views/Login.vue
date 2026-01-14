<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="card-header">
          <span>FlipCoin 管理後台登入</span>
        </div>
      </template>
      
      <el-form :model="loginForm" @submit.native.prevent="handleLogin">
        <el-form-item>
          <el-input 
            v-model="loginForm.username" 
            placeholder="账号" 
            clearable
            class="login-input"
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-input 
            v-model="loginForm.password" 
            type="password" 
            placeholder="密码" 
            show-password
            class="login-input"
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-input 
            v-model="loginForm.googleAuthCode" 
            placeholder="谷歌验证码 (未绑定可留空)" 
            maxlength="6"
            clearable
            class="login-input"
          >
            <template #prefix>
              <el-icon><Key /></el-icon>
            </template>
          </el-input>
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
import { getClientIp } from '@/utils/request';
import { User, Lock, Key } from '@element-plus/icons-vue';

export default {
  name: 'LoginView',
  components: {
    User,
    Lock,
    Key
  },
  data() {
    return {
      loading: false,
      loginForm: {
        username: 'admin',
        password: '', // (★★★ 错误修复：移除寫死的密码，改为空字串 ★★★)
        googleAuthCode: ''
      },
      ipReady: false, // 追踪IP是否已准备好
      requiresGoogleAuth: false // 是否需要谷歌验证码
    };
  },
  mounted() {
    // (★★★ 新增：页面加载时主动获取IP，确保登录前IP已准备好 ★★★)
    console.log('[Login] 页面加载，开始获取客户端IP...');
    getClientIp()
      .then(ip => {
        if (ip) {
          this.ipReady = true;
          console.log('[Login] ✅ IP已获取并准备好:', ip);
        } else {
          console.warn('[Login] ⚠️ IP获取失败，但登录仍可继续（将使用网络层IP）');
          this.ipReady = true; // 即使失败也标记为ready，避免阻塞登录
        }
      })
      .catch(err => {
        console.warn('[Login] IP获取出错:', err);
        this.ipReady = true; // 即使出错也标记为ready，避免阻塞登录
      });
  },
  watch: {
    // 当用户名变化时，重置谷歌验证状态
    'loginForm.username'() {
      this.requiresGoogleAuth = false;
      this.loginForm.googleAuthCode = '';
    }
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

      // (★★★ 新增：检查谷歌验证码 ★★★)
      // 注意：只有在 requiresGoogleAuth 为 true 时才验证（即账号已绑定谷歌验证）
      if (this.requiresGoogleAuth) {
        if (!this.loginForm.googleAuthCode) {
          this.$message.error('请输入谷歌验证码');
          this.loading = false;
          return;
        }
        
        if (!/^\d{6}$/.test(this.loginForm.googleAuthCode)) {
          this.$message.error('验证码必须是6位数字');
          this.loading = false;
          return;
        }
      }

      // (★★★ 新增：确保IP已获取后再发送登录请求 ★★★)
      // 如果IP还没准备好，等待最多3秒
      if (!this.ipReady) {
        console.log('[Login] 等待IP获取完成...');
        let waitCount = 0;
        const maxWait = 30; // 最多等待3秒（30 * 100ms）
        
        while (!this.ipReady && waitCount < maxWait) {
          await new Promise(resolve => setTimeout(resolve, 100));
          waitCount++;
        }
        
        if (!this.ipReady) {
          console.warn('[Login] ⚠️ IP获取超时，继续登录（将使用网络层IP）');
        } else {
          console.log('[Login] ✅ IP已准备好，继续登录');
        }
      }

      // 再次尝试获取IP（确保使用最新的IP）
      try {
        const currentIp = await getClientIp();
        if (currentIp) {
          console.log('[Login] ✅ 登录前确认IP:', currentIp);
        }
      } catch (err) {
        console.warn('[Login] 登录前IP获取失败:', err);
      }

      try {
        const responseData = await this.$api.login(this.loginForm);

        // (★★★ 修復：後端使用標準響應格式 { success: true, data: { token: ... } } ★★★)
        if (responseData && responseData.success && responseData.data && responseData.data.token) {
            localStorage.setItem('admin_token', responseData.data.token);
            this.$router.push('/dashboard'); 
        } else {
             console.error('登入失败，但未拋出错误。響應數據:', responseData);
             this.$message.error('登入失败：無法獲取 token');
        }

      } catch (error) {
        console.error('Login failed (handled by interceptor):', error);
        // 如果错误提示需要谷歌验证码，显示验证码输入框
        if (error.response && error.response.data && error.response.data.requiresGoogleAuth) {
          const wasAlreadyShown = this.requiresGoogleAuth;
          this.requiresGoogleAuth = true;
          // 如果验证码输入框之前没有显示，清空验证码让用户输入
          if (!wasAlreadyShown) {
            this.loginForm.googleAuthCode = '';
          }
        }
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
  background: linear-gradient(135deg, #135200 0%, #237804 100%);
  padding: var(--spacing-lg);
}

.login-card {
  width: 420px;
  border-radius: var(--radius-lg) !important;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2) !important;
}

.card-header {
  text-align: center;
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  padding: var(--spacing-base) 0;
}

.login-input {
  width: 100%;
}

:deep(.el-button--primary) {
  height: 44px;
  font-size: 16px;
  font-weight: 500;
}

@media (max-width: 480px) {
  .login-card {
    width: 100%;
    max-width: 400px;
  }
}
</style>