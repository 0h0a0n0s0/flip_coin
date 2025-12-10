<template>
  <el-dialog
    v-model="dialogVisible"
    :title="t('password.change_title')"
    width="420px"
    @close="handleClose"
  >
    <el-form :model="form" label-width="120px">
      <el-form-item :label="t('password.old_password')">
        <el-input
          v-model="form.oldPassword"
          type="password"
          :placeholder="t('password.old_password_placeholder')"
        />
      </el-form-item>
      <el-form-item :label="t('password.new_password')">
        <el-input
          v-model="form.newPassword"
          type="password"
          :placeholder="t('password.new_password_placeholder')"
        />
      </el-form-item>
      <el-form-item :label="t('password.confirm_new_password')">
        <el-input
          v-model="form.confirmPassword"
          type="password"
          :placeholder="t('password.confirm_new_password_placeholder')"
          @keyup.enter="handleSubmit"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="loading">
        {{ t('password.confirm_change') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWallet } from '@/composables/useWallet.js'

const { t } = useI18n()

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
  min-width: 120px; /* 固定标签宽度，适应中英文 */
  white-space: nowrap;
}

:deep(.el-button) {
  min-width: 80px; /* 固定按钮最小宽度 */
  white-space: nowrap; /* 防止按钮文字换行 */
}
</style>

