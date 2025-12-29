<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">注单列表</h2>
    </div>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch" class="search-form">
        
        <el-form-item label="注单编号">
          <el-input v-model="searchParams.betId" placeholder="注单编号 (模糊)" clearable></el-input>
        </el-form-item>
        
        <el-form-item label="用户ID">
          <el-input v-model="searchParams.userId" placeholder="用户ID (模糊)" clearable></el-input>
        </el-form-item>

        <el-form-item label="注单状态">
          <el-select v-model="searchParams.status" placeholder="选择状态" clearable>
            <el-option label="处理中" value="pending" />
            <el-option label="等待补开" value="pending_tx" />
            <el-option label="中奖" value="won" />
            <el-option label="未中奖" value="lost" />
            <el-option label="失败" value="failed" />
          </el-select>
        </el-form-item>

        <el-form-item label="下注完成时间">
          <el-date-picker
            v-model="searchParams.dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            unlink-panels
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-table :data="tableData" style="width: 100%" :cell-style="{ paddingTop: '8px', paddingBottom: '8px' }">
        
        <el-table-column prop="id" label="注单编号" width="100" />
        <el-table-column prop="user_id" label="用户ID" width="120" />
        <el-table-column prop="game_type" label="游戏类型" width="120" />
        
        <el-table-column prop="choice" label="下注内容" width="100">
           <template #default="scope">{{ formatChoice(scope.row.choice) }}</template>
        </el-table-column>
        
        <el-table-column prop="amount" label="投注金额 (USDT)" width="150">
           <template #default="scope">{{ formatCurrency(scope.row.amount) }}</template>
        </el-table-column>
        
        <el-table-column label="中奖金额 (USDT)" width="150">
           <template #default="scope">{{ formatPrize(scope.row) }}</template>
        </el-table-column>

        <el-table-column prop="tx_hash" label="开奖 Hash" width="180">
          <template #default="scope">
            <a v-if="scope.row.tx_hash" :href="`https://sepolia.etherscan.io/tx/${scope.row.tx_hash}`" target="_blank" class="tx-link">
              {{ scope.row.tx_hash.substring(0, 10) }}...
            </a>
            <span v-else>-</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="bet_ip" label="投注IP" width="150">
          <template #default="scope">
            <span v-if="scope.row.bet_ip">{{ scope.row.bet_ip }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="bet_time" label="下注时间 (系统)" width="180">
           <template #default="scope">{{ formatDateTime(scope.row.bet_time) }}</template>
        </el-table-column>

        <el-table-column prop="settle_time" label="开奖时间 (系统)" width="180">
           <template #default="scope">{{ formatDateTime(scope.row.settle_time) }}</template>
        </el-table-column>

        <el-table-column prop="status" label="注单状态" width="120" fixed="right">
          <template #default="scope">
            <el-tag :type="getStatusTagType(scope.row.status)">
              {{ formatStatus(scope.row.status) }}
            </el-tag>
          </template>
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
// ( ... <script> 标签内的逻辑保持不变 ... )
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
  name: 'BetManagementView',
  data() {
    return {
      loading: false,
      tableData: [], 
      totalItems: 0, 
      pagination: {
        page: 1,
        limit: 10,
      },
      searchParams: {
        betId: '',
        userId: '',
        status: '',
        dateRange: createTodayRange(),
      },
    };
  },
  created() {
    this.handleSearch();
  },
  methods: {
    async fetchBets() {
      if (this.loading) return;
      this.loading = true;
      try {
        const isoRange = toIsoRange(this.searchParams.dateRange);
        const params = {
          ...this.pagination,
          betId: this.searchParams.betId || undefined,
          userId: this.searchParams.userId || undefined, 
          status: this.searchParams.status || undefined,
          dateRange: isoRange ? JSON.stringify(isoRange) : undefined,
        };
        const response = await this.$api.getBets(params);
        this.tableData = response.list;
        this.totalItems = response.total;
      } catch (error) {
        console.error('Failed to fetch bets:', error);
      } finally {
        this.loading = false;
      }
    },
    
    handleSearch() { this.pagination.page = 1; this.fetchBets(); },
    handleSizeChange(newLimit) { this.pagination.limit = newLimit; this.pagination.page = 1; this.fetchBets(); },
    handlePageChange(newPage) { this.pagination.page = newPage; this.fetchBets(); },

    formatDateTime(isoString) {
      if (!isoString) return ''; 
      try { return new Date(isoString).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }); } 
      catch (e) { return isoString; }
    },
    
    formatStatus(status) {
      const map = {
        'pending': '处理中', 
        'pending_tx': '等待补开', 
        'won': '中奖', 
        'lost': '未中奖',
        'failed': '失败',
      };
      return map[status] || status;
    },
    
    getStatusTagType(status) {
      const map = {
        'pending': 'info', 
        'pending_tx': 'warning', 
        'won': 'success', 
        'lost': 'danger',
        'failed': 'danger',
      };
      return map[status] || 'default';
    },

    formatChoice(choice) {
      if (choice === 'head') return '正面';
      if (choice === 'tail') return '反面';
      return choice;
    },
    
    formatCurrency(value) {
      if (value === null || value === undefined) return '';
      if (parseFloat(value) === 0) return '-';
      try {
        const num = parseFloat(value);
        if (isNaN(num)) return 'N/A';
        return num.toFixed(2);
      } catch (e) {
        return 'N/A';
      }
    },
    
    formatPrize(row) {
      if (row.status === 'won') {
        try {
            const betAmount = parseFloat(row.amount);
            // 使用 parseFloat 而不是 parseInt，以支持小数赔率（如 1.95）
            const multiplier = parseFloat(row.payout_multiplier) || 2; 
            const prizeAmount = betAmount * multiplier; 
            return this.formatCurrency(prizeAmount);
        } catch(e) {
            return '计算错误';
        }
      }
      return '-';
    },
  },
};
</script>

<style scoped>
.tx-link {
  color: #237804;
  text-decoration: none;
  transition: all 0.2s ease;
}

.tx-link:hover {
  color: #135200;
  text-decoration: underline;
}

.text-muted {
  color: var(--text-tertiary);
  font-style: italic;
}

/* 搜索表单输入框宽度 */
.search-form :deep(.el-input) {
  width: 180px;
}

.search-form :deep(.el-select) {
  width: 180px;
}

.search-form :deep(.el-date-picker) {
  width: 240px;
}

/* 分页容器 */
.pagination-container {
  margin-top: var(--spacing-md);
  display: flex;
  justify-content: flex-end;
}
</style>