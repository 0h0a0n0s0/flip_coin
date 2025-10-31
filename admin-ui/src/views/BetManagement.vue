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

        <el-form-item label="钱包地址">
          <el-input v-model="searchParams.walletAddress" placeholder="钱包地址 (精确)" clearable></el-input>
        </el-form-item>

        <el-form-item label="注单状态">
          <el-select 
            v-model="searchParams.status" 
            placeholder="选择状态" 
            clearable
          >
            <el-option label="處理中" value="pending" />
            <el-option label="中獎" value="won" />
            <el-option label="未中獎" value="lost" />
            <el-option label="待派獎" value="prize_pending" />
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
        <el-table-column prop="wallet_address" label="钱包地址" />
        <el-table-column prop="game_type" label="游戏类型" width="120" />
        
        <el-table-column prop="choice" label="下注内容" width="100">
           <template #default="scope">
            {{ formatChoice(scope.row.choice) }}
          </template>
        </el-table-column>
        
        <el-table-column label="下注交易执行时间" width="180">
           <template #default></template> </el-table-column>
        
        <el-table-column prop="bet_time" label="下注交易完成时间" width="180">
           <template #default="scope">
            {{ formatDateTime(scope.row.bet_time) }}
          </template>
        </el-table-column>

        <el-table-column label="派奖交易执行时间" width="180">
           <template #default></template> </el-table-column>

        <el-table-column prop="settle_time" label="派奖交易完成时间" width="180">
           <template #default="scope">
            {{ formatDateTime(scope.row.settle_time) }} </template>
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
        walletAddress: '',
        status: '',
        dateRange: null, 
      },
    };
  },
  created() {
    const queryStatus = this.$route.query.status;
    if (queryStatus === 'prize_pending') {
      this.searchParams.status = 'prize_pending';
    }
    this.fetchBets();
  },
  methods: {
    // (fetchBets 函數不變)
    async fetchBets() {
      if (this.loading) return;
      this.loading = true;
      try {
        const params = {
          ...this.pagination,
          betId: this.searchParams.betId || undefined,
          userId: this.searchParams.userId || undefined, 
          walletAddress: this.searchParams.walletAddress || undefined,
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
    
    // (handleSearch 函數不變)
    handleSearch() {
      this.pagination.page = 1;
      this.fetchBets();
    },

    // (handleSizeChange 函數不變)
    handleSizeChange(newLimit) {
      this.pagination.limit = newLimit;
      this.pagination.page = 1; 
      this.fetchBets();
    },

    // (handlePageChange 函數不變)
    handlePageChange(newPage) {
      this.pagination.page = newPage;
      this.fetchBets();
    },

    // (★★★ 需求 2 修正：N/A 改為空字串 ★★★)
    formatDateTime(isoString) {
      if (!isoString) return ''; // (修正點)
      try {
        const date = new Date(isoString);
        return date.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
      } catch (e) {
        return isoString;
      }
    },
    
    // (formatStatus 函數不變)
    formatStatus(status) {
      const map = {
        'pending': '處理中',
        'won': '中獎',
        'lost': '未中獎',
        'prize_pending': '待派獎',
        'failed': '失敗',
      };
      return map[status] || status;
    },
    
    // (getStatusTagType 函數不變)
    getStatusTagType(status) {
      const map = {
        'pending': 'info',
        'won': 'success',
        'lost': 'danger',
        'prize_pending': 'warning',
        'failed': 'danger',
      };
      return map[status] || 'default';
    },

    // (★★★ 需求 1 新增：翻譯 head/tail ★★★)
    formatChoice(choice) {
      if (choice === 'head') return '正面';
      if (choice === 'tail') return '反面';
      return choice;
    }
  },
};
</script>

<style scoped>
/* (樣式不變) */
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
</style>