<template>
  <div class="deposit-history-container">
    <h2>充值記錄</h2>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch" class="search-form">
        <el-form-item label="用戶名"><el-input v-model="searchParams.username" placeholder="用戶名 (模糊)" clearable></el-input></el-form-item>
        <el-form-item label="TX Hash"><el-input v-model="searchParams.tx_hash" placeholder="Hash (精确)" clearable></el-input></el-form-item>
        <el-form-item label="充值狀態">
          <el-select v-model="searchParams.status" placeholder="选择状态" clearable>
            <el-option label="已完成" value="completed" />
            <el-option label="待處理" value="pending" />
            <el-option label="失敗" value="failed" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查詢</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-table :data="tableData" style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用戶名" width="130" />
         <el-table-column prop="user_id" label="用戶ID" width="130" />
        <el-table-column prop="chain" label="區塊鏈" width="100" />
        
        <el-table-column prop="amount" label="充值金額" width="120" sortable>
           <template #default="scope">{{ formatCurrency(scope.row.amount) }}</template>
        </el-table-column>
        
        <el-table-column prop="created_at" label="到帳時間" width="170">
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

        <el-table-column prop="status" label="狀態" width="100" fixed="right">
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
export default {
  name: 'DepositHistory',
  data() {
    return {
      loading: false,
      tableData: [], 
      totalItems: 0, 
      pagination: { page: 1, limit: 10 },
      searchParams: {
        username: '', status: '', tx_hash: ''
      },
    };
  },
  created() {
    this.fetchData();
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
        };
        // (★★★ v8.1 調用新 API ★★★)
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

    // --- (格式化輔助函數) ---
    formatDateTime(isoString) {
      if (!isoString) return ''; 
      try { return new Date(isoString).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }); } 
      catch (e) { return isoString; }
    },
    formatStatus(status) {
      // (目前 TronListener 只會寫入 completed)
      const map = { 'pending': '待處理', 'completed': '已完成', 'failed': '失敗' };
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
.search-form :deep(.el-select) { width: 180px; }
</style>