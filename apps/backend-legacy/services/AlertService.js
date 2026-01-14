// 档案: backend/services/AlertService.js
// 功能: Telegram Bot 通知服務

const axios = require('axios');

// (從環境變數讀取 Telegram Bot 配置)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Telegram Bot API 基礎 URL
const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

class AlertService {
    constructor() {
        this.enabled = !!(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);
        
        if (!this.enabled) {
            console.warn('[AlertService] Telegram Bot not configured. Alerts will be disabled.');
            console.warn('[AlertService] Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env to enable alerts.');
        } else {
            console.log(`✅ [AlertService] Telegram Bot initialized. Chat ID: ${TELEGRAM_CHAT_ID}`);
        }
    }

    /**
     * @description 發送關鍵警報（P0）
     * @param {string} message - 警報消息
     * @param {Object} options - 可選參數（如標記、格式化等）
     */
    async sendCritical(message, options = {}) {
        if (!this.enabled) {
            console.warn('[AlertService] sendCritical called but alerts are disabled:', message);
            return false;
        }

        try {
            const formattedMessage = this._formatMessage(message, 'CRITICAL', options);
            return await this._sendTelegramMessage(formattedMessage);
        } catch (error) {
            console.error('[AlertService] Failed to send critical alert:', error.message);
            return false;
        }
    }

    /**
     * @description 發送信息通知
     * @param {string} message - 通知消息
     * @param {Object} options - 可選參數
     */
    async sendInfo(message, options = {}) {
        if (!this.enabled) {
            console.log('[AlertService] sendInfo (disabled):', message);
            return false;
        }

        try {
            const formattedMessage = this._formatMessage(message, 'INFO', options);
            return await this._sendTelegramMessage(formattedMessage);
        } catch (error) {
            console.error('[AlertService] Failed to send info alert:', error.message);
            return false;
        }
    }

    /**
     * @description 格式化消息
     * @private
     */
    _formatMessage(message, level, options = {}) {
        const timestamp = new Date().toISOString();
        const levelEmoji = level === 'CRITICAL' ? '🚨' : 'ℹ️';
        const levelTag = level === 'CRITICAL' ? '**CRITICAL**' : '*INFO*';
        
        let formatted = `${levelEmoji} ${levelTag}\n`;
        formatted += `時間: ${timestamp}\n\n`;
        formatted += message;
        
        // 添加額外信息（如果提供）
        if (options.extra) {
            formatted += `\n\n${options.extra}`;
        }
        
        return formatted;
    }

    /**
     * @description 發送 Telegram 消息
     * @private
     */
    async _sendTelegramMessage(message) {
        try {
            const url = `${TELEGRAM_API_BASE}${TELEGRAM_BOT_TOKEN}/sendMessage`;
            
            const response = await axios.post(url, {
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            }, {
                timeout: 10000 // 10 秒超時
            });

            if (response.data && response.data.ok) {
                return true;
            } else {
                console.error('[AlertService] Telegram API returned error:', response.data);
                return false;
            }
        } catch (error) {
            if (error.response) {
                console.error('[AlertService] Telegram API error:', error.response.data);
            } else {
                console.error('[AlertService] Network error:', error.message);
            }
            throw error;
        }
    }

    /**
     * @description 檢查服務是否啟用
     */
    isEnabled() {
        return this.enabled;
    }
}

// (單例模式)
let instance = null;
function getAlertInstance() {
    if (!instance) {
        instance = new AlertService();
    }
    return instance;
}

module.exports = {
    getAlertInstance
};

