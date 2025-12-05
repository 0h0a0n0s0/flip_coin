<template>
  <el-dialog
    v-model="dialogVisible"
    title="修改提款密码"
    width="420px"
    @close="handleClose"
  >
    <el-form :model="form" label-width="120px">
      <el-form-item label="旧提款密码">
        <el-input
          v-model="form.oldPassword"
          type="password"
          placeholder="请输入旧提款密码"
        />
      </el-form-item>
      <el-form-item label="新提款密码">
        <el-input
          v-model="form.newPassword"
          type="password"
          placeholder="请输入新提款密码 (至少 6 位)"
        />
      </el-form-item>
      <el-form-item label="确认新密码">
        <el-input
          v-model="form.confirmPassword"
          type="password"
          placeholder="请再次输入新提款密码"
          @keyup.enter="handleSubmit"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="loading">
        确认修改
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useWallet } from '@/composables/useWallet.js'

const props = defineProps({
  modelValue: Boolean
})

const emit = defineEmits(['update:modelValue', 'success'])

const dialogVisible = ref(props.modelValue)
const form = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})
const { handleSubmitChangePwd, loading } = useWallet()

watch(() => props.modelValue, (val) => {
  dialogVisible.value = val
})

watch(dialogVisible, (val) => {
  emit('update:modelValue', val)
})

async function handleSubmit() {
  const success = await handleSubmitChangePwd(
    form.value.oldPassword,
    form.value.newPassword,
    form.value.confirmPassword
  )
  if (success) {
    emit('success')
    handleClose()
  }
}

function handleClose() {
  dialogVisible.value = false
  form.value = {
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
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

