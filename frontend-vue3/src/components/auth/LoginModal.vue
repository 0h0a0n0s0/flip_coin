<template>
  <el-dialog
    v-model="dialogVisible"
    title="登入"
    width="420px"
    :close-on-click-modal="true"
    @close="handleClose"
  >
    <el-form :model="form" label-width="80px">
      <el-form-item label="帐号">
        <el-input
          v-model="form.username"
          placeholder="请输入帐号"
          autocomplete="username"
        />
      </el-form-item>
      <el-form-item label="密码">
        <el-input
          v-model="form.password"
          type="password"
          placeholder="请输入密码"
          autocomplete="current-password"
          @keyup.enter="handleLogin"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleLogin" :loading="loading">
        登入
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useAuth } from '@/composables/useAuth.js'
import { useSocket } from '@/composables/useSocket.js'
import { getToken } from '@/store/index.js'

const props = defineProps({
  modelValue: Boolean
})

const emit = defineEmits(['update:modelValue', 'success'])

const dialogVisible = ref(props.modelValue)
const form = ref({
  username: '',
  password: ''
})
const { handleLogin: login, loading } = useAuth()
const { initializeSocket } = useSocket()

watch(() => props.modelValue, (val) => {
  dialogVisible.value = val
})

watch(dialogVisible, (val) => {
  emit('update:modelValue', val)
})

async function handleLogin() {
  const success = await login(form.value.username, form.value.password)
  if (success) {
    const token = getToken()
    if (token) {
      initializeSocket(token)
    }
    emit('success')
    handleClose()
  }
}

function handleClose() {
  dialogVisible.value = false
  form.value = {
    username: '',
    password: ''
  }
}
</script>

<style scoped>
:deep(.el-dialog) {
  background-color: rgb(var(--surface-light));
  border: 1px solid rgb(var(--border));
}

:deep(.el-dialog__title) {
  color: rgb(var(--foreground));
}

:deep(.el-dialog__body) {
  color: rgb(var(--foreground));
}

:deep(.el-input__inner) {
  background-color: rgb(var(--surface));
  border-color: rgb(var(--border));
  color: rgb(var(--foreground));
  border-radius: var(--radius-sm);
}

:deep(.el-input__inner::placeholder) {
  color: rgb(var(--text-muted));
}

:deep(.el-form-item__label) {
  color: rgb(var(--foreground));
}
</style>

