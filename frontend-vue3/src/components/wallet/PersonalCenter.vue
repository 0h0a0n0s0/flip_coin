<template>
  <el-dialog
    v-model="dialogVisible"
    title="個人中心"
    width="480px"
    :close-on-click-modal="true"
    @close="handleClose"
    class="personal-center-modal"
  >
    <el-tabs v-model="activeTab">
      <!-- Info Tab -->
      <el-tab-pane label="基本资讯" name="info">
        <div class="info-content">
          <ul class="info-list">
            <li><span>用户 ID:</span> <strong>{{ currentUser?.id }}</strong></li>
            <li><span>用户帐号:</span> <strong>{{ currentUser?.username }}</strong></li>
            <li><span>用户等级:</span> <strong>{{ currentUser?.level || 'N/A' }}</strong></li>
            <li><span>最高連胜:</span> <strong>{{ currentUser?.max_streak || 0 }}</strong></li>
            <li><span>我的邀请码:</span> <strong>{{ currentUser?.invite_code }}</strong></li>
            <li><span>推薦人邀请码:</span> <strong>{{ currentUser?.referrer_code || 'N/A' }}</strong></li>
          </ul>

          <div class="form-section">
            <h4>修改昵称</h4>
            <div class="form-group">
              <el-input
                v-model="nickname"
                placeholder="输入新的昵称 (50字内)"
                class="nickname-input"
              />
              <el-button @click="handleSaveNickname" :loading="loading">
                储存
              </el-button>
            </div>
          </div>

          <div v-if="!currentUser?.referrer_code" class="form-section">
            <h4>绑定推薦人</h4>
            <div class="form-group">
              <el-input
                v-model="referrerCode"
                placeholder="输入推薦人的邀请码 (绑定後無法修改)"
              />
              <el-button @click="handleBindReferrer" :loading="loading">
                绑定
              </el-button>
            </div>
          </div>

          <div class="form-section">
            <h4>安全设置</h4>
            <div class="password-status">
              <span>提款密码: </span>
              <strong>{{ currentUser?.has_withdrawal_password ? '已设置' : '未设置' }}</strong>
              <el-button
                v-if="!currentUser?.has_withdrawal_password"
                @click="showSetPwdModal = true"
                size="small"
              >
                设置
              </el-button>
              <el-button
                v-else
                @click="showChangePwdModal = true"
                size="small"
              >
                修改
              </el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- Deposit Tab -->
      <el-tab-pane label="充值 (USDT)" name="deposit">
        <div class="deposit-content">
          <h4>TRC20 充值地址 (僅限 USDT)</h4>
          <el-alert type="warning" :closable="false" class="deposit-warning">
            <strong>警告：</strong> 请勿充值除 TRC20-USDT 以外的任何资产，否則将导致丢失。
          </el-alert>
          <div class="address-group">
            <el-input
              v-model="tronAddress"
              readonly
              class="address-input"
            />
            <el-button @click="handleCopyTron">复制</el-button>
          </div>

          <h4 style="margin-top: var(--space-5);">EVM 充值地址 (僅限 USDT)</h4>
          <el-alert type="warning" :closable="false" class="deposit-warning">
            <strong>警告：</strong> 僅支持 BSC / ETH / Polygon 网路的 USDT。
          </el-alert>
          <div class="address-group">
            <el-input
              v-model="evmAddress"
              readonly
              class="address-input"
            />
            <el-button @click="handleCopyEvm">复制</el-button>
          </div>

          <div class="deposit-tip">
            * 充值到帐时间约 1-3 分钟。<br>
            * 最小充值金额：1 USDT。
          </div>

          <h4 style="margin-top: var(--space-6);">充值记录</h4>
          <ul v-if="depositHistory.length > 0" class="history-list">
            <li v-for="(item, index) in depositHistory" :key="index">
              <span class="amount">{{ item.amount }} USDT ({{ item.chain }})</span>
              <span>时间: {{ formatTime(item.created_at) }}</span>
              <span class="status-completed">狀态: 已到帐</span>
            </li>
          </ul>
          <div v-else class="empty">暂無充值记录</div>
        </div>
      </el-tab-pane>

      <!-- Withdraw Tab -->
      <el-tab-pane label="提款 (USDT)" name="withdraw">
        <div class="withdraw-content">
          <h4>提交提款请求</h4>
          <el-select v-model="withdrawChain" class="chain-select">
            <el-option label="TRC20 (TRON)" value="TRC20" />
            <el-option label="BSC (BEP20)" value="BSC" />
            <el-option label="ETH (ERC20)" value="ETH" />
            <el-option label="SOL (Solana)" value="SOL" />
            <el-option label="Polygon" value="POLYGON" />
          </el-select>

          <el-input
            v-model="withdrawAddress"
            placeholder="请输入对应链的 USDT 地址"
            class="withdraw-input"
          />

          <el-input
            v-model.number="withdrawAmount"
            type="number"
            placeholder="最小提款 10 USDT"
            class="withdraw-input"
          />

          <el-input
            v-model="withdrawPassword"
            type="password"
            placeholder="请输入您的提款密码"
            class="withdraw-input"
          />

          <el-button
            type="primary"
            @click="handleSubmitWithdrawal"
            :loading="loading"
            class="withdraw-button"
          >
            确认提款
          </el-button>

          <h4 style="margin-top: var(--space-6);">提款记录</h4>
          <ul v-if="withdrawalHistory.length > 0" class="history-list">
            <li v-for="(item, index) in withdrawalHistory" :key="index">
              <span class="amount">{{ item.amount }} USDT ({{ item.chain_type }})</span>
              <span>地址: {{ item.address_masked || item.address }}</span>
              <span>时间: {{ formatTime(item.request_time) }}</span>
              <span :class="['status', `status-${item.status}`]">
                狀态: {{ getWithdrawStatusText(item.status) }}
              </span>
            </li>
          </ul>
          <div v-else class="empty">暂無提款记录</div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
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
import { useWallet } from '@/composables/useWallet.js'
import { getCurrentUser } from '@/store/index.js'
import SetPasswordModal from './SetPasswordModal.vue'
import ChangePasswordModal from './ChangePasswordModal.vue'

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
    tronAddress.value = currentUser.value.tron_address || ''
    evmAddress.value = currentUser.value.evm_address || ''
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
    pending: '待審核',
    processing: '出款中',
    completed: '出款完成',
    rejected: '已拒绝'
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

