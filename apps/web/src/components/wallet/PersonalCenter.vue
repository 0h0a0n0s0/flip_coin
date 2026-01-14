<template>
  <el-dialog
    v-model="dialogVisible"
    :title="t('personal_center.title')"
    width="480px"
    :close-on-click-modal="true"
    @close="handleClose"
    class="personal-center-modal"
  >
    <el-tabs v-model="activeTab">
      <!-- Info Tab -->
      <el-tab-pane :label="t('personal_center.info')" name="info">
        <div class="info-content">
          <ul class="info-list">
            <li><span>{{ t('personal_center.user_id') }}:</span> <strong>{{ currentUser?.id }}</strong></li>
            <li><span>{{ t('personal_center.username') }}:</span> <strong>{{ currentUser?.username }}</strong></li>
            <li><span>{{ t('personal_center.user_level') }}:</span> <strong>{{ currentUser?.level || 'N/A' }}</strong></li>
            <li><span>{{ t('personal_center.max_streak') }}:</span> <strong>{{ currentUser?.max_streak || 0 }}</strong></li>
            <li><span>{{ t('personal_center.invite_code') }}:</span> <strong>{{ currentUser?.invite_code }}</strong></li>
            <li><span>{{ t('personal_center.referrer_code') }}:</span> <strong>{{ currentUser?.referrer_code || 'N/A' }}</strong></li>
          </ul>

          <div class="form-section">
            <h4>{{ t('personal_center.change_nickname') }}</h4>
            <div class="form-group">
              <el-input
                v-model="nickname"
                :placeholder="t('personal_center.nickname_placeholder')"
                class="nickname-input"
              />
              <el-button @click="handleSaveNickname" :loading="loading">
                {{ t('personal_center.save') }}
              </el-button>
            </div>
          </div>

          <div v-if="!currentUser?.referrer_code" class="form-section">
            <h4>{{ t('personal_center.bind_referrer') }}</h4>
            <div class="form-group">
              <el-input
                v-model="referrerCode"
                :placeholder="t('personal_center.referrer_placeholder')"
              />
              <el-button @click="handleBindReferrer" :loading="loading">
                {{ t('personal_center.bind') }}
              </el-button>
            </div>
          </div>

          <div class="form-section">
            <h4>{{ t('personal_center.security_settings') }}</h4>
            <div class="password-status">
              <span>{{ t('personal_center.withdrawal_password') }}: </span>
              <strong>{{ currentUser?.has_withdrawal_password ? t('personal_center.already_set') : t('personal_center.not_set') }}</strong>
              <el-button
                v-if="!currentUser?.has_withdrawal_password"
                @click="showSetPwdModal = true"
                size="small"
              >
                {{ t('personal_center.set') }}
              </el-button>
              <el-button
                v-else
                @click="showChangePwdModal = true"
                size="small"
              >
                {{ t('personal_center.change') }}
              </el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- Deposit Tab -->
      <el-tab-pane :label="t('personal_center.deposit')" name="deposit">
        <div class="deposit-content">
          <h4>{{ t('personal_center.tron_deposit_address') }}</h4>
          <el-alert type="warning" :closable="false" class="deposit-warning">
            <strong>{{ t('common.error') }}：</strong> {{ t('personal_center.deposit_warning') }}
          </el-alert>
          <div class="address-group">
            <el-input
              v-model="tronAddress"
              readonly
              class="address-input"
            />
            <el-button @click="handleCopyTron">{{ t('wallet.copy') }}</el-button>
          </div>

          <h4 style="margin-top: var(--space-5);">{{ t('personal_center.evm_deposit_address') }}</h4>
          <el-alert type="warning" :closable="false" class="deposit-warning">
            <strong>{{ t('common.error') }}：</strong> {{ t('personal_center.evm_deposit_warning') }}
          </el-alert>
          <div class="address-group">
            <el-input
              v-model="evmAddress"
              readonly
              class="address-input"
            />
            <el-button @click="handleCopyEvm">{{ t('wallet.copy') }}</el-button>
          </div>

          <div class="deposit-tip" v-html="t('personal_center.deposit_tip')"></div>

          <h4 style="margin-top: var(--space-6);">{{ t('personal_center.deposit_history') }}</h4>
          <ul v-if="depositHistory.length > 0" class="history-list">
            <li v-for="(item, index) in depositHistory" :key="index">
              <span class="amount">{{ item.amount }} USDT ({{ item.chain }})</span>
              <span>{{ t('personal_center.time') }}: {{ formatTime(item.created_at) }}</span>
              <span class="status-completed">{{ t('personal_center.status') }}: {{ t('personal_center.status_arrived') }}</span>
            </li>
          </ul>
          <div v-else class="empty">{{ t('personal_center.no_deposit_history') }}</div>
        </div>
      </el-tab-pane>

      <!-- Withdraw Tab -->
      <el-tab-pane :label="t('personal_center.withdraw')" name="withdraw">
        <div class="withdraw-content">
          <h4>{{ t('personal_center.submit_withdraw') }}</h4>
          <el-select v-model="withdrawChain" class="chain-select">
            <el-option :label="t('wallet.chain_tron')" value="TRC20" />
            <el-option :label="t('wallet.chain_bsc')" value="BSC" />
            <el-option :label="t('wallet.chain_eth')" value="ETH" />
            <el-option :label="t('wallet.chain_sol')" value="SOL" />
            <el-option :label="t('wallet.chain_polygon')" value="POLYGON" />
          </el-select>

          <el-input
            v-model="withdrawAddress"
            :placeholder="t('wallet.enter_withdraw_address')"
            class="withdraw-input"
          />

          <el-input
            v-model.number="withdrawAmount"
            type="number"
            :placeholder="t('wallet.min_withdraw')"
            class="withdraw-input"
          />

          <el-input
            v-model="withdrawPassword"
            type="password"
            :placeholder="t('wallet.withdraw_password_placeholder')"
            class="withdraw-input"
          />

          <el-button
            type="primary"
            @click="handleSubmitWithdrawal"
            :loading="loading"
            class="withdraw-button"
          >
            {{ t('personal_center.confirm_withdraw') }}
          </el-button>

          <h4 style="margin-top: var(--space-6);">{{ t('personal_center.withdraw_history') }}</h4>
          <ul v-if="withdrawalHistory.length > 0" class="history-list">
            <li v-for="(item, index) in withdrawalHistory" :key="index">
              <span class="amount">{{ item.amount }} USDT ({{ item.chain_type }})</span>
              <span>{{ t('personal_center.address') }}: {{ item.address_masked || item.address }}</span>
              <span>{{ t('personal_center.time') }}: {{ formatTime(item.request_time) }}</span>
              <span :class="['status', `status-${item.status}`]">
                {{ t('personal_center.status') }}: {{ getWithdrawStatusText(item.status) }}
              </span>
            </li>
          </ul>
          <div v-else class="empty">{{ t('personal_center.no_withdraw_history') }}</div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <el-button @click="handleClose">{{ t('common.close') }}</el-button>
    </template>

    <!-- Password Modals -->
    <SetPasswordModal
      v-model="showSetPwdModal"
      @success="handleSetPwdSuccess"
    />
    <ChangePasswordModal
      v-model="showChangePwdModal"
      @success="handleChangePwdSuccess"
    />
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWallet } from '@/composables/useWallet.js'
import { getCurrentUser } from '@/store/index.js'
import SetPasswordModal from './SetPasswordModal.vue'
import ChangePasswordModal from './ChangePasswordModal.vue'

