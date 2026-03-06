// Toast 單例 store - Cyber Gain 風格
import { reactive } from 'vue'

const DEFAULT_DURATION = 3000

const toastState = reactive({
  items: []
})

let idCounter = 0
const timeoutMap = new Map()

function generateId() {
  return `toast-${++idCounter}-${Date.now()}`
}

/**
 * 新增 Toast
 * @param {'success'|'warning'|'error'} type
 * @param {string} message
 * @param {number} [duration]
 */
export function addToast(type, message, duration = DEFAULT_DURATION) {
  const id = generateId()
  const item = { id, type, message }
  toastState.items.push(item)

  const timeoutId = setTimeout(() => {
    removeToast(id)
    timeoutMap.delete(id)
  }, duration)
  timeoutMap.set(id, timeoutId)

  return id
}

/**
 * 移除指定 Toast
 */
export function removeToast(id) {
  const idx = toastState.items.findIndex((t) => t.id === id)
  if (idx >= 0) {
    const t = toastState.items[idx]
    if (timeoutMap.has(t.id)) {
      clearTimeout(timeoutMap.get(t.id))
      timeoutMap.delete(t.id)
    }
    toastState.items.splice(idx, 1)
  }
}

/**
 * 關閉所有 Toast
 */
export function dismissAll() {
  timeoutMap.forEach((tid) => clearTimeout(tid))
  timeoutMap.clear()
  toastState.items.length = 0
}

export { toastState }
