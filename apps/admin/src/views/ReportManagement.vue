<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">盈虧报表</h2>
    </div>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch" class="search-form">
        <el-form-item label="用户ID/钱包地址">
          <el-input 
            v-model="searchParams.userQuery" 
            placeholder="输入 'system' 查全平台" 
            clearable
          ></el-input>
          <div class="form-tip">
            (模糊搜寻。若查询用户名为 system，则查询计算全平台)
          </div>
        </el-form-item>
        <el-form-item label="时间">
          <el-date-picker
            v-model="searchParams.dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            :clearable="false"
            unlink-panels
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch" :loading="loading">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="result-card" v-loading="loading">
      <template #header>
        <div>查询结果</div>
      </template>
      
      <div v-if="reportData" class="report-grid">
        <div class="report-item"> 
          <div class="report-label">投注 (总额)</div>
          <div class="report-value">{{ formatCurrency(reportData.total_bet) }} USDT</div>
        </div>
        
        <div class="report-item"> 
          <div class="report-label">派奖 (总额)</div>
           <div class="report-value">{{ formatCurrency(reportData.total_payout) }} USDT</div>
        </div>
        <div class="report-item info">
          <div class="report-label">用户等级奖金</div>
           <div class="report-value">{{ formatCurrency(reportData.bonus_level) }} USDT</div>
        </div>
        <div class="report-item info">
          <div class="report-label">活动奖金</div>
           <div class="report-value">{{ formatCurrency(reportData.bonus_event) }} USDT</div>
        </div>
        <div class="report-item info">
          <div class="report-label">反佣</div>
           <div class="report-value">{{ formatCurrency(reportData.bonus_commission) }} USDT</div>
        </div>
        
        <div class="report-item gas-fee">
          <div class="report-label">总手续费 (Gas)</div>
           <div class="report-value">{{ formatCurrency(reportData.total_gas_fee) }} USDT</div>
        </div>

        <div :class="['report-item', reportData.platform_profit >= 0 ? 'profit' : 'loss']"> 
          <div class="report-label">
            <span>平台盈虧</span>
            <el-tooltip
              effect="dark"
              content="公式：投注总额 - 派奖总额"
              placement="top"
            >
              <el-icon><InfoFilled /></el-icon>
            </el-tooltip>
          </div>
           <div class="report-value">{{ formatCurrency(reportData.platform_profit) }} USDT</div>
        </div>
        
        <div :class="['report-item', 'net-profit', reportData.platform_net_profit >= 0 ? 'profit' : 'loss']"> 
          <div class="report-label">
            <span>平台 *净* 营利</span>
            <el-tooltip
              effect="dark"
              content="公式：投注 - 派奖 - 奖金 - 手续费"
              placement="top"
            >
              <el-icon><InfoFilled /></el-icon>
            </el-tooltip>
          </div>
           <div class="report-value">{{ formatCurrency(reportData.platform_net_profit) }} USDT</div>
        </div>
      </div>
      
      <el-empty v-else description="请选择时间范围并点击查询" />

    </el-card>
  </div>
</template>

<script>
// ( ... <script> 标签内的逻辑保持不变 ... )
import { ElMessage } from 'element-plus';
import { InfoFilled } from '@element-plus/icons-vue';

const createTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return [start, end];
};

const toIsoRange = (range) => {
  if (!Array.isArray(range) || range.length !== 2) return null;
  const [start, end] = range;
  const startIso = start instanceof Date && !isNaN(start) ? start.toISOString() : null;
  const endIso = end instanceof Date && !isNaN(end) ? end.toISOString() : null;
  if (!startIso || !endIso) return null;
  return [startIso, endIso];
};

export default {
  name: 'ReportManagementView',
  components: {
    InfoFilled
  },
  data() {
    return {
      loading: false,
      searchParams: {
        dateRange: createTodayRange(),
        userQuery: 'system', 
      },
      reportData: null, 
    };
  },
  created() {
    this.handleSearch();
  },
  methods: {
    async handleSearch() {
      if (!this.searchParams.dateRange) {
        ElMessage.error('请选择时间范围');
        return;
      }
      if (!this.searchParams.userQuery) {
        ElMessage.error('请指定查询对象 (输入用户ID/钱包地址，或输入 system 查询全平台)');
        return;
      }
      this.loading = true;
      this.reportData = null; 

      try {
        const isoRange = toIsoRange(this.searchParams.dateRange);
        if (!isoRange) {
          ElMessage.error('时间范围选择无效，请重新选择');
          this.loading = false;
          return;
        }
        const params = {
          dateRange: JSON.stringify(isoRange),
          userQuery: this.searchParams.userQuery.trim(),
        };

        const response = await this.$api.getProfitLossReport(params);
        // (★★★ 修復：後端使用標準響應格式 { success: true, data: {...} } ★★★)
        if (response && response.success && response.data) {
          this.reportData = response.data;
        } else {
          // 向後兼容：如果沒有標準格式，直接使用 response
          this.reportData = response;
        }

      } catch (error) {
        console.error('Failed to fetch profit-loss report:', error);
      } finally {
        this.loading = false;
      }
    },
    
    formatCurrency(value) {
      if (value === null || value === undefined) return '0.00';
      if (typeof value !== 'number') {
        try {
           value = parseFloat(value);
           if (isNaN(value)) return '0.00';
        } catch(e) {
           return '0.00';
        }
      }
      // (★★★ 修正：v7 应为 USDT，显示 2 位小数 ★★★)
      return value.toFixed(2); 
    }
  },
};
</script>

<style scoped>
.form-tip {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 5px;
  line-height: 1.5;
}

.report-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
}

.report-item {
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  text-align: center;
  background: var(--bg-secondary);
  transition: all 0.3s ease;
  box-shadow: var(--shadow-sm);
}

.report-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-base);
  border-color: var(--border-base);
}

.report-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: var(--spacing-sm);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.report-label .el-icon {
  cursor: help;
  color: var(--text-tertiary);
  transition: color 0.2s ease;
}

.report-label .el-icon:hover {
  color: #237804;
}

.report-value {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
}

/* 颜色 */
.report-item .report-value {
  color: var(--text-primary);
}

.report-item.info .report-value {
  color: var(--text-tertiary);
}

.report-item.gas-fee .report-value {
  color: var(--color-warning);
}

/* 盈虧颜色 */
.report-item.profit .report-value {
  color: var(--color-success);
}

.report-item.loss .report-value {
  color: var(--color-danger);
}

/* 净营利醒目提示 - 深绿色系 */
.report-item.net-profit {
  border-width: 2px;
  border-color: #237804;
  background: linear-gradient(135deg, #f6ffed 0%, #f0f9eb 100%);
  color: #135200;
}

.report-item.net-profit .report-label {
  color: #135200;
  font-weight: 600;
}

.report-item.net-profit .report-value {
  color: #135200;
  font-weight: 700;
}

.report-item.net-profit.loss {
  border-color: var(--color-danger);
  background: linear-gradient(135deg, #fef0f0 0%, #fde2e2 100%);
}

.report-item.net-profit.profit {
  border-color: var(--color-success);
  background: linear-gradient(135deg, #f0f9eb 0%, #e1f3d8 100%);
}

/* 搜索表单输入框宽度 */
.search-form :deep(.el-input) {
  width: 240px;
}

.search-form :deep(.el-date-picker) {
  width: 300px;
}
</style>