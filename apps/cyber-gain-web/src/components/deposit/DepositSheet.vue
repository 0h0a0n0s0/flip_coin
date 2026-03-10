<template>
  <Teleport to="body">
    <Transition name="deposit-modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[100] flex flex-col justify-end"
        @click.self="close"
      >
        <!-- 半透明遮罩：與餘額彈窗相同 bg-black/50，點擊關閉，遮罩後方為當前頁面（首頁等） -->
        <div
          class="absolute inset-0 bg-black/50 cursor-pointer"
          aria-hidden="true"
          @click="close"
        ></div>
        <!-- 充值內容區塊：375.38×326px，完整顯示不用捲軸 -->
        <div
          class="relative w-full max-w-[375.38px] h-[326px] mx-auto rounded-t-[10px] overflow-hidden flex flex-col shrink-0"
          style="background: #0f182f; box-shadow: 0 -4px 17.5px rgba(253, 199, 0, 0.3)"
        >
          <!-- NN4po 區 -->
          <div class="relative p-3 flex flex-col gap-2 shrink-0">
              <div class="flex items-center justify-between h-7 shrink-0">
                  <button
                    class="w-7 h-7 flex items-center justify-center rounded-lg bg-[#1b2a52] shrink-0"
                    aria-label="返回"
                    @click="close"
                  >
                    <img src="/images/common/vectorLeft.svg" alt="" class="w-4 h-4 object-contain" />
                  </button>
                  <span class="text-base font-medium text-white flex-1 text-center">加密貨幣充值</span>
                  <button
                    class="w-7 h-7 flex items-center justify-center shrink-0"
                    aria-label="關閉"
                    @click="close"
                  >
                    <img src="/images/common/close.svg" alt="" class="w-4 h-4 object-contain" />
                  </button>
                </div>

                <div class="flex gap-2 w-full shrink-0">
                  <div class="flex-1 min-w-0 h-[48px] rounded-lg bg-[#1b2a52] flex items-center gap-3 px-3 py-1.5">
                    <img src="/images/common/tetherCoin.png" alt="USDT" class="w-6 h-6 object-contain shrink-0" />
                    <div class="flex flex-col gap-0.5 min-w-0">
                      <span class="text-xs font-medium text-[#8a8ca6]">貨幣</span>
                      <span class="text-sm font-medium text-white truncate">USDT</span>
                    </div>
                  </div>
                  <div
                    class="flex-1 min-w-0 h-[48px] rounded-lg bg-[#1b2a52] flex items-center gap-3 px-3 py-1.5 cursor-pointer"
                    @click="showNetworkPicker = !showNetworkPicker"
                  >
                    <img :src="selectedNetwork.icon" :alt="selectedNetwork.label" class="w-6 h-6 object-contain shrink-0" />
                    <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span class="text-xs font-medium text-[#8a8ca6]">網絡</span>
                      <span class="text-sm font-medium text-white truncate">{{ selectedNetwork.label }}</span>
                    </div>
                    <img
                      :src="showNetworkPicker ? '/images/common/vectorUp.svg' : '/images/common/vectorDown.svg'"
                      alt=""
                      class="w-4 h-4 object-contain shrink-0"
                    />
                  </div>
                </div>

                <div
                  v-if="showNetworkPicker"
                  class="absolute left-3 right-3 top-[88px] z-10 rounded-lg bg-[#0b1223] p-1.5 shrink-0 shadow-lg"
                >
                  <button
                    v-for="net in NETWORK_OPTIONS"
                    :key="net.value"
                    class="w-full flex items-center gap-3 h-10 px-3 rounded-lg transition-colors"
                    :class="selectedNetwork.value === net.value ? 'bg-[#1b2a52]' : 'hover:bg-[#1b2a52]/50'"
                    @click="selectNetwork(net)"
                  >
                    <img :src="net.icon" :alt="net.label" class="w-5 h-5 object-contain" />
                    <span class="text-sm font-medium" :class="selectedNetwork.value === net.value ? 'text-white' : 'text-[#8a8ca6]'">
                      {{ net.label }}
                    </span>
                  </button>
                </div>

                <div class="flex items-center justify-between gap-2 shrink-0">
                  <button class="flex-1 min-w-0 flex items-center gap-2 py-1" @click="bonusExpanded = !bonusExpanded">
                    <img src="/images/common/bonusEntryNoBottom.png" alt="獎勵" class="w-7 h-7 object-contain shrink-0" />
                    <div class="flex flex-col gap-0 text-left min-w-0">
                      <span class="text-xs font-medium text-[#d1d5dc]">使用中的充值獎勵</span>
                      <span class="text-xs font-medium text-white">高達 150% 充值 & 50 次免費旋轉獎勵</span>
                    </div>
                  </button>
                  <div class="w-6 h-6 flex items-center justify-center shrink-0" @click="bonusExpanded = !bonusExpanded">
                    <img
                      :src="bonusExpanded ? '/images/common/vectorUp.svg' : '/images/common/vectorDown.svg'"
                      alt=""
                      class="w-3.5 h-3.5 object-contain"
                    />
                  </div>
                </div>
              </div>

              <!-- RBUS4 區 -->
              <div class="bg-[#1b2a52] px-3 pb-3 pt-3 flex flex-col gap-2 shrink-0">
                <span class="text-xs font-medium text-[#8a8ca6]">你的 USDT 充值地址</span>
                <div class="flex gap-2 items-start">
                  <div class="flex-1 min-w-0 flex flex-col gap-1">
                    <div
                      class="flex items-center justify-between gap-2 h-[46px] rounded-lg bg-[#0f182f] pl-3 pr-2 py-1"
                    >
                      <span class="text-sm font-medium text-white truncate font-mono flex-1 min-w-0">{{ displayAddress }}</span>
                      <button
                        class="w-9 h-9 flex items-center justify-center rounded-lg bg-[#1b2a52] shrink-0"
                        aria-label="複製地址"
                        @click="copyAddress"
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" class="text-white shrink-0">
                          <path d="M12 1.5H4.5A1.5 1.5 0 003 3v10.5a1.5 1.5 0 001.5 1.5H12a1.5 1.5 0 001.5-1.5V3A1.5 1.5 0 0012 1.5zm0 12H4.5V3H12v10.5zM15 5.25h-1.5V4.5a1.5 1.5 0 00-1.5-1.5h-6v1.5h6v9h1.5V5.25z" fill="currentColor" />
                        </svg>
                      </button>
                    </div>
                    <div class="flex items-center gap-1 pt-0 pb-1" style="padding-right: 8px">
                      <span class="text-xs font-medium text-[#8a8ca6]">最小充值數量</span>
                      <span class="text-xs font-medium text-white">1 USDT</span>
                      <button class="w-4 h-4 rounded-full flex items-center justify-center text-[#355FD1]" aria-label="說明">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm.8 10H7.2V8.5h1.6V11zm0-4.5H7.2V4.2h1.6v2.3z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div class="w-[46px] h-[46px] rounded-md bg-white p-1 shrink-0 flex items-center justify-center overflow-hidden">
                    <QrcodeVue
                      v-if="currentDepositAddress"
                      :value="currentDepositAddress"
                      :size="44"
                      level="M"
                      render-as="canvas"
                    />
                    <span v-else class="text-[10px] text-[#8a8ca6]">載入中</span>
                  </div>
                </div>
                <div class="flex items-center justify-center gap-1 py-2 px-0 rounded-md bg-[#0f182f]/50">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="shrink-0">
                    <path d="M7 1l1.2 3.6H4.8L7 1zm0 5.5c.5 0 .9.4.9.9v2.2c0 .5-.4.9-.9.9s-.9-.4-.9-.9V7.4c0-.5.4-.9.9-.9z" fill="#FDC700" />
                    <circle cx="7" cy="12" r="1" fill="#FDC700" />
                  </svg>
                  <span class="text-xs font-medium">
                    <span class="text-[#8a8ca6]">僅發送</span>
                    <span class="text-white"> USDT </span>
                    <span class="text-[#8a8ca6]">到這個地址</span>
                  </span>
                </div>
              </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
