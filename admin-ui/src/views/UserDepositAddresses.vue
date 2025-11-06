<template>
  <div class="user-addresses-container">
    <h2>用戶充值地址管理</h2>
    <p class="page-description">查看由 HD 錢包派生給所有用戶的專屬充值地址。</p>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch" class="search-form">
        <el-form-item label="用户ID">
          <el-input v-model="searchParams.userId" placeholder="用户ID (模糊)" clearable></el-input>
        </el-form-item>
        <el-form-item label="用戶帳號">
          <el-input v-model="searchParams.username" placeholder="登入帳號 (模糊)" clearable></el-input>
        </el-form-item>
        <el-form-item label="TRC20 地址">
          <el-input v-model="searchParams.tronAddress" placeholder="TRC20 地址 (精确)" clearable></el-input>
        </el-form-item>
        <el-form-item label="EVM 地址">
          <el-input v-model="searchParams.evmAddress" placeholder="EVM 地址 (精确)" clearable></el-input>
        </el-form-item>
        <el-form-item label="派生索引">
          <el-input v-model.number="searchParams.pathIndex" type="number" placeholder="索引 (精确)" clearable></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查詢</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-table :data="tableData" style="width: 100%">
        <el-table-column prop="user_id" label="用户ID" width="120" fixed="left" />
        <el-table-column prop="username" label="用戶帳號" width="150" />
        <el-table-column prop="deposit_path_index" label="派生索引 (Path)" width="150" sortable />
        <el-table-column prop="tron_deposit_address" label="TRC20 地址 (T...)" />
        <el-table-column prop="evm_deposit_address" label="EVM 地址 (0x...)" />
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
// ( ... <script> 標籤內的邏輯保持不變 ... )
export default {
  name: 'UserDepositAddressesView',
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
        userId: '',
        username: '',
        tronAddress: '',
        evmAddress: '',
        pathIndex: null,
      },
    };
  },
  created() {
    this.fetchAddresses();
  },
  methods: {
    async fetchAddresses() {
      if (this.loading) return;
      this.loading = true;
      try {
        const params = {
          ...this.pagination,
          userId: this.searchParams.userId || undefined,
          username: this.searchParams.username || undefined,
          tronAddress: this.searchParams.tronAddress || undefined,
          evmAddress: this.searchParams.evmAddress || undefined,
          pathIndex: this.searchParams.pathIndex || undefined,
        };
        const response = await this.$api.getUserDepositAddresses(params); 
        this.tableData = response.list;
        this.totalItems = response.total;
      } catch (error) {
        console.error('Failed to fetch user addresses:', error);
      } finally {
        this.loading = false;
      }
    },
    handleSearch() { this.pagination.page = 1; this.fetchAddresses(); },
    handleSizeChange(newLimit) { this.pagination.limit = newLimit; this.pagination.page = 1; this.fetchAddresses(); },
    handlePageChange(newPage) { this.pagination.page = newPage; this.fetchAddresses(); },
  },
};
</script>

<style scoped>
.page-description { color: #909399; font-size: 14px; margin-bottom: 20px; }
.search-card { margin-bottom: 20px; }
.table-card { margin-bottom: 20px; }
.pagination-container { margin-top: 20px; display: flex; justify-content: flex-end; }
.el-form-item { margin-bottom: 10px; }

/* (★★★ 修改 2: 新增 CSS 規則 ★★★) */
.search-form :deep(.el-input) {
  width: 180px;
}
.search-form :deep(.el-select) {
  width: 180px;
}
</style>