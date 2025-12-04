<template>
  <div class="page-container balance-changes-container">
    <h2>账变记录</h2>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch" class="search-form">
        <el-form-item label="用户名">
          <el-input v-model="searchParams.username" placeholder="用户名 (模糊)" clearable></el-input>
        </el-form-item>
        <el-form-item label="用户ID">
          <el-input v-model="searchParams.user_id" placeholder="精确用户ID" clearable></el-input>
        </el-form-item>
        <el-form-item label="账变类型">
          <el-select v-model="searchParams.change_type" placeholder="选择类型" clearable style="width: 180px;">
            <el-option label="充值" value="deposit" />
            <el-option label="提款" value="withdrawal" />
            <el-option label="下注" value="bet" />
            <el-option label="派奖" value="payout" />
            <el-option label="人工调整" value="manual_adjust" />
            <el-option label="活动奖金" value="activity_bonus" />
          </el-select>
        </el-form-item>
        <el-form-item label="时间区间">
          <el-date-picker
            v-model="searchParams.dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            unlink-panels
            clearable
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-table :data="tableData" style="width: 100%">
        <el-table-column prop="id" label="账变ID" width="100" />
        <el-table-column prop="user_id" label="用户ID" width="120" />
        <el-table-column prop="username" label="用户名" width="130" />
        
        <el-table-column prop="change_type" label="账变类型" width="120">
          <template #default="scope">
            <el-tag :type="getChangeTypeTagType(scope.row.change_type)">
              {{ formatChangeType(scope.row.change_type) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="amount" label="账变金额" width="140">
          <template #default="scope">
            <span :class="getAmountClass(scope.row.amount)">
              {{ formatAmount(scope.row.amount) }}
            </span>
          </template>
        </el-table-column>
        
        <el-table-column prop="balance_after" label="账变后余额" width="140" sortable>
          <template #default="scope">{{ formatCurrency(scope.row.balance_after) }}</template>
        </el-table-column>
        
        <el-table-column prop="remark" label="备注" min-width="200">
          <template #default="scope">
            <span v-if="scope.row.remark">{{ scope.row.remark }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="created_at" label="时间" width="170" fixed="right">
          <template #default="scope">{{ formatDateTime(scope.row.created_at) }}</template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pagination-container"
        layout="total, sizes, prev, pager, next, jumper"
        :total="totalItems"
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.limit"
        :page-sizes="[10, 20, 50, 100]"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </el-card>
  </div>
</template>

<script>
const createTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return [start, end];
};

export default {
  name: 'BalanceChanges',
  data() {
    return {
      loading: false,
      tableData: [],
      totalItems: 0,
      pagination: { page: 1, limit: 10 },
      searchParams: {
        username: '',
        user_id: '',
        change_type: '',
        dateRange: createTodayRange(),
      },
    };
  },
  created() {
    this.handleSearch();
  },
  methods: {
    async fetchData() {
      if (this.loading) return;
      this.loading = true;
      try {
        const params = {
          ...this.pagination,
          username: this.searchParams.username || undefined,
          user_id: this.searchParams.user_id || undefined,
          change_type: this.searchParams.change_type || undefined,
        };

        if (this.searchParams.dateRange && this.searchParams.dateRange.length === 2) {
          const [start, end] = this.searchParams.dateRange;
          if (start instanceof Date && !isNaN(start)) {
            params.start_time = start.toISOString();
          }
          if (end instanceof Date && !isNaN(end)) {
            params.end_time = end.toISOString();
          }
        }

        const response = await this.$api.getBalanceChanges(params);
        this.tableData = response.list;
        this.totalItems = response.total;
      } catch (error) {
        console.error('Failed to fetch balance changes:', error);
        this.$message.error('获取账变记录失败');
      } finally {
        this.loading = false;
      }
    },
    
    handleSearch() {
      this.pagination.page = 1;
      this.fetchData();
    },
    
    handleSizeChange(newLimit) {
      this.pagination.limit = newLimit;
      this.pagination.page = 1;
      this.fetchData();
    },
    
    handlePageChange(newPage) {
      this.pagination.page = newPage;
      this.fetchData();
    },

    // --- 格式化辅助函数 ---
    formatDateTime(isoString) {
      if (!isoString) return '';
      try {
        return new Date(isoString).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
      } catch (e) {
        return isoString;
      }
    },
    
    formatChangeType(changeType) {
      const map = {
        'deposit': '充值',
        'withdrawal': '提款',
        'bet': '下注',
        'payout': '派奖',
        'manual_adjust': '人工调整',
        'activity_bonus': '活动奖金',
      };
      return map[changeType] || changeType;
    },
    
    getChangeTypeTagType(changeType) {
      const map = {
        'deposit': 'success',
        'withdrawal': 'warning',
        'bet': 'info',
        'payout': 'success',
        'manual_adjust': 'danger',
        'activity_bonus': 'success',
      };
      return map[changeType] || '';
    },
    
    formatAmount(amount) {
      if (amount === null || amount === undefined) return '0.00';
      const num = parseFloat(amount);
      if (isNaN(num)) return 'N/A';
      const sign = num >= 0 ? '+' : '';
      return `${sign}${num.toFixed(2)}`;
    },
    
    getAmountClass(amount) {
      const num = parseFloat(amount);
      if (isNaN(num)) return '';
      return num >= 0 ? 'amount-positive' : 'amount-negative';
    },
    
    formatCurrency(value) {
      if (value === null || value === undefined) return '0.00';
      const num = parseFloat(value);
      if (isNaN(num)) return 'N/A';
      return num.toFixed(2);
    },
  },
};
</script>

<style scoped>
.search-card {
  margin-bottom: 20px;
}

.table-card {
  margin-bottom: 20px;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.el-form-item {
  margin-bottom: 10px;
}

.amount-positive {
  color: #237804;
  font-weight: 600;
}

.amount-negative {
  color: #cf1322;
  font-weight: 600;
}

.text-muted {
  color: #999;
  font-style: italic;
}

.search-form :deep(.el-input) {
  width: 180px;
}

.search-form :deep(.el-select) {
  width: 180px;
}

.search-form :deep(.el-date-editor) {
  width: 300px;
}
</style>

