<template>
  <el-dialog
    v-model="dialogVisible"
    title="个人资料"
    width="500px"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="form"
      label-width="100px"
      :rules="rules"
    >
      <el-form-item label="昵称" prop="nickname">
        <el-input
          v-model="form.nickname"
          placeholder="请输入昵称"
          clearable
        />
      </el-form-item>
      
      <el-form-item label="帐号">
        <el-input
          v-model="form.username"
          disabled
        />
      </el-form-item>
      
      <el-form-item label="密码" prop="password">
        <el-input
          v-model="form.password"
          type="password"
          placeholder="留空则不修改密码"
          show-password
          clearable
        />
      </el-form-item>
    </el-form>
    
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="loading">
          保存
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script>
import { ElMessage } from 'element-plus';

export default {
  name: 'ProfileDialog',
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
      form: {
        nickname: '',
        username: '',
        password: ''
      },
      rules: {
        nickname: [
          { max: 100, message: '昵称长度不能超过100个字符', trigger: 'blur' }
        ],
        password: [
          { min: 6, message: '密码长度不能少于6个字符', trigger: 'blur' }
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
        this.form.nickname = data.nickname || '';
        this.form.username = data.username || '';
        this.form.password = ''; // 密码不预填充
      } catch (error) {
        console.error('Failed to load profile:', error);
        ElMessage.error('获取个人资料失败');
      }
    },
    async handleSubmit() {
      try {
        await this.$refs.formRef.validate();
        
        this.loading = true;
        
        const updateData = {
          nickname: this.form.nickname || ''
        };
        
        // 只有输入了密码才更新密码
        if (this.form.password && this.form.password.trim() !== '') {
          updateData.password = this.form.password;
        }
        
        await this.$api.updateProfile(updateData);
        
        ElMessage.success('保存成功');
        this.$emit('updated');
        this.handleClose();
      } catch (error) {
        if (error !== false) { // 表单验证失败时error为false
          console.error('Failed to update profile:', error);
          ElMessage.error('保存失败');
        }
      } finally {
        this.loading = false;
      }
    },
    handleClose() {
      this.dialogVisible = false;
      this.form.password = ''; // 清空密码
      if (this.$refs.formRef) {
        this.$refs.formRef.resetFields();
      }
    }
  }
};
</script>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>

