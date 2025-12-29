<template>
  <footer class="footer">
    <div class="footer-container">
      <div class="footer-grid">
        <!-- About -->
        <div class="footer-section">
          <h3 class="footer-title">{{ t('footer.about_title') }}</h3>
          <p class="footer-text">
            {{ t('footer.about_text') }}
          </p>
        </div>

        <!-- Quick Links -->
        <div class="footer-section">
          <h3 class="footer-title">{{ t('footer.quick_links_title') }}</h3>
          <ul class="footer-links">
            <li>{{ t('footer.fairness_verification') }}</li>
            <li>{{ t('footer.terms_conditions') }}</li>
            <li>{{ t('footer.responsible_gaming') }}</li>
            <li>{{ t('footer.help_center') }}</li>
          </ul>
        </div>

        <!-- Payment Methods -->
        <div class="footer-section">
          <h3 class="footer-title">{{ t('footer.accepted_payments_title') }}</h3>
          <div class="payment-methods">
            <div class="payment-badge">
              <el-icon><Wallet /></el-icon>
              <span>BTC</span>
            </div>
            <div class="payment-badge">
              <el-icon><Wallet /></el-icon>
              <span>USDT</span>
            </div>
            <div class="payment-badge">
              <el-icon><Wallet /></el-icon>
              <span>ETH</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Bar -->
      <div class="footer-bottom">
        <p>{{ t('footer.copyright') }}</p>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { Wallet } from '@element-plus/icons-vue'

const { t } = useI18n()
</script>

<style scoped>
.footer {
  display: none;
  border-top: 1px solid var(--border);
  background-color: rgba(26, 28, 31, 0.2);
  margin-top: var(--space-6);
}

@media (min-width: 768px) {
  .footer {
    display: block;
  }
}

.footer-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-4);
}

.footer-grid {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.footer-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.footer-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground);
}

.footer-text {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
}

.footer-links {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.footer-links li {
  font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.2s;
  white-space: nowrap; /* 防止文字换行 */
  min-width: fit-content; /* 保持最小宽度 */
}

.footer-links li:hover {
  color: var(--primary);
}

.payment-methods {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.payment-badge {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  background-color: rgba(26, 28, 31, 0.5);
  border: 1px solid var(--border);
  font-size: 10px;
  font-weight: 500;
  color: var(--foreground);
}

.footer-bottom {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border);
  text-align: center;
  font-size: 10px;
  color: var(--text-muted);
}
</style>

