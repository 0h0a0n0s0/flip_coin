<template>
  <nav class="bottom-nav">
    <div class="nav-container">
      <button 
        class="nav-item"
        :class="{ 'active': activeTab === 'menu' }"
        @click="handleNavClick('menu')"
      >
        <div class="nav-icon">
          <img 
            :src="activeTab === 'menu' ? '/images/nav/menuSelect.svg' : '/images/nav/menu.svg'" 
            alt="选单" 
            class="icon-img"
          />
        </div>
        <span class="nav-label">选单</span>
      </button>

      <button 
        class="nav-item"
        :class="{ 'active': activeTab === 'activity' }"
        @click="handleNavClick('activity')"
      >
        <div class="nav-icon">
          <img 
            :src="activeTab === 'activity' ? '/images/nav/activitySelect.svg' : '/images/nav/activity.svg'" 
            alt="活动" 
            class="icon-img"
          />
        </div>
        <span class="nav-label">活动</span>
      </button>

      <button 
        class="nav-item"
        :class="{ 'active': activeTab === 'recommend' }"
        @click="handleNavClick('recommend')"
      >
        <div class="nav-icon">
          <img 
            :src="activeTab === 'recommend' ? '/images/nav/recommendSelect.svg' : '/images/nav/recommend.svg'" 
            alt="推荐" 
            class="icon-img"
          />
        </div>
        <span class="nav-label">推荐</span>
      </button>

      <button 
        class="nav-item"
        :class="{ 'active': activeTab === 'vip' }"
        @click="handleNavClick('vip')"
      >
        <div class="nav-icon">
          <img 
            :src="activeTab === 'vip' ? '/images/nav/vipSelect.svg' : '/images/nav/vip.svg'" 
            alt="VIP" 
            class="icon-img"
          />
        </div>
        <span class="nav-label">VIP</span>
      </button>

      <button 
        class="nav-item"
        :class="{ 'active': activeTab === 'chat' }"
        @click="handleNavClick('chat')"
      >
        <div class="nav-icon">
          <img 
            :src="activeTab === 'chat' ? '/images/nav/chatSelect.svg' : '/images/nav/chat.svg'" 
            alt="聊天" 
            class="icon-img"
          />
        </div>
        <span class="nav-label">聊天</span>
      </button>
    </div>
  </nav>
</template>

<script setup>
import { ref } from 'vue'

const activeTab = ref('menu')

const handleNavClick = (tab) => {
  activeTab.value = tab
  console.log(`[BottomNav] 切換到 ${tab}`)
}
</script>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  width: 100%;
  max-width: 500px;
}

.nav-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-around;
  width: 100%;
  height: 56px;
  background: #0f182f;
  border-radius: 20px 20px 0 0;
  
  /* 外阴影和光晕 */
  box-shadow: 0 -4px 13.125px rgba(253, 199, 0, 0.2);
  
  /* 使用 border-image 实现贴合圆角的渐层描边 */
  border-top: 1px solid transparent;
  border-left: 1px solid transparent;
  border-right: 1px solid transparent;
  background-clip: padding-box;
  position: relative;
}

/* 使用伪元素实现完美贴合圆角的渐层描边 */
.nav-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 20px 20px 0 0;
  padding: 1px 1px 0 1px; /* 上、左、右各1px描边 */
  background: linear-gradient(
    135deg,
    rgba(246, 255, 146, 0.5) 0%,
    rgba(246, 255, 146, 0.5) 3.37%,
    rgba(253, 199, 0, 0.5) 52.88%
  );
  -webkit-mask: 
    linear-gradient(#fff 0 0) content-box, 
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

.nav-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  height: 100%;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 0;
}

.nav-icon {
  position: relative;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.nav-label {
  font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 11px;
  font-weight: 400;
  line-height: 1;
  color: #8a8ca6;
  transition: color 0.3s ease;
}

/* 激活状态 */
.nav-item.active .nav-label {
  color: #ffdd00;
}

/* 点击反馈 */
.nav-item:active {
  transform: scale(0.95);
}
</style>
