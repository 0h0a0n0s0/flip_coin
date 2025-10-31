<template>
  <div class="wallet-monitoring-container">
    <h2>錢包監控</h2>

    <el-card shadow="never" class="action-card">
       <el-button type="primary" @click="handleAdd">新增錢包</el-button>
    </el-card>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch">
        <el-form-item label="钱包名称"><el-input v-model="searchParams.name" placeholder="名称 (模糊)" clearable></el-input></el-form-item>
        <el-form-item label="钱包类型">
          <el-select v-model="searchParams.type" placeholder="选择类型" clearable>
            <el-option label="全部" value="" /><el-option label="归集地址" value="collection" /><el-option label="收款地址" value="payment" /><el-option label="派奖地址" value="payout" /><el-option label="未知/其他" value="unknown" />
          </el-select>
        </el-form-item>
        <el-form-item label="钱包地址"><el-input v-model="searchParams.address" placeholder="地址 (精确)" clearable></el-input></el-form-item>
        <el-form-item><el-button type="primary" @click="handleSearch">查詢</el-button></el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-table :data="tableData" style="width: 100%">
        <el-table-column prop="name" label="钱包名称" width="180" />
        <el-table-column prop="type" label="钱包类型" width="150"><template #default="scope">{{ formatType(scope.row.type) }}</template></el-table-column>
        <el-table-column prop="address" label="钱包地址" />
        <el-table-column prop="balanceEth" label="钱包馀额 (ETH)" width="180">
           <template #default="scope">
            <span v-if="scope.row.balanceEth === '查询失败'" style="color: #f56c6c;">查询失败</span>
            <span v-else>{{ formatCurrency(scope.row.balanceEth) }}</span>
           </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="scope">
            <el-button type="primary" link @click="handleEdit(scope.row)">编辑</el-button>
            <el-button type="danger" link @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination class="pagination-container" layout="total, sizes, prev, pager, next, jumper" :total="totalItems"
        v-model:current-page="pagination.page" v-model:page-size="pagination.limit" :page-sizes="[10, 20, 50, 100]"
        @size-change="handleSizeChange" @current-change="handlePageChange" />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" :close-on-click-modal="false">
      <el-form ref="walletFormRef" :model="walletForm" :rules="formRules" label-width="100px">
        <el-form-item label="钱包名称" prop="name"><el-input v-model="walletForm.name" placeholder="请输入钱包名称"></el-input></el-form-item>
        <el-form-item label="钱包类型" prop="type">
          <el-select v-model="walletForm.type" placeholder="请选择类型">
            <el-option label="归集地址" value="collection" /><el-option label="收款地址" value="payment" /><el-option label="派奖地址" value="payout" /><el-option label="未知/其他" value="unknown" />
          </el-select>
        </el-form-item>
        <el-form-item label="钱包地址" prop="address"><el-input v-model="walletForm.address" placeholder="请输入钱包地址 (0x...)"></el-input></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">確認</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus';

export default {
  name: 'WalletMonitoringView',
  data() {
     return {
         loading: false,
         tableData: [],
         totalItems: 0,
         pagination: { page: 1, limit: 10 },
         searchParams: { name: '', type: '', address: '' },
         dialogVisible: false,
         dialogTitle: '',
         submitLoading: false,
         walletForm: { id: null, name: '', type: 'unknown', address: '' }, // 預設 type
         formRules: {
             name: [{ required: true, message: '请输入钱包名称', trigger: 'blur' }],
             type: [{ required: true, message: '请选择钱包类型', trigger: 'change' }],
             address: [
                 { required: true, message: '请输入钱包地址', trigger: 'blur' },
                 { pattern: /^0x[a-fA-F0-9]{40}$/, message: '请输入有效的以太坊地址', trigger: 'blur' }
             ],
         }
     }
  },
  created() {
      // (★★★ 確保 created 中呼叫的是 methods 中的 fetchWallets ★★★)
      this.fetchWallets();
  },
  methods: {
      async fetchWallets() {
          if (this.loading) return;
          this.loading = true;
          try {
              const params = {
                  ...this.pagination,
                  name: this.searchParams.name || undefined,
                  type: this.searchParams.type || undefined,
                  address: this.searchParams.address || undefined,
              };
              // (★★★ 確保 $api.getWallets 可用 ★★★)
              const response = await this.$api.getWallets(params);
              this.tableData = response.list;
              this.totalItems = response.total;
          } catch (error) { console.error('Failed to fetch wallets:', error); }
          finally { this.loading = false; }
      },
      handleSearch() {
          this.pagination.page = 1;
          this.fetchWallets();
      },
      handleSizeChange(newLimit) {
          this.pagination.limit = newLimit;
          this.pagination.page = 1;
          this.fetchWallets();
      },
      handlePageChange(newPage) {
          this.pagination.page = newPage;
          this.fetchWallets();
      },
      handleAdd() {
          this.dialogTitle = '新增監控錢包';
          Object.assign(this.walletForm, { id: null, name: '', type: 'unknown', address: '' });
          this.dialogVisible = true;
          this.$nextTick(() => { this.$refs.walletFormRef?.clearValidate(); });
      },
      handleEdit(row) {
          this.dialogTitle = '編輯監控錢包';
          Object.assign(this.walletForm, { id: row.id, name: row.name, type: row.type, address: row.address });
          this.dialogVisible = true;
          this.$nextTick(() => { this.$refs.walletFormRef?.clearValidate(); });
      },
      async handleSubmit() {
          const formEl = this.$refs.walletFormRef;
          if (!formEl) return;
          await formEl.validate(async (valid) => {
              if (valid) {
                  this.submitLoading = true;
                  try {
                      if (this.walletForm.id) {
                          await this.$api.updateWallet(this.walletForm.id, this.walletForm);
                          ElMessage.success('錢包更新成功');
                      } else {
                          await this.$api.addWallet(this.walletForm);
                          ElMessage.success('錢包新增成功');
                      }
                      this.dialogVisible = false;
                      this.fetchWallets();
                  } catch (error) { console.error('Failed to submit wallet:', error); }
                  finally { this.submitLoading = false; }
              } else { return false; }
          });
      },
      handleDelete(row) {
          ElMessageBox.confirm(`確定要刪除錢包 "${row.name}" (${row.address}) 嗎？`, '提示', { confirmButtonText: '確定', cancelButtonText: '取消', type: 'warning' })
          .then(async () => {
              try {
                  await this.$api.deleteWallet(row.id);
                  ElMessage.success('錢包刪除成功');
                  this.fetchWallets();
              } catch (error) { console.error('Failed to delete wallet:', error); }
          }).catch(() => {});
      },
      formatType(type) {
        const map = { collection: '归集地址', payment: '收款地址', payout: '派奖地址', unknown: '未知/其他' };
        return map[type] || type;
      },
      formatCurrency(value) {
        if (value === null || value === undefined || value === '查询失败') return value;
        if (typeof value === 'string') { try { value = parseFloat(value); } catch(e) { return '无效数值'; } }
        if (typeof value !== 'number') return '无效数值';
        return value.toFixed(8);
      }
  }
}
</script>

<style scoped>
.action-card { margin-bottom: 20px; }
.search-card { margin-bottom: 20px; }
.table-card { margin-bottom: 20px; }
.pagination-container { margin-top: 20px; display: flex; justify-content: flex-end; }
.el-form-item { margin-bottom: 10px; }
</style>