/**
 * 充值內容區塊：與餘額彈窗同結構
 * 在首頁點擊 Header 黃色方框後向上展出，遮罩後方為當前頁面（首頁等）
 */
import { computed, ref, watch } from 'vue'
import QrcodeVue from 'qrcode.vue'
import { state } from '@/store/index.js'
import { notifySuccess } from '@/utils/notify.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const NETWORK_OPTIONS = [
  { value: 'TRC20', label: 'TRC-20', icon: '/images/common/tetherCoin.png', useTron: true },
  { value: 'ERC20', label: 'ERC-20', icon: '/images/common/tetherCoin.png', useTron: false },
  { value: 'BEP20', label: 'BNB Chain', icon: '/images/common/bnb2Coin.png', useTron: false }
]

const selectedNetwork = ref(NETWORK_OPTIONS[0])
const showNetworkPicker = ref(false)
const bonusExpanded = ref(true)

const currentUser = computed(() => state.currentUser)
const currentDepositAddress = computed(() => {
  if (!currentUser.value) return ''
  return selectedNetwork.value.useTron
    ? (currentUser.value.tron_deposit_address || '')
    : (currentUser.value.evm_deposit_address || '')
})
const displayAddress = computed(() => {
  const addr = currentDepositAddress.value
  if (!addr) return '地址生成中...'
  return addr.length <= 16 ? addr : `${addr.slice(0, 8)}...${addr.slice(-8)}`
})

function selectNetwork(net) {
  selectedNetwork.value = net
  showNetworkPicker.value = false
}

async function copyAddress() {
  const addr = currentDepositAddress.value
  if (!addr) return
  try {
    await navigator.clipboard.writeText(addr)
    notifySuccess('地址已複製到剪貼簿')
  } catch (e) {
    console.error('[DepositSheet] 複製失敗:', e)
  }
}

function close() {
  emit('update:modelValue', false)
}

watch(() => props.modelValue, (v) => {
  if (v) {
    showNetworkPicker.value = false
    selectedNetwork.value = NETWORK_OPTIONS[0]
  }
})
</script>

<style scoped>
.deposit-modal-enter-active,
.deposit-modal-leave-active {
  transition: opacity 0.25s ease;
}
.deposit-modal-enter-active .relative,
.deposit-modal-leave-active .relative {
  transition: transform 0.25s ease;
}
.deposit-modal-enter-from,
.deposit-modal-leave-to {
  opacity: 0;
}
.deposit-modal-enter-from .relative,
.deposit-modal-leave-to .relative {
  transform: translateY(100%);
}
</style>
