<template>
  <div class="withdrawal-review-container">
    <h2>提款審核</h2>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch" class="search-form">
        <el-form-item label="用戶名"><el-input v-model="searchParams.username" placeholder="用戶名 (模糊)" clearable></el-input></el-form-item>
        <el-form-item label="提款地址"><el-input v-model="searchParams.address" placeholder="地址 (精确)" clearable></el-input></el-form-item>
        <el-form-item label="TX Hash"><el-input v-model="searchParams.tx_hash" placeholder="Hash (精确)" clearable></el-input></el-form-item>
        <el-form-item label="提款狀態">
          <el-select v-model="searchParams.status" placeholder="选择状态" clearable>
            <el-option label="待審核" value="pending" />
            <el-option label="審核拒絕" value="rejected" />
            <el-option label="出款中" value="processing" />
            <el-option label="出款完成" value="completed" />
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
        <el-table-column prop="chain_type" label="區塊鏈" width="100" />
        <el-table-column prop="address" label="提款地址" />
        
        <el-table-column prop="amount" label="提款金額" width="120" sortable>
           <template #default="scope">{{ formatCurrency(scope.row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="total_profit_loss" label="累計盈虧" width="120" sortable>
           <template #default="scope">{{ formatCurrency(scope.row.total_profit_loss) }}</template>
        </el-table-column>
        <el-table-column prop="gas_fee" label="Gas 成本" width="100">
           <template #default="scope">{{ formatCurrency(scope.row.gas_fee, true) }}</template>
        </el-table-column>
        
        <el-table-column prop="request_time" label="發起時間" width="170">
           <template #default="scope">{{ formatDateTime(scope.row.request_time) }}</template>
        </el-table-column>
        <el-table-column prop="review_time" label="審核時間" width="170">
           <template #default="scope">{{ formatDateTime(scope.row.review_time) }}</template>
        </el-table-column>
        <el-table-column prop="reviewer_name" label="審核人" width="100" />
        
        <el-table-column prop="tx_hash" label="出款 Hash" width="120">
            <template #default="scope">
                <a v-if="scope.row.tx_hash" :href="getTxLink(scope.row.chain_type, scope.row.tx_hash)" target="_blank" class="tx-link">
                {{ scope.row.tx_hash.substring(0, 10) }}...
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

        <el-table-column label="操作" width="120" fixed="right">
          <template #default="scope">
            <div v-if="scope.row.status === 'pending'">
                <el-button type="success" link @click="handleApprove(scope.row)" v-if="$permissions.has('withdrawals', 'update')">批准</el-button>
                <el-button type="danger" link @click="handleReject(scope.row)" v-if="$permissions.has('withdrawals', 'update')">拒絕</el-button>
            </div>
            <div v-if="scope.row.status === 'processing'">
                <el-button type="primary" link @click="handleComplete(scope.row)" v-if="$permissions.has('withdrawals', 'update')">手動完成</el-button>
            </div>
            <div v-if="scope.row.status === 'rejected'">
                 <el-tooltip :content="scope.row.rejection_reason || '無理由'" placement="top"><el-icon><InfoFilled /></el-icon></el-tooltip>
            </div>
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
import { ElMessage, ElMessageBox } from 'element-plus';
import { InfoFilled } from '@element-plus/icons-vue';

export default {
  name: 'WithdrawalReview',
  components: { InfoFilled },
  data() {
    return {
      loading: false,
      tableData: [], 
      totalItems: 0, 
      pagination: { page: 1, limit: 10 },
      searchParams: {
        username: '', status: '', address: '', tx_hash: ''
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
          address: this.searchParams.address || undefined,
          tx_hash: this.searchParams.tx_hash || undefined,
        };
        const response = await this.$api.getWithdrawals(params);
        this.tableData = response.list;
        this.totalItems = response.total;
      } catch (error) {
        console.error('Failed to fetch withdrawals:', error);
      } finally {
        this.loading = false;
      }
    },
    
    handleSearch() { this.pagination.page = 1; this.fetchData(); },
    handleSizeChange(newLimit) { this.pagination.limit = newLimit; this.pagination.page = 1; this.fetchData(); },
    handlePageChange(newPage) { this.pagination.page = newPage; this.fetchData(); },

    // (批准)
    handleApprove(row) {
        ElMessageBox.confirm(`確定要批准用戶 [${row.username}] 的 ${row.amount} USDT 提款嗎？<br>狀態將變為 [出款中]，等待財務手動操作。`, '批准確認', { dangerouslyUseHTMLString: true, confirmButtonText: '確定批准', cancelButtonText: '取消', type: 'warning' })
        .then(async () => {
            try {
                await this.$api.approveWithdrawal(row.id);
                ElMessage.success('批准成功，狀態已更新');
                await this.fetchData();
            } catch (error) { console.error('Failed to approve:', error); }
        }).catch(() => {});
    },

    // (拒絕)
    handleReject(row) {
        ElMessageBox.prompt('請輸入拒絕理由 (將退款給用戶)', '拒絕提款', { confirmButtonText: '確認拒絕', cancelButtonText: '取消', inputPattern: /.+/, inputErrorMessage: '拒絕理由不能為空' })
        .then(async ({ value }) => {
            try {
                await this.$api.rejectWithdrawal(row.id, { reason: value });
                ElMessage.success('拒絕成功，款項已退回用戶餘額');
                await this.fetchData();
            } catch (error) { console.error('Failed to reject:', error); }
        }).catch(() => {});
    },

    // (手動完成)
    handleComplete(row) {
        // (您需要自行在 api.js 和 admin.js 中實作 'completeWithdrawal' API)
        ElMessage.info('「手動完成」功能尚未實作。');
        // ElMessageBox.prompt('請輸入出款 TX Hash', '標記為完成', { ... })
        // .then(async ({ value: txHash }) => {
        //    const { value: gasFee } = await ElMessageBox.prompt('請輸入 Gas 成本 (USDT)', 'Gas 成本', { ... });
        //    await this.$api.completeWithdrawal(row.id, { tx_hash: txHash, gas_fee: gasFee });
        //    ...
        // })
    },

    // --- (格式化輔助函數) ---
    formatDateTime(isoString) {
      if (!isoString) return ''; 
      try { return new Date(isoString).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }); } 
      catch (e) { return isoString; }
    },
    formatStatus(status) {
      const map = { 'pending': '待審核', 'rejected': '審核拒絕', 'processing': '出款中', 'completed': '出款完成' };
      return map[status] || status;
    },
    getStatusTagType(status) {
      const map = { 'pending': 'warning', 'rejected': 'danger', 'processing': 'primary', 'completed': 'success' };
      return map[status] || 'info';
    },
    formatCurrency(value, allowZero = false) {
      if (value === null || value === undefined) return allowZero ? '0.00' : '-';
      const num = parseFloat(value);
      if (isNaN(num)) return 'N/A';
      if (num === 0 && !allowZero) return '-';
      return num.toFixed(2);
    },
    getTxLink(chain, hash) {
        if (chain === 'TRC20') return `https://nile.tronscan.org/#/transaction/${hash}`;
        if (chain === 'BSC') return `https://testnet.bscscan.com/tx/${hash}`;
        if (chain === 'ETH') return `https://sepolia.etherscan.io/tx/${hash}`; // Sepolia 測試網
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
.tx-link { color: #409EFF; text-decoration: none; }
.tx-link:hover { text-decoration: underline; }

.search-form :deep(.el-input) { width: 180px; }
.search-form :deep(.el-select) { width: 180px; }
</style>