<template>
  <div>
    <h2>仪表板 (Dashboard)</h2>
    <p>欢迎回来！</p>
    
    <el-card shadow="never" v-loading="loading">
      <template #header>
        <div>核心数据统计</div>
      </template>
      <div v-if="stats" class="stats-container">
        <div class="stat-item">
          <div class="stat-label">总用户数</div>
          <div class="stat-value">{{ stats.totalUsers }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">总投注数</div>
          <div class="stat-value">{{ stats.totalBets }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">異常订单 (待派奖)</div>
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
    // 页面一载入，就去呼叫受保护的 API
    await this.fetchStats();
  },
  methods: {
    async fetchStats() {
      this.loading = true;
      try {
        // (★★★ 关键 ★★★)
        // 呼叫受保护的 API。
        // request.js 会自动附加 Token。
        // 如果 Token 無效，request.js 拦截器会自动把我们踢回登入页。
        const data = await this.$api.getDashboardStats();
        this.stats = data;
      } catch (error) {
        // (错误会被 request.js 拦截器处理)
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