<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <div class="header-title-group">
        <h2>儀表板</h2>
        <el-button type="primary" circle @click="refreshAll" :loading="loading || walletLoading" size="small" class="refresh-btn">
          <el-icon v-if="!loading && !walletLoading"><Refresh /></el-icon>
        </el-button>
      </div>
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

      // 獲取當前時期的數據
      const currentData = this.stats[this.chartPeriod];
      if (!currentData || !currentData.timeSeries) {
        // 如果數據格式還是舊的，使用舊的顯示方式
        const periodData = [
          { name: '當日', data: this.stats.today },
          { name: '當周', data: this.stats.week },
          { name: '當月', data: this.stats.month },
          { name: '上月', data: this.stats.lastMonth },
        ];
        const selectedData = periodData[['today', 'week', 'month', 'lastMonth'].indexOf(this.chartPeriod)];
        // 舊格式的處理（向後兼容）
        return;
      }

      // 獲取時間序列數據
      const labels = currentData.timeSeries.labels || [];
      const betAmountData = currentData.timeSeries.betAmount || [];
      const payoutData = currentData.timeSeries.payout || [];
      const profitLossData = currentData.timeSeries.profitLoss || [];

      // 計算y軸範圍（讓y=0居中，上下分別為1,2或-1,-2）
      const allValues = [...betAmountData, ...payoutData, ...profitLossData];
      const maxValue = Math.max(...allValues, 0);
      const minValue = Math.min(...allValues, 0);
      
      // 如果無值或值很小，設置默認範圍
      let yAxisMax, yAxisMin;
      if (maxValue === 0 && minValue === 0) {
        // 無值時，y=0居中，上下分別1,2或-1,-2
        yAxisMax = 2;
        yAxisMin = -2;
      } else {
        // 有值時，計算合適的範圍，確保0居中
        const absMax = Math.max(Math.abs(maxValue), Math.abs(minValue));
        const padding = absMax * 0.1 || 1; // 10%的padding，至少1
        yAxisMax = Math.max(absMax + padding, 2);
        yAxisMin = -Math.max(absMax + padding, 2);
      }

      const option = {
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'cross',
          },
          formatter: (params) => {
            let result = `<div style="margin-bottom: 4px; font-weight: bold;">${params[0].axisValue}</div>`;
            params.forEach(param => {
              const value = Math.abs(param.value);
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
          data: labels,
          axisLine: {
            showArrow: false,
          },
          axisLabel: {
            rotate: labels.length > 20 ? 45 : 0, // 如果標籤太多，旋轉45度
            interval: Math.floor(labels.length / 12), // 顯示部分標籤避免擁擠
          },
        },
        yAxis: {
          type: 'value',
          min: yAxisMin,
          max: yAxisMax,
          axisLabel: {
            formatter: (value) => {
              if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
              if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
              return value.toFixed(0);
            },
          },
          axisLine: {
            showArrow: false,
          },
          splitLine: {
            lineStyle: {
              type: 'dashed',
            },
          },
        },
        series: [
          {
            name: '投注金額',
            type: 'line',
            smooth: true,
            data: betAmountData,
            itemStyle: { color: '#237804' },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(35, 120, 4, 0.3)' },
                { offset: 1, color: 'rgba(35, 120, 4, 0.1)' },
              ]),
            },
          },
          {
            name: '派獎金額',
            type: 'line',
            smooth: true,
            data: payoutData,
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
            data: profitLossData,
            itemStyle: { color: '#ff6b35' },
            markLine: {
              symbol: 'none',
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
  padding: var(--spacing-lg);
  background: var(--bg-primary);
  min-height: calc(100vh - 60px);
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dashboard-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.5px;
}

.refresh-btn {
  cursor: pointer;
}

.mb-20 {
  margin-bottom: var(--spacing-md);
}

/* 核心數據統計卡片 */
.stat-card {
  border-radius: var(--radius-lg);
  border: none;
  transition: all 0.3s ease;
  overflow: hidden;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-hover) !important;
}

.stat-card-content {
  display: flex;
  align-items: center;
  padding: 8px 0;
}

.stat-icon {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-base);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: var(--spacing-base);
  flex-shrink: 0;
}

.stat-card-users .stat-icon {
  background: linear-gradient(135deg, #237804 0%, #135200 100%);
  color: white;
}

.stat-card-bets .stat-icon {
  background: linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%);
  color: white;
}

.stat-card-online .stat-icon {
  background: linear-gradient(135deg, #237804 0%, #389e0d 100%);
  color: white;
}

.stat-card-pending .stat-icon {
  background: linear-gradient(135deg, #ff8c42 0%, #ffa500 100%);
  color: white;
}

.stat-info {
  flex: 1;
}

.stat-label {
  font-size: 14px;
  color: var(--text-tertiary);
  margin-bottom: var(--spacing-xs);
  font-weight: 500;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-value.online {
  color: #237804;
}

/* 圖表卡片 */
.chart-card,
.stats-card {
  border-radius: var(--radius-lg);
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
  color: var(--text-primary);
}

.chart-container {
  width: 100%;
  height: 400px;
}

.stats-detail {
  padding: 8px 0;
}

.stat-detail-item {
  padding: var(--spacing-base) 0;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-detail-item:last-child {
  border-bottom: none;
}

.stat-detail-item.highlight {
  background: linear-gradient(135deg, var(--bg-primary) 0%, #c3cfe2 100%);
  margin: 0 calc(-1 * var(--spacing-lg));
  padding: var(--spacing-lg);
  border-radius: var(--radius-base);
  border: none;
}

.detail-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

.detail-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.detail-value.profit {
  color: #237804;
}

.detail-value.loss {
  color: #f56c6c;
}

/* 錢包監控 */
.wallet-card {
  border-radius: var(--radius-lg);
  border: none;
}

.wallet-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--spacing-lg);
}

.wallet-group {
  background: var(--bg-tertiary);
  border-radius: var(--radius-base);
  padding: var(--spacing-base);
  border: 1px solid var(--border-light);
}

.wallet-group-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-base);
  padding-bottom: var(--spacing-sm);
  border-bottom: 2px solid var(--border-light);
}

.wallet-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wallet-item {
  background: var(--bg-secondary);
  border-radius: var(--radius-base);
  padding: var(--spacing-base);
  border: 1px solid var(--border-light);
  transition: all 0.2s ease;
}

.wallet-item:hover {
  box-shadow: var(--shadow-base);
  border-color: #237804;
}

.wallet-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.wallet-address {
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: 'Monaco', 'Menlo', monospace;
  margin-bottom: var(--spacing-sm);
  word-break: break-all;
}

.wallet-balances {
  display: flex;
  gap: var(--spacing-base);
  flex-wrap: wrap;
}

.balance-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.balance-label {
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 500;
}

.balance-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.empty-state {
  grid-column: 1 / -1;
  padding: 40px;
  text-align: center;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .dashboard {
    padding: var(--spacing-base);
  }

  .wallet-grid {
    grid-template-columns: 1fr;
  }

  .chart-container {
    height: 300px;
  }
}
</style>