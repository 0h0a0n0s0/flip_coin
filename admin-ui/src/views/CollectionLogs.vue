<template>
  <div class="collection-logs-container">
    <h2>归集记录</h2>
    <p class="page-description">查询和管理用户充值地址的归集记录。</p>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch" class="search-form">
        <el-form-item label="用户ID">
          <el-input 
            v-model="searchParams.userId" 
            placeholder="用户ID (模糊)" 
            clearable
          ></el-input>
        </el-form-item>
        <el-form-item label="用户充值地址">
          <el-input 
            v-model="searchParams.user_deposit_address" 
            placeholder="充值地址 (精确)" 
            clearable
          ></el-input>
        </el-form-item>
        <el-form-item label="归集钱包地址">
          <el-input 
            v-model="searchParams.collection_wallet_address" 
            placeholder="归集地址 (精确)" 
            clearable
          ></el-input>
        </el-form-item>
        <el-form-item label="狀态">
          <el-select v-model="searchParams.status" placeholder="选择狀态" clearable>
            <el-option label="全部" value="" />
            <el-option label="已完成" value="completed" />
            <el-option label="失败" value="failed" />
            <el-option label="处理中" value="pending" />
          </el-select>
        </el-form-item>
        <el-form-item label="时间">
          <el-date-picker
            v-model="searchParams.dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DDTHH:mm:ssZ"
            clearable
            :default-time="['00:00:00', '23:59:59']"
            unlink-panels
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch" :loading="loading">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-table 
        :data="tableData" 
        style="width: 100%"
        show-summary
        :summary-method="renderSummary"
      >
        <el-table-column prop="user_id" label="用户ID" width="120" />
        <el-table-column prop="username" label="用户名" width="150" />
        <el-table-column label="用户充值地址" width="200">
          <template #default="scope">
            {{ scope.row.user_deposit_address_masked || scope.row.user_deposit_address }}
          </template>
        </el-table-column>
        <el-table-column label="归集钱包地址" width="200">
          <template #default="scope">
            {{ scope.row.collection_wallet_address_masked || scope.row.collection_wallet_address }}
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="归集金额" width="120">
          <template #default="scope">
            {{ formatCurrency(scope.row.amount) }} USDT
          </template>
        </el-table-column>
        <el-table-column prop="tx_hash" label="交易Hash" width="200">
          <template #default="scope">
            <span v-if="scope.row.tx_hash" class="tx-hash">{{ scope.row.tx_hash_masked || scope.row.tx_hash }}</span>
            <span v-else class="no-tx">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="energy_used" label="能量消耗" width="120">
          <template #default="scope">
            <span v-if="scope.row.energy_used">{{ scope.row.energy_used.toLocaleString() }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="狀态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="error_message" label="错误讯息" min-width="200">
          <template #default="scope">
            <span v-if="scope.row.error_message" class="error-message">{{ scope.row.error_message }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="归集时间" width="180">
          <template #default="scope">
            {{ formatDateTime(scope.row.created_at) }}
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
import { ElMessage } from 'element-plus';

const pad = (num) => String(num).padStart(2, '0');
const formatForPicker = (date) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const offsetHours = pad(Math.floor(absOffset / 60));
  const offsetMinutes = pad(absOffset % 60);
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMinutes}`;
};

const createTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return [formatForPicker(start), formatForPicker(end)];
};

export default {
  name: 'CollectionLogsView',
  data() {
    return {
      loading: false,
      tableData: [],
      totalItems: 0,
      pageTotalAmount: 0,
      totalAmount: 0,
      pagination: { page: 1, limit: 10 },
      searchParams: {
        userId: '',
        user_deposit_address: '',
        collection_wallet_address: '',
        status: '',
        dateRange: null
      }
    };
  },
  created() {
    this.setDefaultDateRange();
    this.handleSearch();
  },
  methods: {
    setDefaultDateRange() {
      this.searchParams.dateRange = createTodayRange();
    },
    async fetchLogs() {
      if (this.loading) return;
      this.loading = true;
      try {
        const params = {
          ...this.pagination,
          userId: this.searchParams.userId || undefined,
          user_deposit_address: this.searchParams.user_deposit_address || undefined,
          collection_wallet_address: this.searchParams.collection_wallet_address || undefined,
          status: this.searchParams.status || undefined,
          dateRange: this.searchParams.dateRange ? JSON.stringify(this.searchParams.dateRange) : undefined
        };
        const response = await this.$api.getCollectionLogs(params);
        this.tableData = response.list;
        this.totalItems = response.total;
        this.pageTotalAmount = response.pageTotalAmount || 0;
        this.totalAmount = response.totalAmount || 0;
      } catch (error) {
        console.error('Failed to fetch collection logs:', error);
        ElMessage.error('载入归集记录失败');
      } finally {
        this.loading = false;
      }
    },
    handleSearch() {
      this.pagination.page = 1;
      this.fetchLogs();
    },
    handleSizeChange(newLimit) {
      this.pagination.limit = newLimit;
      this.pagination.page = 1;
      this.fetchLogs();
    },
    handlePageChange(newPage) {
      this.pagination.page = newPage;
      this.fetchLogs();
    },
    formatCurrency(value) {
      if (value === null || value === undefined) return '0.00';
      const num = parseFloat(value);
      if (isNaN(num)) return '0.00';
      return num.toFixed(2);
    },
    formatDateTime(dateStr) {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      return date.toLocaleString('zh-TW', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
    },
    getStatusType(status) {
      const statusMap = {
        'completed': 'success',
        'failed': 'danger',
        'pending': 'warning'
      };
      return statusMap[status] || 'info';
    },
    getStatusText(status) {
      const statusMap = {
        'completed': '已完成',
        'failed': '失败',
        'pending': '处理中'
      };
      return statusMap[status] || status;
    },
    renderSummary({ columns }) {
      const sums = [];
      columns.forEach((column, index) => {
        if (column.property === 'amount') {
          const pageSum = `${this.formatCurrency(this.pageTotalAmount)} USDT`;
          const totalSum = `${this.formatCurrency(this.totalAmount)} USDT`;
          sums[index] = `页面总计：${pageSum}\n全部查询结果总计：${totalSum}`;
        } else {
          sums[index] = '';
        }
      });
      return sums;
    }
  }
};
</script>

<style scoped>
.page-description {
  color: #909399;
  font-size: 14px;
  margin-bottom: 20px;
}
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
.search-form :deep(.el-input) {
  width: 180px;
}
.search-form :deep(.el-select) {
  width: 180px;
}
.search-form :deep(.el-date-picker) {
  width: 400px;
}
.tx-hash {
  font-family: monospace;
  font-size: 12px;
  color: #409EFF;
  cursor: pointer;
}
.tx-hash:hover {
  text-decoration: underline;
}
.no-tx {
  color: #909399;
}
.error-message {
  color: #f56c6c;
  font-size: 12px;
}
:deep(.el-table__footer .cell) {
  white-space: pre-line;
  font-weight: 600;
  color: #303133;
}
:deep(.el-table__footer .cell)::before {
  content: '';
}
</style>

