<template>
  <div class="user-management-container">
    <h2>用戶管理</h2>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch">
        
        <el-form-item label="用户ID">
          <el-input v-model="searchParams.userId" placeholder="用户ID (模糊)" clearable></el-input>
        </el-form-item>
        
        <el-form-item label="钱包地址">
          <el-input v-model="searchParams.walletAddress" placeholder="钱包地址 (精确)" clearable></el-input>
        </el-form-item>
        
        <el-form-item label="用户昵称">
          <el-input v-model="searchParams.nickname" placeholder="昵称 (精确)" clearable></el-input>
        </el-form-item>

        <el-form-item label="自身邀请码">
          <el-input v-model="searchParams.inviteCode" placeholder="自身邀请码 (精确)" clearable></el-input>
        </el-form-item>
        
        <el-form-item label="推荐人邀请码">
          <el-input v-model="searchParams.referrerCode" placeholder="推荐人邀请码 (精确)" clearable></el-input>
        </el-form-item>
        
        <el-form-item label="状态">
          <el-select v-model="searchParams.status" placeholder="选择状态" clearable>
            <el-option label="正常 (active)" value="active" />
            <el-option label="禁用 (banned)" value="banned" />
          </el-select>
        </el-form-item>

        <el-form-item label="注册时间">
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
        
        <el-table-column prop="user_id" label="用户ID" width="120" />
        <el-table-column prop="wallet_address" label="钱包地址" />

        <el-table-column label="钱包馀额" width="120">
            <template #default="scope">
                <el-button 
                    type="primary" 
                    link 
                    @click="handleCheckBalance(scope.row)">
                    查詢餘額
                </el-button>
            </template>
        </el-table-column>
        <el-table-column prop="nickname" label="用户昵称" width="120" />
        <el-table-column prop="level" label="用户等级" width="100" />
        <el-table-column prop="invite_code" label="自身邀请码" width="120" />
        <el-table-column prop="referrer_code" label="推荐人邀请码" width="130" />
        <el-table-column prop="max_streak" label="最高連勝" width="100" />
        <el-table-column prop="created_at" label="注册时间" width="180">
           <template #default="scope">
            {{ formatDateTime(scope.row.created_at) }}
          </template>
        </el-table-column>
        
        <el-table-column prop="status" label="禁用投注" width="100" fixed="right">
          <template #default="scope">
            <el-switch
              v-model="scope.row.status"
              active-value="banned"
              inactive-value="active"
              active-text="禁用"
              inactive-text="正常"
              inline-prompt
              style="--el-switch-on-color: #ff4949; --el-switch-off-color: #13ce66"
              @change="handleStatusChange(scope.row)"
            />
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

    <el-dialog
        v-model="balanceDialogVisible"
        title="即時錢包餘額查詢 (Sepolia)"
        width="600px"
        :close-on-click-modal="false"
    >
        <div v-loading="balanceLoading">
            <div v-if="currentBalanceData">
                <p><strong>錢包地址:</strong> {{ currentBalanceData.walletAddress }}</p>
                <p><strong>ETH 餘額:</strong> 
                    <span style="font-size: 20px; font-weight: bold; color: #67c23a;">
                        {{ currentBalanceData.balanceEth }} ETH
                    </span>
                </p>
                <p style="color: #909399; font-size: 12px;">(Wei: {{ currentBalanceData.balanceWei }})</p>
            </div>
            <div v-else>
                <p>正在查詢，請稍候...</p>
            </div>
        </div>
        <template #footer>
            <el-button @click="balanceDialogVisible = false">關閉</el-button>
        </template>
    </el-dialog>
    </div>
</template>

<script>
import { ElMessage } from 'element-plus';

export default {
  name: 'UserManagementView',
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
        walletAddress: '',
        dateRange: null, 
        nickname: '',
        inviteCode: '',
        referrerCode: '',
        status: '',
      },
      // (Part 6 新增)
      balanceDialogVisible: false,
      balanceLoading: false,
      currentBalanceData: null,
    };
  },
  created() {
    this.fetchUsers();
  },
  methods: {
    async fetchUsers() {
      if (this.loading) return;
      this.loading = true;

      try {
        const params = {
          ...this.pagination,
          userId: this.searchParams.userId || undefined, 
          walletAddress: this.searchParams.walletAddress || undefined,
          dateRange: this.searchParams.dateRange ? JSON.stringify(this.searchParams.dateRange) : undefined,
          nickname: this.searchParams.nickname || undefined,
          inviteCode: this.searchParams.inviteCode || undefined,
          referrerCode: this.searchParams.referrerCode || undefined,
          status: this.searchParams.status || undefined,
        };

        const response = await this.$api.getUsers(params);
        
        this.tableData = response.list;
        this.totalItems = response.total;

      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        this.loading = false;
      }
    },
    
    async handleStatusChange(row) {
      const newStatus = row.status;
      const newStatusText = newStatus === 'banned' ? '禁用' : '啟用';
      
      try {
        await this.$api.updateUserStatus(row.id, newStatus);
        ElMessage.success(`用户 ${row.user_id} 狀態已更新為 ${newStatusText}`);
      } catch (error) {
        console.error('Failed to update status:', error);
        row.status = (newStatus === 'banned' ? 'active' : 'banned');
      }
    },

    // (Part 6 新增)
    async handleCheckBalance(row) {
        console.log('Checking balance for:', row.wallet_address);
        this.balanceDialogVisible = true;
        this.balanceLoading = true;
        this.currentBalanceData = null; 

        try {
            const data = await this.$api.getUserBalance(row.wallet_address);
            this.currentBalanceData = data;
        } catch (error)
        {
            console.error('Failed to fetch balance:', error);
            this.balanceDialogVisible = false; 
        } finally {
            this.balanceLoading = false;
        }
    },

    handleSearch() {
      this.pagination.page = 1;
      this.fetchUsers();
    },
    handleSizeChange(newLimit) {
      this.pagination.limit = newLimit;
      this.pagination.page = 1; 
      this.fetchUsers();
    },
    handlePageChange(newPage) {
      this.pagination.page = newPage;
      this.fetchUsers();
    },
    formatDateTime(isoString) {
      if (!isoString) return 'N/A';
      try {
        const date = new Date(isoString);
        return date.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
      } catch (e) {
        return isoString;
      }
    }
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
</style>