const { t } = useI18n()

const props = defineProps({
  modelValue: Boolean
})

const emit = defineEmits(['update:modelValue'])

const dialogVisible = ref(props.modelValue)
const activeTab = ref('info')
const nickname = ref('')
const referrerCode = ref('')
const tronAddress = ref('')
const evmAddress = ref('')
const withdrawChain = ref('TRC20')
const withdrawAddress = ref('')
const withdrawAmount = ref('')
const withdrawPassword = ref('')
const showSetPwdModal = ref(false)
const showChangePwdModal = ref(false)

const currentUser = computed(() => getCurrentUser())
const {
  depositHistory,
  withdrawalHistory,
  fetchDepositHistory,
  fetchWithdrawalHistory,
  handleSaveNickname: saveNickname,
  handleBindReferrer: bindReferrer,
  handleSubmitWithdrawal: submitWithdrawal,
  copyAddress,
  loading
} = useWallet()

watch(() => props.modelValue, (val) => {
  dialogVisible.value = val
  if (val && currentUser.value) {
    nickname.value = currentUser.value.nickname || ''
    // (★★★ 修復：使用正確的字段名 tron_deposit_address 和 evm_deposit_address ★★★)
    tronAddress.value = currentUser.value.tron_deposit_address || ''
    evmAddress.value = currentUser.value.evm_deposit_address || ''
    if (activeTab.value === 'deposit') {
      fetchDepositHistory()
    } else if (activeTab.value === 'withdraw') {
      fetchWithdrawalHistory()
    }
  }
})

