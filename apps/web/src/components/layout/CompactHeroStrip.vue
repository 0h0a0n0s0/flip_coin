<template>
  <section class="hero-strip">
    <div class="hero-content">
      <div class="hero-left">
        <div class="hero-badges">
          <span class="badge badge-primary">
            <Lightning class="badge-icon" />
            Provably Fair
          </span>
          <span class="badge badge-secondary">
            <TrendCharts class="badge-icon" />
            $2.5M Daily Volume
          </span>
          <span class="badge badge-success">
            <Trophy class="badge-icon" />
            10,000+ Winners Today
          </span>
        </div>
        <h1 class="hero-title">
          <span class="gradient-text">Win Big</span> with Crypto Fairness
        </h1>
        <p class="hero-subtitle">
          Transparent blockchain gaming • Instant crypto payouts • Every bet verifiable on-chain
        </p>
      </div>
      <div class="hero-right">
        <button class="cta-button primary" @click="handleSignUp">
          Sign Up Now
        </button>
        <button class="cta-button secondary" @click="handleDemo">
          Quick Demo
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { Lightning, TrendCharts, Trophy } from '@element-plus/icons-vue'

const emit = defineEmits(['signup', 'demo'])

function handleSignUp() {
  emit('signup')
}

function handleDemo() {
  emit('demo')
}
</script>

<style scoped>
.hero-strip {
  position: relative;
  overflow: hidden;
  background: linear-gradient(to right, rgba(243, 195, 64, 0.2), rgba(138, 108, 244, 0.2));
  border-bottom: 1px solid var(--border);
}

.hero-strip::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.3;
  background: linear-gradient(135deg, rgba(138, 108, 244, 0.4), rgba(243, 195, 64, 0.3));
  filter: blur(120px);
}

.hero-content {
  position: relative;
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-3) var(--space-4);
  min-height: 140px;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

@media (min-width: 768px) {
  .hero-content {
    min-height: 180px;
    padding: var(--space-4);
  }
}

@media (min-width: 1024px) {
  .hero-content {
    flex-wrap: nowrap;
    grid-template-columns: 1fr auto;
  }
}

.hero-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

@media (min-width: 768px) {
  .hero-left {
    gap: calc(var(--space-2) + var(--space-1));
  }
}

.hero-badges {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  height: 20px;
  padding: 0 calc(var(--space-2) + var(--space-1));
  font-size: 10px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  border: 1px solid;
}

.badge-primary {
  background-color: rgba(138, 108, 244, 0.3);
  color: var(--accent-foreground);
  border-color: rgba(138, 108, 244, 0.6);
}

.badge-secondary {
  background-color: rgba(243, 195, 64, 0.3);
  color: var(--primary-foreground);
  border-color: rgba(243, 195, 64, 0.6);
}

.badge-success {
  background-color: rgba(40, 192, 129, 0.3);
  color: #28C081;
  border-color: rgba(40, 192, 129, 0.6);
}

.badge-icon {
  width: 10px;
  height: 10px;
}

.hero-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--foreground);
  margin: 0;
  line-height: 1.2;
}

@media (min-width: 768px) {
  .hero-title {
    font-size: 30px;
  }
}

@media (min-width: 1024px) {
  .hero-title {
    font-size: 36px;
  }
}

.gradient-text {
  background: linear-gradient(to right, var(--primary), var(--accent), var(--accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
  max-width: 600px;
}

@media (min-width: 768px) {
  .hero-subtitle {
    font-size: 13px;
  }
}

.hero-right {
  display: flex;
  flex-direction: row;
  gap: var(--space-2);
}

@media (min-width: 768px) {
  .hero-right {
    flex-direction: column;
  }
}

.cta-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 var(--space-5);
  font-size: 13px;
  font-weight: 700;
  border-radius: var(--radius-lg);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

@media (min-width: 768px) {
  .cta-button {
    height: 44px;
    padding: 0 calc(var(--space-5) + var(--space-2));
    font-size: 14px;
  }
}

.cta-button.primary {
  background: linear-gradient(to right, var(--primary), var(--accent));
  color: var(--surface);
  box-shadow: 0 4px 12px rgba(243, 195, 64, 0.4);
}

.cta-button.primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(243, 195, 64, 0.5);
}

.cta-button.secondary {
  background-color: rgba(26, 28, 31, 0.5);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(138, 108, 244, 0.5);
  color: var(--foreground);
  font-weight: 600;
}

.cta-button.secondary:hover {
  background-color: rgba(138, 108, 244, 0.1);
  border-color: rgba(138, 108, 244, 0.7);
}
</style>
