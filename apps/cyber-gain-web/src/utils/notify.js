// 統一的通知系統模組 - Cyber Gain 自訂 Toast
// 從 Notyf 遷移至自訂 Toast 組件

import { addToast, dismissAll } from '@/store/toast.js'

/**
 * 顯示成功提示
 */
export function notifySuccess(message) {
  return addToast('success', message)
}

/**
 * 顯示錯誤提示
 */
export function notifyError(message) {
  return addToast('error', message)
}

/**
 * 顯示警告提示
 */
export function notifyWarning(message) {
  return addToast('warning', message)
}

/**
 * 關閉所有提示
 */
export { dismissAll }
