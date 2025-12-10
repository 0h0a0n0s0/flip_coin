<template>
  <el-dialog
    v-model="dialogVisible"
    :title="t('auth.login')"
    width="420px"
    :close-on-click-modal="true"
    @close="handleClose"
  >
    <el-form :model="form" label-width="80px">
      <el-form-item :label="t('auth.username')">
        <el-input
          v-model="form.username"
          :placeholder="t('auth.username_placeholder')"
          autocomplete="username"
        />
      </el-form-item>
      <el-form-item :label="t('auth.password')">
        <el-input
          v-model="form.password"
          type="password"
          :placeholder="t('auth.password_placeholder')"
          autocomplete="current-password"
          @keyup.enter="handleLogin"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" @click="handleLogin" :loading="loading">
        {{ t('auth.login') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/composables/useAuth.js'
import { useSocket } from '@/composables/useSocket.js'
import { getToken } from '@/store/index.js'

const { t } = useI18n()

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
  min-width: 80px; /* 固定标签宽度，适应中英文 */
  white-space: nowrap;
}

:deep(.el-button) {
  min-width: 80px; /* 固定按钮最小宽度 */
  white-space: nowrap; /* 防止按钮文字换行 */
}
</style>

