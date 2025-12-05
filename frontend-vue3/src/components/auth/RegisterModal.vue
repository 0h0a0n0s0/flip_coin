<template>
  <el-dialog
    v-model="dialogVisible"
    title="注册"
    width="420px"
    :close-on-click-modal="true"
    @close="handleClose"
  >
    <el-form :model="form" label-width="100px">
      <el-form-item label="帐号">
        <el-input
          v-model="form.username"
          placeholder="请输入帐号 (3-20 字元)"
          autocomplete="username"
        />
      </el-form-item>
      <el-form-item label="密码">
        <el-input
          v-model="form.password"
          type="password"
          placeholder="请输入密码 (至少 6 位)"
          autocomplete="new-password"
        />
      </el-form-item>
      <el-form-item label="确认密码">
        <el-input
          v-model="form.confirmPassword"
          type="password"
          placeholder="请再次输入密码"
          autocomplete="new-password"
          @keyup.enter="handleRegister"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleRegister" :loading="loading">
        注册
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
  password: '',
  confirmPassword: ''
})
const { handleRegister: register, loading } = useAuth()
const { initializeSocket } = useSocket()

watch(() => props.modelValue, (val) => {
  dialogVisible.value = val
})

watch(dialogVisible, (val) => {
  emit('update:modelValue', val)
})

async function handleRegister() {
  const success = await register(
    form.value.username,
    form.value.password,
    form.value.confirmPassword
  )
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
    password: '',
    confirmPassword: ''
  }
}
</script>

<style scoped>
:deep(.el-dialog) {
  background-color: var(--card);
  border: 1px solid var(--border);
}

:deep(.el-dialog__title) {
  color: var(--foreground);
}

:deep(.el-input__inner) {
  background-color: var(--surface-light);
  border-color: var(--border);
  color: var(--foreground);
}
</style>

