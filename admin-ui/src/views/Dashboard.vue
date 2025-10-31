<template>
  <div>
    <h2>儀表板 (Dashboard)</h2>
    <p>歡迎回來！</p>
    
    <el-card shadow="never" v-loading="loading">
      <template #header>
        <div>核心數據統計</div>
      </template>
      <div v-if="stats" class="stats-container">
        <div class="stat-item">
          <div class="stat-label">總用戶數</div>
          <div class="stat-value">{{ stats.totalUsers }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">總投注數</div>
          <div class="stat-value">{{ stats.totalBets }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">異常訂單 (待派獎)</div>
          <div class="stat-value">{{ stats.pendingPayouts }}</div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script>
export default {
  name: 'DashboardView',
  data() {
    return {
      loading: true,
      stats: null,
    };
  },
  async created() {
    // 頁面一載入，就去呼叫受保護的 API
    await this.fetchStats();
  },
  methods: {
    async fetchStats() {
      this.loading = true;
      try {
        // (★★★ 關鍵 ★★★)
        // 呼叫受保護的 API。
        // request.js 會自動附加 Token。
        // 如果 Token 無效，request.js 攔截器會自動把我們踢回登入頁。
        const data = await this.$api.getDashboardStats();
        this.stats = data;
      } catch (error) {
        // (錯誤會被 request.js 攔截器處理)
        console.error('Failed to fetch stats (handled by interceptor):', error);
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.stats-container {
  display: flex;
  justify-content: space-around;
}
.stat-item {
  text-align: center;
}
.stat-label {
  font-size: 14px;
  color: #606266;
  margin-bottom: 10px;
}
.stat-value {
  font-size: 24px;
  font-weight: bold;
}
</style>