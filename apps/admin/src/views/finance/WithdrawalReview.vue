<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">
        提款審核
        <el-tooltip content="審核：批准改為出款中；拒绝退回余额；完成需填写TX Hash與Gas" placement="right">
          <el-icon style="margin-left: 8px; color: var(--text-tertiary); cursor: help;"><InfoFilled /></el-icon>
        </el-tooltip>
      </h2>
    </div>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch" class="search-form">
        <el-form-item label="用户名"><el-input v-model="searchParams.username" placeholder="用户名 (模糊)" clearable></el-input></el-form-item>
        <el-form-item label="用户ID"><el-input v-model="searchParams.user_id" placeholder="精确用户ID" clearable></el-input></el-form-item>
        <el-form-item label="提款地址"><el-input v-model="searchParams.address" placeholder="地址 (精确)" clearable></el-input></el-form-item>
        <el-form-item label="TX Hash"><el-input v-model="searchParams.tx_hash" placeholder="Hash (精确)" clearable></el-input></el-form-item>
        <el-form-item label="提款狀态">
          <el-select v-model="searchParams.status" placeholder="选择状态" clearable>
            <el-option label="待審核" value="pending" />
            <el-option label="審核拒绝" value="rejected" />
            <el-option label="出款中" value="processing" />
            <el-option label="出款完成" value="completed" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="发起时间">
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
        <el-table-column prop="user_id" label="用户ID" width="120" />
        <el-table-column prop="chain_type" label="区块链" width="100" />
        <el-table-column prop="address" label="提款地址" />
        
        <el-table-column prop="amount" label="提款金额" width="120" sortable>
           <template #default="scope">{{ formatCurrency(scope.row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="total_profit_loss" label="累计盈虧" width="120" sortable>
           <template #default="scope">{{ formatCurrency(scope.row.total_profit_loss) }}</template>
        </el-table-column>
        <el-table-column prop="gas_fee" label="Gas 成本" width="100">
           <template #default="scope">{{ formatCurrency(scope.row.gas_fee, true) }}</template>
        </el-table-column>
        
        <el-table-column prop="request_time" label="发起时间" width="170">
           <template #default="scope">{{ formatDateTime(scope.row.request_time) }}</template>
        </el-table-column>
        <el-table-column prop="review_time" label="審核时间" width="170">
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

        <el-table-column prop="status" label="狀态" width="100" fixed="right">
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
                <el-button type="danger" link @click="handleReject(scope.row)" v-if="$permissions.has('withdrawals', 'update')">拒绝</el-button>
            </div>
            <div v-if="scope.row.status === 'processing'">
                <el-button type="primary" link @click="handleComplete(scope.row)" v-if="$permissions.has('withdrawals', 'update')">手动完成</el-button>
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

