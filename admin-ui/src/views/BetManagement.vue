<template>
  <div class="bet-management-container">
    <h2>注单管理</h2>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch">
        
        <el-form-item label="注单编号">
          <el-input v-model="searchParams.betId" placeholder="注单编号 (模糊)" clearable></el-input>
        </el-form-item>
        
        <el-form-item label="用户ID">
          <el-input v-model="searchParams.userId" placeholder="用户ID (模糊)" clearable></el-input>
        </el-form-item>

        <el-form-item label="注单状态">
          <el-select v-model="searchParams.status" placeholder="选择状态" clearable>
            <el-option label="處理中" value="pending" />
            <el-option label="中獎" value="won" />
            <el-option label="未中獎" value="lost" />
            <el-option label="失敗" value="failed" />
          </el-select>
        </el-form-item>

        <el-form-item label="下注完成时间">
          <el-date-picker
            v-model="searchParams.dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="開始時間"
            end-placeholder="結束時間"
            value-format="YYYY-MM-DDTHH:mm:ssZ"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSearch">查詢</el-button>
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
        
        <el-table-column label="中獎金額 (USDT)" width="150">
           <template #default="scope">{{ formatPrize(scope.row) }}</template>
        </el-table-column>

        <el-table-column prop="tx_hash" label="開獎 Hash" width="180">
          <template #default="scope">
            <a v-if="scope.row.tx_hash" :href="`https://sepolia.etherscan.io/tx/${scope.row.tx_hash}`" target="_blank" class="tx-link">
              {{ scope.row.tx_hash.substring(0, 10) }}...
            </a>
            <span v-else>-</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="bet_time" label="下注時間 (系統)" width="180">
           <template #default="scope">{{ formatDateTime(scope.row.bet_time) }}</template>
        </el-table-column>

        <el-table-column prop="settle_time" label="開獎時間 (系統)" width="180">
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
        // walletAddress: '', // (v6 移除)
        status: '',
        dateRange: null, 
      },
    };
  },
  created() {
    // (★★★ v6 移除：prize_pending 查詢 ★★★)
    this.fetchBets();
  },
  methods: {
    // (★★★ v6 修改：fetchBets ★★★)
    async fetchBets() {
      if (this.loading) return;
      this.loading = true;
      try {
        const params = {
          ...this.pagination,
          betId: this.searchParams.betId || undefined,
          userId: this.searchParams.userId || undefined, 
          // walletAddress: this.searchParams.walletAddress || undefined, // (v6 移除)
          status: this.searchParams.status || undefined,
          dateRange: this.searchParams.dateRange ? JSON.stringify(this.searchParams.dateRange) : undefined,
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
    
    // (★★★ v6 修改：formatStatus ★★★)
    formatStatus(status) {
      const map = {
        'pending': '處理中', 'won': '中獎', 'lost': '未中獎',
        'failed': '失敗',
      };
      return map[status] || status;
    },
    
    // (★★★ v6 修改：getStatusTagType ★★★)
    getStatusTagType(status) {
      const map = {
        'pending': 'info', 'won': 'success', 'lost': 'danger',
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
        return num.toFixed(2); // (USDT 顯示到小數點後 2 位)
      } catch (e) {
        return 'N/A';
      }
    },
    
    formatPrize(row) {
      if (row.status === 'won') { // (★★★ v6 修改：移除 prize_pending ★★★)
        try {
            const betAmount = parseFloat(row.amount);
            const multiplier = parseInt(row.payout_multiplier, 10) || 2; 
            const prizeAmount = betAmount * multiplier; 
            return this.formatCurrency(prizeAmount);
        } catch(e) {
            return '計算錯誤';
        }
      }
      return '-';
    },
  },
};
</script>

<style scoped>
.search-card { margin-bottom: 20px; }
.table-card { margin-bottom: 20px; }
.pagination-container { margin-top: 20px; display: flex; justify-content: flex-end; }
.el-form-item { margin-bottom: 10px; }
/* (★★★ v6 新增：Hash 連結樣式 ★★★) */
.tx-link {
  color: #409EFF;
  text-decoration: none;
}
.tx-link:hover {
  text-decoration: underline;
}
</style>