watch(activeTab, (val) => {
  if (val === 'deposit') {
    fetchDepositHistory()
  } else if (val === 'withdraw') {
    fetchWithdrawalHistory()
  }
})

watch(dialogVisible, (val) => {
  emit('update:modelValue', val)
})

function formatTime(timeString) {
  return new Date(timeString).toLocaleString('zh-CN')
}

function getWithdrawStatusText(status) {
  const statusMap = {
    pending: t('personal_center.status_pending'),
    processing: t('personal_center.status_processing'),
    completed: t('personal_center.status_completed'),
    rejected: t('personal_center.status_rejected')
  }
  return statusMap[status] || status
}

async function handleSaveNickname() {
  const success = await saveNickname(nickname.value)
  if (success) {
    nickname.value = ''
  }
}

async function handleBindReferrer() {
  const success = await bindReferrer(referrerCode.value)
  if (success) {
    referrerCode.value = ''
  }
}

async function handleCopyTron() {
  if (tronAddress.value) {
    await copyAddress(tronAddress.value)
  }
}

async function handleCopyEvm() {
  if (evmAddress.value) {
    await copyAddress(evmAddress.value)
  }
}

async function handleSubmitWithdrawal() {
  const success = await submitWithdrawal(
    withdrawChain.value,
    withdrawAddress.value,
    withdrawAmount.value,
    withdrawPassword.value
  )
  if (success) {
    withdrawAddress.value = ''
    withdrawAmount.value = ''
    withdrawPassword.value = ''
    fetchWithdrawalHistory()
  }
}

function handleSetPwdSuccess() {
  showSetPwdModal.value = false
}

function handleChangePwdSuccess() {
  showChangePwdModal.value = false
}

function handleClose() {
  dialogVisible.value = false
}
</script>

<style scoped>
.personal-center-modal :deep(.el-dialog) {
  background-color: rgb(var(--surface-light));
  border: 1px solid rgb(var(--border));
}

.personal-center-modal :deep(.el-dialog__title) {
  color: rgb(var(--foreground));
}

.personal-center-modal :deep(.el-dialog__body) {
  color: rgb(var(--foreground));
}

.personal-center-modal :deep(.el-input__inner) {
  background-color: rgb(var(--surface));
  border-color: rgb(var(--border));
  color: rgb(var(--foreground));
  border-radius: var(--radius-sm);
}

.personal-center-modal :deep(.el-input__inner::placeholder) {
  color: rgb(var(--text-muted));
}

.personal-center-modal :deep(.el-form-item__label) {
  color: rgb(var(--foreground));
  min-width: 120px; /* 固定标签宽度，适应中英文 */
  white-space: nowrap;
}

.personal-center-modal :deep(.el-button) {
  min-width: 80px; /* 固定按钮最小宽度 */
  white-space: nowrap; /* 防止按钮文字换行 */
}

.personal-center-modal :deep(.el-tab-pane) {
  color: rgb(var(--foreground));
}

.personal-center-modal :deep(.el-input) {
  width: 100%; /* 输入框保持全宽 */
}

.personal-center-modal :deep(.el-select) {
  width: 100%; /* 下拉框保持全宽 */
}

.info-content,
.deposit-content,
.withdraw-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.info-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.info-list li {
  display: flex;
  gap: var(--space-2);
  font-size: 14px;
}

.info-list li span {
  color: var(--text-muted);
}

.form-section {
  border-top: 1px solid var(--border);
  padding-top: var(--space-4);
  margin-top: var(--space-4);
}

.form-section h4 {
  margin: 0 0 var(--space-2) 0;
  font-size: 14px;
  color: var(--foreground);
}

.form-group {
  display: flex;
  gap: var(--space-2);
}

.nickname-input {
  flex: 1;
}

.password-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 14px;
}

.deposit-warning {
  font-size: 12px;
}

.address-group {
  display: flex;
  gap: var(--space-2);
}

.address-input {
  flex: 1;
}

.deposit-tip {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}

.chain-select,
.withdraw-input {
  width: 100%;
}

.withdraw-button {
  width: 100%;
  height: 40px;
}

.history-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.history-list li {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-2);
  background-color: var(--surface-light);
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.amount {
  font-weight: 500;
  color: var(--foreground);
}

.status-completed {
  color: var(--success);
}

.status-pending {
  color: var(--text-muted);
}

.status-processing {
  color: var(--primary);
}

.status-rejected {
  color: var(--danger);
}

.empty {
  text-align: center;
  color: var(--text-muted);
  padding: var(--space-4);
}
</style>