// ★★★ 关键修改：让此函数直接返回 Date 对象，而不是字符串 ★★★
const createTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return [start, end];
};

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
        username: '',
        user_id: '',
        status: '',
        address: '',
        tx_hash: '',
        // 初始化为 Date 数组
        dateRange: createTodayRange()
      },
    };
  },
  created() {
    // 移除 setDefaultDateRange 调用，因为 data 中已经初始化了
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
          address: this.searchParams.address || undefined,
          tx_hash: this.searchParams.tx_hash || undefined,
          user_id: this.searchParams.user_id || undefined,
        };

        // ★★★ 关键修改：在发请求前，手动将 Date 对象转为 ISO 字符串 ★★★
        // 这样 Element Plus 组件只处理 Date 对象（不会报错），而后端收到的是它想要的字符串
        if (this.searchParams.dateRange && this.searchParams.dateRange.length === 2) {
          const [start, end] = this.searchParams.dateRange;
          // 确保是有效的 Date 对象
          if (start instanceof Date && !isNaN(start)) {
            params.start_time = start.toISOString();
          }
          if (end instanceof Date && !isNaN(end)) {
            params.end_time = end.toISOString();
          }
        }

        const response = await this.$api.getWithdrawals(params);
        // (★★★ 修復：後端使用標準響應格式 { success: true, data: { total, list } } ★★★)
        if (response && response.success && response.data) {
            this.tableData = response.data.list || [];
            this.totalItems = response.data.total || 0;
        } else {
            // 向後兼容：如果沒有標準格式，直接使用 response
            this.tableData = response.list || [];
            this.totalItems = response.total || 0;
        }
      } catch (error) {
        console.error('Failed to fetch withdrawals:', error);
        ElMessage.error('获取数据失败');
      } finally {
        this.loading = false;
      }
    },
    
    handleSearch() { this.pagination.page = 1; this.fetchData(); },
    handleSizeChange(newLimit) { this.pagination.limit = newLimit; this.pagination.page = 1; this.fetchData(); },
    handlePageChange(newPage) { this.pagination.page = newPage; this.fetchData(); },

    // (批准)
    handleApprove(row) {
        ElMessageBox.confirm(`确定要批准用户 [${row.username}] 的 ${row.amount} USDT 提款吗？<br>狀态将变为 [出款中]，等待财务手动操作。`, '批准确认', { dangerouslyUseHTMLString: true, confirmButtonText: '确定批准', cancelButtonText: '取消', type: 'warning' })
        .then(async () => {
            try {
                await this.$api.approveWithdrawal(row.id);
                ElMessage.success('批准成功，狀态已更新');
                await this.fetchData();
            } catch (error) { console.error('Failed to approve:', error); }
        }).catch(() => {});
    },

    // (拒绝)
    handleReject(row) {
        ElMessageBox.prompt('请输入拒绝理由 (将退款给用户)', '拒绝提款', { confirmButtonText: '确认拒绝', cancelButtonText: '取消', inputPattern: /.+/, inputErrorMessage: '拒绝理由不能为空' })
        .then(async ({ value }) => {
            try {
                await this.$api.rejectWithdrawal(row.id, { reason: value });
                ElMessage.success('拒绝成功，款项已退回用户余额');
                await this.fetchData();
            } catch (error) { console.error('Failed to reject:', error); }
        }).catch(() => {});
    },

    // (手动完成)
    handleComplete(row) {
        ElMessageBox.prompt(
            '请输入出款 TX Hash（交易哈希）',
            '标记为完成',
            {
                confirmButtonText: '下一步',
                cancelButtonText: '取消',
                inputPattern: /.+/,
                inputErrorMessage: 'TX Hash 不能为空',
                inputPlaceholder: '请输入完整的交易哈希'
            }
        ).then(async ({ value: txHash }) => {
            ElMessageBox.prompt(
                '请输入 Gas 成本 (USDT)',
                'Gas 成本',
                {
                    confirmButtonText: '确认完成',
                    cancelButtonText: '取消',
                    inputPattern: /^[0-9]+\.?[0-9]*$/,
                    inputErrorMessage: 'Gas Fee 必须为有效的数字',
                    inputPlaceholder: '例如：0.001',
                    inputValue: '0'
                }
            ).then(async ({ value: gasFee }) => {
                try {
                    await this.$api.completeWithdrawal(row.id, {
                        tx_hash: txHash.trim(),
                        gas_fee: parseFloat(gasFee) || 0
                    });
                    ElMessage.success('提款已标记为完成');
                    await this.fetchData();
                } catch (error) {
                    console.error('Failed to complete withdrawal:', error);
                    ElMessage.error(error.response?.data?.error || '标记完成失败');
                }
            }).catch(() => {});
        }).catch(() => {});
    },

    // --- (格式化辅助函数) ---
    formatDateTime(isoString) {
      if (!isoString) return ''; 
      try { return new Date(isoString).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }); } 
      catch (e) { return isoString; }
    },
    formatStatus(status) {
      const map = { 'pending': '待審核', 'rejected': '審核拒绝', 'processing': '出款中', 'completed': '出款完成' };
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
        if (chain === 'ETH') return `https://sepolia.etherscan.io/tx/${hash}`;
        if (chain === 'POLYGON') return `https://mumbai.polygonscan.com/tx/${hash}`;
        if (chain === 'SOL') return `https://solscan.io/tx/${hash}?cluster=testnet`;
        return '#';
    }
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

.search-form :deep(.el-input) {
  width: 180px;
}

.search-form :deep(.el-select) {
  width: 180px;
}

.search-form :deep(.el-date-editor) {
  width: 360px;
}

.pagination-container {
  margin-top: var(--spacing-md);
  display: flex;
  justify-content: flex-end;
}
</style>