<template>
  <Teleport to="body">
    <div
      class="toast-container fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-[460px] flex flex-col gap-2 pointer-events-none"
    >
      <TransitionGroup name="toast">
        <div
          v-for="item in toastState.items"
          :key="item.id"
          class="toast-item flex items-center gap-3 min-h-[56px] py-3 px-4 rounded-xl border-[1.5px] bg-[#0B132B] text-white font-bold text-base pointer-events-auto transition-all duration-300 cursor-pointer"
          :class="borderClass(item.type)"
          @click="removeToast(item.id)"
          role="button"
          tabindex="0"
          @keydown.enter="removeToast(item.id)"
        >
          <img
            :src="iconSrc(item.type)"
            :alt="item.type"
            class="w-8 h-8 shrink-0 object-contain self-center"
          />
          <span class="w-[263px] min-h-[22px] text-base leading-[22px] break-words">{{ item.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { toastState, removeToast } from '@/store/toast.js'

const ICONS = {
  success: '/images/common/healthy.svg',
  warning: '/images/common/warn.svg',
  error: '/images/common/error.svg'
}

const BORDER_COLORS = {
  success: 'border-[#10B981]',
  warning: 'border-[#FBBF24]',
  error: 'border-[#EF4444]'
}

function iconSrc(type) {
  return ICONS[type] ?? ICONS.error
}

function borderClass(type) {
  return BORDER_COLORS[type] ?? BORDER_COLORS.error
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
