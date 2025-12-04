<template>
  <el-dialog
    v-model="dialogVisible"
    :title="hasGoogleAuth ? '解绑谷歌验证' : '绑定谷歌验证'"
    width="500px"
    @close="handleClose"
  >
    <div v-if="!hasGoogleAuth">
      <!-- 未绑定：显示二维码和验证码输入 -->
      <div v-if="setupData" class="setup-content">
        <div class="qr-code-container">
          <p class="hint-text">请使用谷歌验证器扫描下方二维码：</p>
          <div class="qr-code-wrapper">
            <img :src="setupData.qrCode" alt="Google Authenticator QR Code" />
          </div>
          <p class="hint-text">扫描后，请输入6位验证码以完成绑定：</p>
        </div>
        
        <el-form
          ref="bindFormRef"
          :model="bindForm"
          :rules="bindRules"
          label-width="120px"
        >
          <el-form-item label="验证码" prop="code">
            <el-input
              v-model="bindForm.code"
              placeholder="请输入6位验证码"
              maxlength="6"
              style="width: 200px;"
            />
          </el-form-item>
        </el-form>
      </div>
      
      <div v-else class="loading-container">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span style="margin-left: 8px;">正在生成二维码...</span>
      </div>
    </div>
    
    <div v-else>
      <!-- 已绑定：显示解绑按钮和验证码输入 -->
      <div class="unbind-content">
        <el-alert
          type="warning"
          :closable="false"
          style="margin-bottom: 20px;"
        >
          <template #title>
            <span>解绑后需要重新绑定才能使用谷歌验证功能</span>
          </template>
        </el-alert>
        
        <el-form
          ref="unbindFormRef"
          :model="unbindForm"
          :rules="unbindRules"
          label-width="120px"
        >
          <el-form-item label="验证码" prop="code">
            <el-input
              v-model="unbindForm.code"
              placeholder="请输入6位验证码"
              maxlength="6"
              style="width: 200px;"
            />
          </el-form-item>
        </el-form>
      </div>
    </div>
    
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button
          v-if="!hasGoogleAuth && setupData"
          type="primary"
          @click="handleBind"
          :loading="loading"
        >
          绑定
        </el-button>
        <el-button
          v-else-if="hasGoogleAuth"
          type="danger"
          @click="handleUnbind"
          :loading="loading"
        >
          解绑
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script>
import { ElMessage } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';

export default {
  name: 'GoogleAuthDialog',
  components: {
    Loading
  },
  props: {
    modelValue: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue', 'updated'],
  data() {
    return {
      loading: false,
      hasGoogleAuth: false,
      setupData: null,
      bindForm: {
        code: ''
      },
      unbindForm: {
        code: ''
      },
      bindRules: {
        code: [
          { required: true, message: '请输入验证码', trigger: 'blur' },
          { pattern: /^\d{6}$/, message: '验证码必须是6位数字', trigger: 'blur' }
        ]
      },
      unbindRules: {
        code: [
          { required: true, message: '请输入验证码', trigger: 'blur' },
          { pattern: /^\d{6}$/, message: '验证码必须是6位数字', trigger: 'blur' }
        ]
      }
    };
  },
  computed: {
    dialogVisible: {
      get() {
        return this.modelValue;
      },
      set(val) {
        this.$emit('update:modelValue', val);
      }
    }
  },
  watch: {
    modelValue(newVal) {
      if (newVal) {
        this.loadProfile();
      }
    }
  },
  methods: {
    async loadProfile() {
      try {
        const data = await this.$api.getProfile();
        this.hasGoogleAuth = data.hasGoogleAuth || false;
        
        // 如果未绑定，获取二维码
        if (!this.hasGoogleAuth) {
          await this.loadSetup();
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
        ElMessage.error('获取信息失败');
      }
    },
    async loadSetup() {
      try {
        this.setupData = null;
        const data = await this.$api.getGoogleAuthSetup();
        this.setupData = data;
      } catch (error) {
        console.error('Failed to load setup:', error);
        if (error.response && error.response.data && error.response.data.error) {
          ElMessage.error(error.response.data.error);
        } else {
          ElMessage.error('获取二维码失败');
        }
      }
    },
    async handleBind() {
      try {
        await this.$refs.bindFormRef.validate();
        
        if (!this.setupData || !this.setupData.secret) {
          ElMessage.error('请先获取二维码');
          return;
        }
        
        this.loading = true;
        
        await this.$api.bindGoogleAuth({
          secret: this.setupData.secret,
          code: this.bindForm.code
        });
        
        ElMessage.success('绑定成功');
        this.handleClose();
        // 重新加载以更新状态
        await this.loadProfile();
        // 通知父组件更新状态
        this.$emit('updated');
      } catch (error) {
        console.error('Failed to bind:', error);
        if (error.response && error.response.data && error.response.data.error) {
          ElMessage.error(error.response.data.error);
        } else {
          ElMessage.error('绑定失败');
        }
      } finally {
        this.loading = false;
      }
    },
    async handleUnbind() {
      try {
        await this.$refs.unbindFormRef.validate();
        
        this.loading = true;
        
        await this.$api.unbindGoogleAuth({
          code: this.unbindForm.code
        });
        
        ElMessage.success('解绑成功');
        this.handleClose();
        // 重新加载以更新状态
        await this.loadProfile();
        // 通知父组件更新状态
        this.$emit('updated');
      } catch (error) {
        console.error('Failed to unbind:', error);
        if (error.response && error.response.data && error.response.data.error) {
          ElMessage.error(error.response.data.error);
        } else {
          ElMessage.error('解绑失败');
        }
      } finally {
        this.loading = false;
      }
    },
    handleClose() {
      this.dialogVisible = false;
      this.bindForm.code = '';
      this.unbindForm.code = '';
      this.setupData = null;
      if (this.$refs.bindFormRef) {
        this.$refs.bindFormRef.resetFields();
      }
      if (this.$refs.unbindFormRef) {
        this.$refs.unbindFormRef.resetFields();
      }
    }
  }
};
</script>

<style scoped>
.setup-content {
  text-align: center;
}

.qr-code-container {
  margin-bottom: 20px;
}

.hint-text {
  color: var(--el-text-color-regular);
  margin: 12px 0;
  font-size: 14px;
}

.qr-code-wrapper {
  display: flex;
  justify-content: center;
  margin: 20px 0;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 8px;
}

.qr-code-wrapper img {
  width: 200px;
  height: 200px;
}

.unbind-content {
  padding: 10px 0;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px 0;
  color: var(--el-text-color-regular);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>

