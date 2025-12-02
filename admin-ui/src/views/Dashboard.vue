<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <h2>儀表板</h2>
      <el-button type="primary" :icon="Refresh" circle @click="refreshAll" :loading="loading || walletLoading"></el-button>
    </div>

    <!-- 核心數據統計卡片 -->
    <el-row :gutter="20" class="mb-20">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card stat-card-users" shadow="hover">
          <div class="stat-card-content">
            <div class="stat-icon">
              <el-icon :size="32"><User /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">總用戶數</div>
              <div class="stat-value">{{ stats?.totalUsers || 0 }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card stat-card-bets" shadow="hover">
          <div class="stat-card-content">
            <div class="stat-icon">
              <el-icon :size="32"><Coin /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">總投注數</div>
              <div class="stat-value">{{ stats?.totalBets || 0 }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card stat-card-online" shadow="hover">
          <div class="stat-card-content">
            <div class="stat-icon">
              <el-icon :size="32"><Connection /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">即時線上人數</div>
              <div class="stat-value online">{{ stats?.onlineUsers || 0 }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card stat-card-pending" shadow="hover">
          <div class="stat-card-content">
            <div class="stat-icon">
              <el-icon :size="32"><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-label">異常訂單</div>
              <div class="stat-value">{{ stats?.pendingPayouts || 0 }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 投注趨勢圖和統計數據 -->
    <el-row :gutter="20" class="mb-20">
      <!-- 折線圖 -->
      <el-col :xs="24" :lg="16">
        <el-card class="chart-card" shadow="hover" v-loading="loading">
          <template #header>
            <div class="card-header">
              <span class="card-title">FlipCoin 遊戲數據趨勢</span>
              <el-radio-group v-model="chartPeriod" size="small">
                <el-radio-button label="today">當日</el-radio-button>
                <el-radio-button label="week">當周</el-radio-button>
                <el-radio-button label="month">當月</el-radio-button>
                <el-radio-button label="lastMonth">上月</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="chartContainer" class="chart-container"></div>
        </el-card>
      </el-col>

      <!-- 統計數據卡片 -->
      <el-col :xs="24" :lg="8">
        <el-card class="stats-card" shadow="hover" v-loading="loading">
          <template #header>
            <div class="card-header">
              <span class="card-title">統計數據</span>
            </div>
          </template>
          <div v-if="stats" class="stats-detail">
            <div class="stat-detail-item">
              <div class="detail-label">
                <el-icon><Document /></el-icon>
                <span>投注量</span>
              </div>
              <div class="detail-value">{{ getCurrentPeriodData().betCount }} 筆</div>
            </div>
            <div class="stat-detail-item">
              <div class="detail-label">
                <el-icon><Money /></el-icon>
                <span>投注金額</span>
              </div>
              <div class="detail-value">{{ formatNumber(getCurrentPeriodData().totalBetAmount) }} USDT</div>
            </div>
            <div class="stat-detail-item">
              <div class="detail-label">
                <el-icon><CreditCard /></el-icon>
                <span>派獎金額</span>
              </div>
              <div class="detail-value">{{ formatNumber(getCurrentPeriodData().totalPayout) }} USDT</div>
            </div>
            <div class="stat-detail-item highlight">
              <div class="detail-label">
                <el-icon><TrendCharts /></el-icon>
                <span>盈虧</span>
              </div>
              <div class="detail-value" :class="getCurrentPeriodData().profitLoss >= 0 ? 'profit' : 'loss'">
                {{ formatNumber(getCurrentPeriodData().profitLoss) }} USDT
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 錢包監控 -->
    <el-card class="wallet-card" shadow="hover" v-loading="walletLoading">
      <template #header>
        <div class="card-header">
          <span class="card-title">錢包監控</span>
          <el-button type="primary" size="small" :icon="Refresh" @click="refreshWallets">刷新</el-button>
        </div>
      </template>
      <div v-if="walletMonitoring" class="wallet-grid">
        <!-- 自動出款類型 -->
        <div v-if="walletMonitoring.payout && walletMonitoring.payout.length > 0" class="wallet-group">
          <div class="wallet-group-header">
            <el-icon><CreditCard /></el-icon>
            <span>自動出款</span>
          </div>
          <div class="wallet-list">
            <div v-for="wallet in walletMonitoring.payout" :key="wallet.id" class="wallet-item">
              <div class="wallet-name">{{ wallet.name }}</div>
              <div class="wallet-address">{{ maskAddress(wallet.address) }}</div>
              <div class="wallet-balances">
                <div class="balance-item">
                  <span class="balance-label">TRX</span>
                  <span class="balance-value">{{ formatBalance(wallet.trxBalance) }}</span>
                </div>
                <div class="balance-item">
                  <span class="balance-label">USDT</span>
                  <span class="balance-value">{{ formatBalance(wallet.usdtBalance) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 歸集類型 -->
        <div v-if="walletMonitoring.collection && walletMonitoring.collection.length > 0" class="wallet-group">
          <div class="wallet-group-header">
            <el-icon><Box /></el-icon>
            <span>歸集</span>
          </div>
          <div class="wallet-list">
            <div v-for="wallet in walletMonitoring.collection" :key="wallet.id" class="wallet-item">
              <div class="wallet-name">{{ wallet.name }}</div>
              <div class="wallet-address">{{ maskAddress(wallet.address) }}</div>
              <div class="wallet-balances">
                <div class="balance-item">
                  <span class="balance-label">TRX</span>
                  <span class="balance-value">{{ formatBalance(wallet.trxBalance) }}</span>
                </div>
                <div class="balance-item">
                  <span class="balance-label">USDT</span>
                  <span class="balance-value">{{ formatBalance(wallet.usdtBalance) }}</span>
                </div>
                <div class="balance-item">
                  <span class="balance-label">能量</span>
                  <span class="balance-value">{{ formatBalance(wallet.energy, 0) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Gas 儲備類型 -->
        <div v-if="walletMonitoring.gasReserve && walletMonitoring.gasReserve.length > 0" class="wallet-group">
          <div class="wallet-group-header">
            <el-icon><Lightning /></el-icon>
            <span>Gas 儲備</span>
          </div>
          <div class="wallet-list">
            <div v-for="wallet in walletMonitoring.gasReserve" :key="wallet.id" class="wallet-item">
              <div class="wallet-name">{{ wallet.name }}</div>
              <div class="wallet-address">{{ maskAddress(wallet.address) }}</div>
              <div class="wallet-balances">
                <div class="balance-item">
                  <span class="balance-label">TRX</span>
                  <span class="balance-value">{{ formatBalance(wallet.trxBalance) }}</span>
                </div>
                <div class="balance-item">
                  <span class="balance-label">USDT</span>
                  <span class="balance-value">{{ formatBalance(wallet.usdtBalance) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!walletMonitoring.payout?.length && !walletMonitoring.collection?.length && !walletMonitoring.gasReserve?.length" class="empty-state">
          <el-empty description="暫無錢包數據"></el-empty>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script>
import * as echarts from 'echarts';
import { 
  Refresh, 
  User, 
  Coin, 
  Link as Connection, 
  WarningFilled as Warning, 
  Document, 
  Money, 
  Wallet as CreditCard, 
  DataLine as TrendCharts, 
  Box, 
  Lightning 
} from '@element-plus/icons-vue';

export default {
  name: 'DashboardView',
  components: {
    Refresh,
    User,
    Coin,
    Connection,
    Warning,
    Document,
    Money,
    CreditCard,
    TrendCharts,
    Box,
    Lightning,
  },
  data() {
    return {
      loading: true,
      walletLoading: false,
      stats: null,
      walletMonitoring: null,
      chartPeriod: 'today',
      chartInstance: null,
    };
  },
  watch: {
    chartPeriod() {
      this.updateChart();
    },
    stats: {
      handler() {
        this.$nextTick(() => {
          this.updateChart();
        });
      },
      deep: true,
    },
  },
  async created() {
    await Promise.all([
      this.fetchStats(),
      this.fetchWalletMonitoring()
    ]);
  },
  mounted() {
    this.initChart();
  },
  beforeUnmount() {
    if (this.chartInstance) {
      this.chartInstance.dispose();
    }
  },
  methods: {
    async fetchStats() {
      this.loading = true;
      try {
        const data = await this.$api.getDashboardStats();
        this.stats = data;
      } catch (error) {
        console.error('Failed to fetch stats:', error);
        this.$message.error('獲取統計數據失敗');
      } finally {
        this.loading = false;
      }
    },
    async fetchWalletMonitoring() {
      this.walletLoading = true;
      try {
        const data = await this.$api.getWalletMonitoring();
        this.walletMonitoring = data;
      } catch (error) {
        console.error('Failed to fetch wallet monitoring:', error);
        this.$message.error('獲取錢包監控數據失敗');
      } finally {
        this.walletLoading = false;
      }
    },
    async refreshWallets() {
      await this.fetchWalletMonitoring();
      this.$message.success('錢包數據已刷新');
    },
    async refreshAll() {
      await Promise.all([
        this.fetchStats(),
        this.fetchWalletMonitoring()
      ]);
      this.$message.success('數據已刷新');
    },
    initChart() {
      if (!this.$refs.chartContainer) return;
      this.chartInstance = echarts.init(this.$refs.chartContainer);
      this.updateChart();
      window.addEventListener('resize', this.handleResize);
    },
    handleResize() {
      if (this.chartInstance) {
        this.chartInstance.resize();
      }
    },
    updateChart() {
      if (!this.chartInstance || !this.stats) return;

      const periodData = [
        { name: '當日', data: this.stats.today },
        { name: '當周', data: this.stats.week },
        { name: '當月', data: this.stats.month },
        { name: '上月', data: this.stats.lastMonth },
      ];

      const currentIndex = ['today', 'week', 'month', 'lastMonth'].indexOf(this.chartPeriod);
      const selectedData = periodData[currentIndex];

      const option = {
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'cross',
          },
          formatter: (params) => {
            let result = `<div style="margin-bottom: 4px; font-weight: bold;">${params[0].axisValue}</div>`;
            params.forEach(param => {
              const value = param.value >= 0 ? param.value : -param.value;
              const sign = param.value >= 0 ? '' : '-';
              result += `<div style="margin: 2px 0;">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${param.color}; margin-right: 5px;"></span>
                ${param.seriesName}: ${sign}${this.formatNumber(value)} USDT
              </div>`;
            });
            return result;
          },
        },
        legend: {
          data: ['投注金額', '派獎金額', '盈虧'],
          top: 10,
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          top: '15%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: periodData.map(item => item.name),
        },
        yAxis: {
          type: 'value',
          axisLabel: {
            formatter: (value) => {
              if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
              if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
              return value.toFixed(0);
            },
          },
        },
        series: [
          {
            name: '投注金額',
            type: 'line',
            smooth: true,
            data: periodData.map(item => item.data.totalBetAmount),
            itemStyle: { color: '#409EFF' },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
                { offset: 1, color: 'rgba(64, 158, 255, 0.1)' },
              ]),
            },
          },
          {
            name: '派獎金額',
            type: 'line',
            smooth: true,
            data: periodData.map(item => item.data.totalPayout),
            itemStyle: { color: '#67C23A' },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(103, 194, 58, 0.3)' },
                { offset: 1, color: 'rgba(103, 194, 58, 0.1)' },
              ]),
            },
          },
          {
            name: '盈虧',
            type: 'line',
            smooth: true,
            data: periodData.map(item => item.data.profitLoss),
            itemStyle: { color: '#E6A23C' },
            markLine: {
              data: [{ yAxis: 0, lineStyle: { color: '#909399', type: 'dashed' } }],
            },
          },
        ],
      };

      this.chartInstance.setOption(option);
    },
    getCurrentPeriodData() {
      if (!this.stats) return { betCount: 0, totalBetAmount: 0, totalPayout: 0, profitLoss: 0 };
      return this.stats[this.chartPeriod] || { betCount: 0, totalBetAmount: 0, totalPayout: 0, profitLoss: 0 };
    },
    formatNumber(num) {
      if (num === null || num === undefined) return '0.00';
      return parseFloat(num).toLocaleString('zh-TW', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    },
    formatBalance(balance, decimals = 6) {
      if (!balance || balance === '0' || balance === 0) return '0';
      const num = parseFloat(balance);
      return num.toLocaleString('zh-TW', {
        minimumFractionDigits: 2,
        maximumFractionDigits: decimals === 0 ? 0 : 6
      });
    },
    maskAddress(address) {
      if (!address) return '';
      if (address.length <= 10) return address;
      return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    },
  },
};
</script>

<style scoped>
.dashboard {
  padding: 24px;
  background: #f5f7fa;
  min-height: calc(100vh - 60px);
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.dashboard-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.mb-20 {
  margin-bottom: 20px;
}

/* 核心數據統計卡片 */
.stat-card {
  border-radius: 12px;
  border: none;
  transition: all 0.3s ease;
  overflow: hidden;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12) !important;
}

.stat-card-content {
  display: flex;
  align-items: center;
  padding: 8px 0;
}

.stat-icon {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  flex-shrink: 0;
}

.stat-card-users .stat-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.stat-card-bets .stat-icon {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.stat-card-online .stat-icon {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

.stat-card-pending .stat-icon {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: white;
}

.stat-info {
  flex: 1;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
  font-weight: 500;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
}

.stat-value.online {
  color: #67c23a;
}

/* 圖表卡片 */
.chart-card,
.stats-card {
  border-radius: 12px;
  border: none;
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.chart-container {
  width: 100%;
  height: 400px;
}

.stats-detail {
  padding: 8px 0;
}

.stat-detail-item {
  padding: 16px 0;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-detail-item:last-child {
  border-bottom: none;
}

.stat-detail-item.highlight {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  margin: 0 -20px;
  padding: 20px;
  border-radius: 8px;
  border: none;
}

.detail-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

.detail-value {
  font-size: 18px;
  font-weight: 700;
  color: #303133;
}

.detail-value.profit {
  color: #67c23a;
}

.detail-value.loss {
  color: #f56c6c;
}

/* 錢包監控 */
.wallet-card {
  border-radius: 12px;
  border: none;
}

.wallet-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
}

.wallet-group {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #ebeef5;
}

.wallet-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #ebeef5;
}

.wallet-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wallet-item {
  background: white;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #ebeef5;
  transition: all 0.2s ease;
}

.wallet-item:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border-color: #409eff;
}

.wallet-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.wallet-address {
  font-size: 12px;
  color: #909399;
  font-family: 'Monaco', 'Menlo', monospace;
  margin-bottom: 12px;
  word-break: break-all;
}

.wallet-balances {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.balance-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.balance-label {
  font-size: 12px;
  color: #909399;
  font-weight: 500;
}

.balance-value {
  font-size: 16px;
  font-weight: 700;
  color: #303133;
}

.empty-state {
  grid-column: 1 / -1;
  padding: 40px;
  text-align: center;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .dashboard {
    padding: 16px;
  }

  .wallet-grid {
    grid-template-columns: 1fr;
  }

  .chart-container {
    height: 300px;
  }
}
</style>