<template>
  <div class="banner-container">
    <div class="banner-image">
      <img 
        :src="bannerImage" 
        :alt="bannerAlt"
        class="banner-img"
      />
      <div class="banner-overlay">
        <div class="banner-content">
          <h1 class="banner-title">{{ title }}</h1>
          <p class="banner-subtitle">{{ subtitle }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: 'Win Big with Crypto Fairness'
  },
  subtitle: {
    type: String,
    default: 'Transparent blockchain gaming • Instant crypto payouts'
  },
  imageUrl: {
    type: String,
    default: null
  },
  bannerAlt: {
    type: String,
    default: 'Banner'
  }
})

// 使用占位图片 - 可以用实际图片 URL 替换
const bannerImage = ref(
  props.imageUrl || 
  '/banner-placeholder.svg'
)
</script>

<style scoped>
.banner-container {
  width: 100%;
  margin-bottom: var(--space-4);
}

.banner-image {
  position: relative;
  width: 100%;
  height: 200px;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: linear-gradient(135deg, rgba(243, 195, 64, 0.2), rgba(138, 108, 244, 0.2));
}

@media (min-width: 768px) {
  .banner-image {
    height: 240px;
  }
}

@media (min-width: 1024px) {
  .banner-image {
    height: 280px;
  }
}

.banner-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.banner-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    to right,
    rgba(19, 20, 22, 0.7) 0%,
    rgba(19, 20, 22, 0.5) 50%,
    rgba(19, 20, 22, 0.3) 100%
  );
  display: flex;
  align-items: center;
  padding: var(--space-6);
}

.banner-content {
  max-width: 600px;
}

.banner-title {
  font-size: 24px;
  font-weight: 700;
  color: rgb(var(--foreground));
  margin: 0 0 var(--space-2) 0;
  line-height: 1.2;
  background: linear-gradient(to right, rgb(var(--primary)), rgb(var(--accent)));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

@media (min-width: 768px) {
  .banner-title {
    font-size: 32px;
  }
}

@media (min-width: 1024px) {
  .banner-title {
    font-size: 40px;
  }
}

.banner-subtitle {
  font-size: 13px;
  color: rgb(var(--text-muted));
  margin: 0;
  line-height: 1.5;
}

@media (min-width: 768px) {
  .banner-subtitle {
    font-size: 15px;
  }
}
</style>

