<template>
  <div class="deposit-history-container">
    <h2>充值记录</h2>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch" class="search-form">
        <el-form-item label="用户名"><el-input v-model="searchParams.username" placeholder="用户名 (模糊)" clearable></el-input></el-form-item>
        <el-form-item label="用户ID"><el-input v-model="searchParams.user_id" placeholder="精确用户ID" clearable></el-input></el-form-item>
        <el-form-item label="TX Hash"><el-input v-model="searchParams.tx_hash" placeholder="Hash (精确)" clearable></el-input></el-form-item>
        <el-form-item label="充值狀态">
          <el-select v-model="searchParams.status" placeholder="选择状态" clearable>
            <el-option label="已完成" value="completed" />
            <el-option label="待处理" value="pending" />
            <el-option label="失败" value="failed" />
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
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" width="130" />
         <el-table-column prop="user_id" label="用户ID" width="130" />
        <el-table-column prop="chain" label="区块链" width="100" />
        
        <el-table-column prop="amount" label="充值金额" width="120" sortable>
           <template #default="scope">{{ formatCurrency(scope.row.amount) }}</template>
        </el-table-column>
        
        <el-table-column prop="created_at" label="到帐时间" width="170">
           <template #default="scope">{{ formatDateTime(scope.row.created_at) }}</template>
        </el-table-column>
        
        <el-table-column prop="tx_hash" label="充值 Hash">
            <template #default="scope">
                <a v-if="scope.row.tx_hash" :href="getTxLink(scope.row.chain, scope.row.tx_hash)" target="_blank" class="tx-link">
                {{ scope.row.tx_hash }}
                </a>
                <span v-else>-</span>
            </template>
        </el-table-column>

        <el-table-column prop="status" label="狀态" width="100" fixed="right">
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
const createTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return [start, end];
};

export default {
  name: 'DepositHistory',
  data() {
    return {
      loading: false,
      tableData: [], 
      totalItems: 0, 
      pagination: { page: 1, limit: 10 },
      searchParams: {
        username: '',
        user_id: '',
        status: '',
        tx_hash: '',
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
          status: this.searchParams.status || undefined,
          tx_hash: this.searchParams.tx_hash || undefined,
          user_id: this.searchParams.user_id || undefined,
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
        // (★★★ v8.1 调用新 API ★★★)
        const response = await this.$api.getDeposits(params);
        this.tableData = response.list;
        this.totalItems = response.total;
      } catch (error) {
        console.error('Failed to fetch deposits:', error);
      } finally {
        this.loading = false;
      }
    },
    
    handleSearch() { this.pagination.page = 1; this.fetchData(); },
    handleSizeChange(newLimit) { this.pagination.limit = newLimit; this.pagination.page = 1; this.fetchData(); },
    handlePageChange(newPage) { this.pagination.page = newPage; this.fetchData(); },

    // --- (格式化辅助函数) ---
    formatDateTime(isoString) {
      if (!isoString) return ''; 
      try { return new Date(isoString).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }); } 
      catch (e) { return isoString; }
    },
    formatStatus(status) {
      // (目前 TronListener 只会寫入 completed)
      const map = { 'pending': '待处理', 'completed': '已完成', 'failed': '失败' };
      return map[status] || status;
    },
    getStatusTagType(status) {
      const map = { 'pending': 'warning', 'completed': 'success', 'failed': 'danger' };
      return map[status] || 'info';
    },
    formatCurrency(value) {
      if (value === null || value === undefined) return '0.00';
      const num = parseFloat(value);
      if (isNaN(num)) return 'N/A';
      return num.toFixed(2);
    },
    getTxLink(chain, hash) {
        if (chain === 'TRC20') return `https://nile.tronscan.org/#/transaction/${hash}`;
        if (chain === 'BSC') return `https://testnet.bscscan.com/tx/${hash}`;
        if (chain === 'ETH') return `https://sepolia.etherscan.io/tx/${hash}`;
        if (chain === 'POLYGON') return `https://mumbai.polygonscan.com/tx/${hash}`;
        if (chain === 'SOL') return `https://solscan.io/tx/${hash}?cluster=testnet`;
        return '#';
    }
  },
};
</script>

<style scoped>
.search-card { margin-bottom: 20px; }
.table-card { margin-bottom: 20px; }
.pagination-container { margin-top: 20px; display: flex; justify-content: flex-end; }
.el-form-item { margin-bottom: 10px; }
.tx-link { color: #409EFF; text-decoration: none; word-break: break-all; }
.tx-link:hover { text-decoration: underline; }
.search-form :deep(.el-input) { width: 180px; }
.search-form :deep(.el-select),
.search-form :deep(.el-date-editor) { width: 300px; }
</style>