<template>
  <el-dialog
    v-model="dialogVisible"
    title="Wallet"
    width="420px"
    :close-on-click-modal="true"
    @close="handleClose"
    class="wallet-modal"
  >
    <el-tabs v-model="activeTab">
      <el-tab-pane label="Deposit" name="deposit">
        <div class="deposit-content">
          <el-select v-model="selectedChain" class="chain-select">
            <el-option label="USDT (TRC20)" value="TRC20" />
            <el-option label="USDT (ERC20)" value="ERC20" />
            <el-option label="USDT (BEP20)" value="BEP20" />
          </el-select>

          <div class="qr-code-area">
            <div class="qr-placeholder">
              <el-icon :size="80"><QrCodeIcon /></el-icon>
            </div>
            <el-tag class="chain-badge">{{ selectedChain }}</el-tag>
          </div>

          <div class="address-group">
            <el-input
              v-model="walletAddress"
              readonly
              class="address-input"
            />
            <el-button @click="handleCopyAddress">Copy</el-button>
          </div>

          <el-alert
            type="warning"
            :closable="false"
            class="deposit-warning"
          >
            <template #default>
              <strong>Min: $10</strong> • Only send {{ selectedChain }}. Other assets may be lost permanently.
            </template>
          </el-alert>
        </div>
      </el-tab-pane>

      <el-tab-pane label="Withdraw" name="withdraw">
        <div class="withdraw-content">
          <div class="balance-display">
            <div class="balance-label">Available Balance</div>
            <div class="balance-amount">${{ formatBalance(currentUser?.balance) }}</div>
          </div>

          <el-select v-model="withdrawChain" class="chain-select">
            <el-option label="TRC20 (TRON)" value="TRC20" />
            <el-option label="BSC (BEP20)" value="BSC" />
            <el-option label="ETH (ERC20)" value="ETH" />
            <el-option label="SOL (Solana)" value="SOL" />
            <el-option label="Polygon" value="POLYGON" />
          </el-select>

          <el-input
            v-model="withdrawAddress"
            placeholder="Enter wallet address"
            class="withdraw-input"
          />

          <div class="amount-group">
            <el-input
              v-model.number="withdrawAmount"
              type="number"
              placeholder="0.00"
              class="amount-input"
            />
            <span class="amount-label">USDT</span>
            <el-button text @click="setMaxAmount">MAX</el-button>
          </div>

          <el-input
            v-model="withdrawPassword"
            type="password"
            placeholder="Withdrawal password"
            class="withdraw-input"
          />

          <el-button
            type="primary"
            @click="handleWithdraw"
            :loading="loading"
            class="withdraw-button"
          >
            Withdraw
          </el-button>

          <el-alert
            type="info"
            :closable="false"
            class="withdraw-info"
          >
            <template #default>
              Min: $20 • Processing: 5-30 min • Network fee deducted
            </template>
          </el-alert>
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Document as QrCodeIcon } from '@element-plus/icons-vue'
import { useWallet } from '@/composables/useWallet.js'
import { getCurrentUser } from '@/store/index.js'

const props = defineProps({
  modelValue: Boolean
})

const emit = defineEmits(['update:modelValue'])

const dialogVisible = ref(props.modelValue)
const activeTab = ref('deposit')
const selectedChain = ref('TRC20')
const withdrawChain = ref('TRC20')
const walletAddress = ref('')
const withdrawAddress = ref('')
const withdrawAmount = ref('')
const withdrawPassword = ref('')

const currentUser = computed(() => getCurrentUser())
const { handleSubmitWithdrawal, copyAddress, loading } = useWallet()

watch(() => props.modelValue, (val) => {
  dialogVisible.value = val
  if (val && currentUser.value) {
    // 加载钱包地址（需要从 API 获取）
    walletAddress.value = currentUser.value.tron_address || ''
  }
})

watch(dialogVisible, (val) => {
  emit('update:modelValue', val)
})

function formatBalance(balance) {
  if (!balance) return '0.00'
  return parseFloat(balance).toFixed(2)
}

async function handleCopyAddress() {
  if (walletAddress.value) {
    await copyAddress(walletAddress.value)
  }
}

function setMaxAmount() {
  if (currentUser.value) {
    withdrawAmount.value = parseFloat(currentUser.value.balance).toFixed(2)
  }
}

async function handleWithdraw() {
  const success = await handleSubmitWithdrawal(
    withdrawChain.value,
    withdrawAddress.value,
    withdrawAmount.value,
    withdrawPassword.value
  )
  if (success) {
    withdrawAddress.value = ''
    withdrawAmount.value = ''
    withdrawPassword.value = ''
  }
}

function handleClose() {
  dialogVisible.value = false
}
</script>

<style scoped>
.wallet-modal :deep(.el-dialog) {
  background-color: var(--card);
  border: 1px solid var(--border);
}

.deposit-content,
.withdraw-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.chain-select {
  width: 100%;
}

.qr-code-area {
  display: flex;
  justify-content: center;
  padding: var(--space-3);
  position: relative;
}

.qr-placeholder {
  width: 132px;
  height: 132px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(to bottom right, var(--accent), var(--accent-secondary));
  border-radius: var(--radius-md);
  color: white;
}

.chain-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background-color: var(--primary);
  color: var(--surface);
  font-weight: bold;
  font-size: 11px;
  height: 22px;
}

.address-group {
  display: flex;
  gap: var(--space-2);
}

.address-input {
  flex: 1;
}

.address-input :deep(.el-input__inner) {
  font-family: monospace;
  font-size: 12px;
}

.deposit-warning {
  font-size: 12px;
}

.balance-display {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: linear-gradient(to right, rgba(243, 195, 64, 0.2), rgba(138, 108, 244, 0.2));
  border: 1px solid rgba(243, 195, 64, 0.3);
}

.balance-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.balance-amount {
  font-size: 24px;
  font-weight: bold;
  color: var(--foreground);
}

.withdraw-input {
  width: 100%;
}

.amount-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  position: relative;
}

.amount-input {
  flex: 1;
}

.amount-label {
  position: absolute;
  right: 60px;
  font-size: 12px;
  color: var(--text-muted);
}

.withdraw-button {
  width: 100%;
  height: 40px;
}

.withdraw-info {
  font-size: 11px;
}
</style>

