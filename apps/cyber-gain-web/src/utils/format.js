/**
 * 前台餘額格式化：統一顯示小數點後兩位
 * @param {string|number|null|undefined} value - 餘額值
 * @returns {string} 格式化字串，如 "0.00"
 */
export function formatBalance(value) {
  if (value == null || value === '') return '0.00'
  const n = parseFloat(value)
  return Number.isNaN(n) ? '0.00' : n.toFixed(2)
}
