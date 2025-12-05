<template>
  <footer class="footer">
    <div class="footer-container">
      <div class="footer-grid">
        <!-- About -->
        <div class="footer-section">
          <h3 class="footer-title">About FairHash</h3>
          <p class="footer-text">
            The most transparent and fair crypto gambling platform powered by blockchain technology.
          </p>
        </div>

        <!-- Quick Links -->
        <div class="footer-section">
          <h3 class="footer-title">Quick Links</h3>
          <ul class="footer-links">
            <li>Fairness Verification</li>
            <li>Terms & Conditions</li>
            <li>Responsible Gaming</li>
            <li>Help Center</li>
          </ul>
        </div>

        <!-- Payment Methods -->
        <div class="footer-section">
          <h3 class="footer-title">Accepted Payments</h3>
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
        <p>© 2025 FairHash. Licensed and regulated. Play responsibly.</p>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { Wallet } from '@element-plus/icons-vue'
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

