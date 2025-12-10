<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">自营游戏管理</h2>
    </div>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch" class="search-form">
        <el-form-item label="游戏厂商">
          <el-select v-model="searchParams.provider" placeholder="选择厂商" clearable style="width: 150px;">
            <el-option label="自营" value="自营" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="状态">
          <el-select v-model="searchParams.status" placeholder="选择状态" clearable style="width: 120px;">
            <el-option label="开启" value="enabled" />
            <el-option label="关闭" value="disabled" />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
          <el-button type="success" @click="handleAdd">新增游戏</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-table :data="tableData" style="width: 100%" :cell-style="{ paddingTop: '8px', paddingBottom: '8px' }">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="provider" label="游戏厂商" width="120" />
        <el-table-column prop="provider_params" label="游戏参数" width="150">
          <template #default="scope">
            <span v-if="scope.row.provider_params">{{ scope.row.provider_params }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="game_code" label="游戏代码" width="120">
          <template #default="scope">
            <span v-if="scope.row.game_code">{{ scope.row.game_code }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="name_zh" label="游戏名字" width="150" />
        <el-table-column prop="name_en" label="英文名字" width="150">
          <template #default="scope">
            <span v-if="scope.row.name_en">{{ scope.row.name_en }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="game_status" label="游戏状态" width="120">
          <template #default="scope">
            <el-tag v-if="scope.row.game_status" :type="getGameStatusTagType(scope.row.game_status)">
              {{ scope.row.game_status }}
            </el-tag>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'enabled' ? 'success' : 'danger'">
              {{ scope.row.status === 'enabled' ? '开启' : '关闭' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sort_order" label="排序" width="100" />
        <el-table-column prop="payout_multiplier" label="派奖倍数" width="120">
          <template #default="scope">
            {{ scope.row.payout_multiplier }}x
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button type="primary" size="small" @click="handleEdit(scope.row)">编辑</el-button>
            <el-button type="warning" size="small" @click="handleEditPayout(scope.row)">游戏赔率</el-button>
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

    <!-- 编辑/新增对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      @close="handleDialogClose"
    >
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="120px">
        <el-form-item label="游戏厂商" prop="provider">
          <el-input v-model="formData.provider" placeholder="自营" />
        </el-form-item>
        
        <el-form-item label="游戏参数" prop="provider_params">
          <el-input v-model="formData.provider_params" type="textarea" :rows="3" placeholder="自营留空，或三方厂商参数（JSON格式）" />
        </el-form-item>
        
        <el-form-item label="游戏名字" prop="name_zh">
          <el-input v-model="formData.name_zh" placeholder="请输入中文名" />
        </el-form-item>
        
        <el-form-item label="英文名字" prop="name_en">
          <el-input v-model="formData.name_en" placeholder="用于多语系" />
        </el-form-item>
        
        <el-form-item label="游戏状态" prop="game_status">
          <el-select v-model="formData.game_status" placeholder="选择标签" clearable style="width: 100%;">
            <el-option label="热门" value="热门" />
            <el-option label="新游戏" value="新游戏" />
            <el-option label="推荐" value="推荐" />
            <el-option label="无" value="" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="formData.status">
            <el-radio label="enabled">开启</el-radio>
            <el-radio label="disabled">关闭</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="排序" prop="sort_order">
          <el-input-number v-model="formData.sort_order" :min="0" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">确定</el-button>
      </template>
    </el-dialog>

    <!-- 游戏赔率编辑对话框 -->
    <el-dialog
      v-model="payoutDialogVisible"
      title="编辑游戏赔率"
      width="400px"
    >
      <el-form ref="payoutFormRef" :model="payoutFormData" :rules="payoutFormRules" label-width="120px">
        <el-form-item label="游戏名称">
          <el-input v-model="payoutFormData.gameName" disabled />
        </el-form-item>
        
        <el-form-item label="派奖倍数" prop="payout_multiplier">
          <el-input-number v-model="payoutFormData.payout_multiplier" :min="0.01" :precision="2" :step="0.01" />
          <span style="margin-left: 8px;">倍</span>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="payoutDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handlePayoutSubmit" :loading="submitLoading">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus';

export default {
  name: 'GameManagementView',
  data() {
    return {
      loading: false,
      tableData: [],
      totalItems: 0,
      pagination: {
        page: 1,
        limit: 20,
      },
      searchParams: {
        provider: '',
        status: '',
      },
      dialogVisible: false,
      dialogTitle: '新增游戏',
      isEdit: false,
      currentEditId: null,
      formData: {
        provider: '自营',
        provider_params: '',
        game_code: '',
        name_zh: '',
        name_en: '',
        game_status: '',
        status: 'enabled',
        sort_order: 0,
      },
      formRules: {
        name_zh: [{ required: true, message: '游戏名字不能为空', trigger: 'blur' }],
        status: [{ required: true, message: '状态不能为空', trigger: 'change' }],
      },
      submitLoading: false,
      payoutDialogVisible: false,
      payoutFormData: {
        gameId: null,
        gameName: '',
        payout_multiplier: 2,
      },
      payoutFormRules: {
        payout_multiplier: [
          { required: true, message: '派奖倍数不能为空', trigger: 'blur' },
          { type: 'number', min: 0.01, message: '派奖倍数必须大于0', trigger: 'blur' },
        ],
      },
    };
  },
  created() {
    this.fetchGames();
  },
  methods: {
    async fetchGames() {
      this.loading = true;
      try {
        const params = {
          page: this.pagination.page,
          limit: this.pagination.limit,
          ...this.searchParams,
        };
        // 移除空值
        Object.keys(params).forEach(key => {
          if (params[key] === '' || params[key] === null || params[key] === undefined) {
            delete params[key];
          }
        });
        
        const response = await this.$api.getGames(params);
        if (response.data) {
          this.tableData = response.data.list || [];
          this.totalItems = response.data.total || 0;
        }
      } catch (error) {
        console.error('Failed to fetch games:', error);
        ElMessage.error('获取游戏列表失败');
      } finally {
        this.loading = false;
      }
    },
    handleSearch() {
      this.pagination.page = 1;
      this.fetchGames();
    },
    handleReset() {
      this.searchParams = {
        provider: '',
        status: '',
      };
      this.handleSearch();
    },
    handleAdd() {
      this.dialogTitle = '新增游戏';
      this.isEdit = false;
      this.currentEditId = null;
      this.formData = {
        provider: '自营',
        provider_params: '',
        game_code: '',
        name_zh: '',
        name_en: '',
        game_status: '',
        status: 'enabled',
        sort_order: 0,
      };
      this.dialogVisible = true;
    },
    handleEdit(row) {
      this.dialogTitle = '编辑游戏';
      this.isEdit = true;
      this.currentEditId = row.id;
      this.formData = {
        provider: row.provider || '自营',
        provider_params: row.provider_params || '',
        game_code: row.game_code || '',
        name_zh: row.name_zh || '',
        name_en: row.name_en || '',
        game_status: row.game_status || '',
        status: row.status || 'enabled',
        sort_order: row.sort_order || 0,
      };
      this.dialogVisible = true;
    },
    handleEditPayout(row) {
      this.payoutFormData = {
        gameId: row.id,
        gameName: row.name_zh,
        payout_multiplier: row.payout_multiplier || 2,
      };
      this.payoutDialogVisible = true;
    },
    async handleSubmit() {
      try {
        await this.$refs.formRef.validate();
        this.submitLoading = true;
        
        if (this.isEdit) {
          await this.$api.updateGame(this.currentEditId, this.formData);
          ElMessage.success('游戏更新成功');
        } else {
          await this.$api.createGame(this.formData);
          ElMessage.success('游戏创建成功');
        }
        
        this.dialogVisible = false;
        this.fetchGames();
      } catch (error) {
        if (error.message) {
          ElMessage.error(error.message);
        } else {
          ElMessage.error(this.isEdit ? '更新失败' : '创建失败');
        }
      } finally {
        this.submitLoading = false;
      }
    },
    async handlePayoutSubmit() {
      try {
        await this.$refs.payoutFormRef.validate();
        this.submitLoading = true;
        
        await this.$api.updateGame(this.payoutFormData.gameId, {
          payout_multiplier: this.payoutFormData.payout_multiplier,
        });
        
        ElMessage.success('派奖倍数更新成功');
        this.payoutDialogVisible = false;
        this.fetchGames();
      } catch (error) {
        if (error.message) {
          ElMessage.error(error.message);
        } else {
          ElMessage.error('更新失败');
        }
      } finally {
        this.submitLoading = false;
      }
    },
    handleDialogClose() {
      this.$refs.formRef?.resetFields();
    },
    handleSizeChange(newLimit) {
      this.pagination.limit = newLimit;
      this.pagination.page = 1;
      this.fetchGames();
    },
    handlePageChange(newPage) {
      this.pagination.page = newPage;
      this.fetchGames();
    },
    getGameStatusTagType(status) {
      const map = {
        '热门': 'danger',
        '新游戏': 'success',
        '推荐': 'warning',
      };
      return map[status] || 'info';
    },
  },
};
</script>

<style scoped>
.text-muted {
  color: var(--text-tertiary);
  font-style: italic;
}

.search-form :deep(.el-input) {
  width: 180px;
}

.search-form :deep(.el-select) {
  width: 180px;
}

.pagination-container {
  margin-top: var(--spacing-md);
  display: flex;
  justify-content: flex-end;
}
</style>

