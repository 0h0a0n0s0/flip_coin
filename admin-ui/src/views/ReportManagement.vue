<template>
  <div class="report-management-container">
    <h2>營運管理 (盈虧報表)</h2>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch">
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
            start-placeholder="開始時間"
            end-placeholder="結束時間"
            value-format="YYYY-MM-DDTHH:mm:ssZ"
            :clearable="false"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch" :loading="loading">查詢</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="result-card" v-loading="loading">
      <template #header>
        <div>查詢結果</div>
      </template>
      
      <div v-if="reportData" class="report-grid">
        <div class="report-item"> 
          <div class="report-label">投注 (總額)</div>
          <div class="report-value">{{ formatCurrency(reportData.total_bet) }} ETH</div>
        </div>
        <div class="report-item"> 
          <div class="report-label">派奖 (總額)</div>
          <div class="report-value">{{ formatCurrency(reportData.total_payout) }} ETH</div>
        </div>
        
        <div :class="['report-item', reportData.platform_profit >= 0 ? 'profit' : 'loss']"> 
          <div class="report-label">平台盈虧</div>
          <div class="report-value">{{ formatCurrency(reportData.platform_profit) }} ETH</div>
        </div>
        
        <div class="report-item info">
          <div class="report-label">活动奖金</div>
          <div class="report-value">{{ formatCurrency(reportData.bonus_event) }} ETH</div>
        </div>
        <div class="report-item info">
          <div class="report-label">用户等级奖金</div>
          <div class="report-value">{{ formatCurrency(reportData.bonus_level) }} ETH</div>
        </div>
        <div class="report-item info">
          <div class="report-label">反佣</div>
          <div class="report-value">{{ formatCurrency(reportData.bonus_commission) }} ETH</div>
        </div>
      </div>
      
      <el-empty v-else description="請選擇時間範圍並點擊查詢" />

    </el-card>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus';

export default {
  name: 'ReportManagementView',
  data() {
    return {
      loading: false,
      searchParams: {
        dateRange: null, 
        userQuery: 'system', 
      },
      reportData: null, 
    };
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
        const params = {
          dateRange: JSON.stringify(this.searchParams.dateRange),
          userQuery: this.searchParams.userQuery.trim(),
        };

        // (★★★ 錯誤修正：this.$api.getProfitLossReport 現在應該存在了 ★★★)
        const response = await this.$api.getProfitLossReport(params);
        this.reportData = response;

      } catch (error) {
        console.error('Failed to fetch profit-loss report:', error);
      } finally {
        this.loading = false;
      }
    },
    
    formatCurrency(value) {
      if (typeof value !== 'number') return '0.00';
      return value.toFixed(8); 
    }
  },
};
</script>

<style scoped>
/* (樣式不變) */
.search-card {
  margin-bottom: 20px;
}
.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}
.result-card {
  margin-bottom: 20px;
}
.report-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}
.report-item {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  background-color: #fafafa;
}
.report-label {
  font-size: 14px;
  color: #606266;
  margin-bottom: 12px;
}
.report-value {
  font-size: 24px;
  font-weight: bold;
}
/* 預設顏色 (用於 投注/派獎/獎金) */
.report-item .report-value { color: #303133; } /* Element Plus 預設黑色 */
.report-item.info .report-value { color: #909399; } /* 灰色，用於未來欄位 */

/* 平台盈虧顏色 */
.report-item.profit .report-value { color: #67c23a; } /* 綠色 (盈利) */
.report-item.loss .report-value { color: #f56c6c; } /* 紅色 (虧損) */
</style>