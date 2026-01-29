<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">提現地址黑名單</h2>
      <p class="page-description">管理禁止提現的區塊鏈地址。黑名單地址不會阻止用戶發起提現請求，但會在審核時顯示警告。</p>
    </div>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch" class="search-form">
        <el-form-item label="地址">
          <el-input v-model="searchParams.address" placeholder="搜尋地址" clearable></el-input>
        </el-form-item>
        <el-form-item label="區塊鏈">
          <el-select v-model="searchParams.chain" placeholder="選擇鏈" clearable>
            <el-option label="全部" value="" />
            <el-option label="TRC20 (TRON)" value="TRC20" />
            <el-option label="BSC" value="BSC" />
            <el-option label="ETH" value="ETH" />
            <el-option label="POLYGON" value="POLYGON" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查詢</el-button>
          <el-button type="success" @click="showAddDialog" v-if="$permissions.has('withdrawals', 'update')">
            <el-icon><Plus /></el-icon>
            添加黑名單
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-table :data="tableData" style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="address" label="地址" min-width="300">
          <template #default="scope">
            <el-text class="address-text">{{ scope.row.address }}</el-text>
          </template>
        </el-table-column>
        <el-table-column prop="chain" label="區塊鏈" width="120">
          <template #default="scope">
            <el-tag v-if="scope.row.chain" type="info">{{ scope.row.chain }}</el-tag>
            <el-tag v-else type="warning">全部</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="memo" label="備註" min-width="200">
          <template #default="scope">
            <span>{{ scope.row.memo || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="admin_username" label="添加人" width="120" />
        <el-table-column prop="created_at" label="添加時間" width="170">
          <template #default="scope">{{ formatDateTime(scope.row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="scope">
            <el-button 
              class="action-btn-delete" 
              @click="handleDelete(scope.row)" 
              v-if="$permissions.has('withdrawals', 'update')"
            >
              刪除
            </el-button>
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

    <!-- 添加黑名單對話框 -->
    <el-dialog v-model="addDialogVisible" title="添加黑名單地址" width="600px">
      <el-form :model="addForm" ref="addFormRef" label-width="100px">
        <el-form-item 
          label="地址" 
          prop="address"
          :rules="[{ required: true, message: '地址不能為空' }]"
        >
          <el-input 
            v-model="addForm.address" 
            placeholder="請輸入區塊鏈地址" 
            clearable
          ></el-input>
        </el-form-item>
        <el-form-item label="區塊鏈" prop="chain">
          <el-select v-model="addForm.chain" placeholder="選擇鏈（留空表示全部鏈）" clearable>
            <el-option label="TRC20 (TRON)" value="TRC20" />
            <el-option label="BSC" value="BSC" />
            <el-option label="ETH" value="ETH" />
            <el-option label="POLYGON" value="POLYGON" />
          </el-select>
          <div class="form-tip">留空表示該地址在所有鏈上都被禁止</div>
        </el-form-item>
        <el-form-item label="備註" prop="memo">
          <el-input 
            v-model="addForm.memo" 
            type="textarea" 
            :rows="3"
            placeholder="請輸入備註（例如：詐騙地址、洗錢嫌疑等）" 
            clearable
          ></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAdd" :loading="submitLoading">確認添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';

export default {
  name: 'AddressBlacklist',
  components: { Plus },
  data() {
    return {
      loading: false,
      submitLoading: false,
      tableData: [],
      totalItems: 0,
      pagination: { page: 1, limit: 20 },
      searchParams: {
        address: '',
        chain: ''
      },
      addDialogVisible: false,
      addForm: {
        address: '',
        chain: '',
        memo: ''
      }
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
          address: this.searchParams.address || undefined,
          chain: this.searchParams.chain || undefined
        };
        
        const response = await this.$api.getWithdrawalBlacklist(params);
        if (response && response.success && response.data) {
          this.tableData = response.data.list || [];
          this.totalItems = response.data.total || 0;
        } else {
          // 向後兼容
          this.tableData = response.list || [];
          this.totalItems = response.total || 0;
        }
      } catch (error) {
        console.error('Failed to fetch blacklist:', error);
        ElMessage.error('獲取數據失敗');
      } finally {
        this.loading = false;
      }
    },
    
    handleSearch() {
      this.pagination.page = 1;
      this.fetchData();
    },
    
    handleSizeChange(newLimit) {
      this.pagination.limit = newLimit;
      this.pagination.page = 1;
      this.fetchData();
    },
    
    handlePageChange(newPage) {
      this.pagination.page = newPage;
      this.fetchData();
    },
    
    showAddDialog() {
      this.addForm = {
        address: '',
        chain: '',
        memo: ''
      };
      this.addDialogVisible = true;
    },
    
    async handleAdd() {
      try {
        await this.$refs.addFormRef.validate();
      } catch (error) {
        return;
      }
      
      this.submitLoading = true;
      try {
        await this.$api.addWithdrawalBlacklist(this.addForm);
        ElMessage.success('添加成功');
        this.addDialogVisible = false;
        await this.fetchData();
      } catch (error) {
        console.error('Failed to add to blacklist:', error);
        const errorMsg = error.response?.data?.error || '添加失敗';
        ElMessage.error(errorMsg);
      } finally {
        this.submitLoading = false;
      }
    },
    
    handleDelete(row) {
      ElMessageBox.confirm(
        `確定要從黑名單中移除地址 [${row.address}] 嗎？`,
        '確認刪除',
        {
          confirmButtonText: '確定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      ).then(async () => {
        try {
          await this.$api.deleteWithdrawalBlacklist(row.id);
          ElMessage.success('刪除成功');
          await this.fetchData();
        } catch (error) {
          console.error('Failed to delete from blacklist:', error);
          ElMessage.error('刪除失敗');
        }
      }).catch(() => {});
    },
    
    formatDateTime(isoString) {
      if (!isoString) return '';
      try {
        return new Date(isoString).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
      } catch (e) {
        return isoString;
      }
    }
  }
};
</script>

<style scoped>
.search-form :deep(.el-input) {
  width: 200px;
}

.search-form :deep(.el-select) {
  width: 180px;
}

.pagination-container {
  margin-top: var(--spacing-md);
  display: flex;
  justify-content: flex-end;
}

.address-text {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  word-break: break-all;
}

.form-tip {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.action-btn-delete {
  background-color: #f56c6c !important;
  border-color: #f56c6c !important;
  color: #ffffff !important;
  margin: 0 !important;
}

.action-btn-delete:hover {
  background-color: #f78989 !important;
  border-color: #f78989 !important;
  color: #ffffff !important;
}
</style>
