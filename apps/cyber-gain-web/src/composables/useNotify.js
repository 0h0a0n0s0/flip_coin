// useNotify composable - 供組件內觸發 Toast
// 與 utils/notify.js 共用同一 store，可擇一使用

import {
  notifySuccess,
  notifyError,
  notifyWarning,
  dismissAll
} from '@/utils/notify.js'

/**
 * 通知 composable
 * @returns {{ notifySuccess, notifyError, notifyWarning, dismissAll }}
 */
export function useNotify() {
  return {
    notifySuccess,
    notifyError,
    notifyWarning,
    dismissAll
  }
}
