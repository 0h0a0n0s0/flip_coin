<template>
  <div class="wallet-monitoring-container">
    <h2>錢包監控</h2>
    <p class="page-description">管理平台用於 充值、提現、開獎、歸集 的熱錢包地址。</p>

    <el-card shadow="never" class="action-card">
       <el-button type="primary" @click="handleAdd">新增錢包</el-button>
    </el-card>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch">
        <el-form-item label="钱包名称"><el-input v-model="searchParams.name" placeholder="名称 (模糊)" clearable></el-input></el-form-item>
        <el-form-item label="公鏈類型">
          <el-select v-model="searchParams.chain_type" placeholder="选择公鏈" clearable>
            <el-option label="全部" value="" />
            <el-option label="BSC (BEP20)" value="BSC" />
            <el-option label="TRON (TRC20)" value="TRC20" />
            <el-option label="ETH (ERC20)" value="ETH" />
            <el-option label="Polygon" value="POLYGON" />
            <el-option label="Solana" value="SOL" />
          </el-select>
        </el-form-item>
        <el-form-item label="钱包地址"><el-input v-model="searchParams.address" placeholder="地址 (精确)" clearable></el-input></el-form-item>
        <el-form-item><el-button type="primary" @click="handleSearch">查詢</el-button></el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-table :data="tableData" style="width: 100%">
        <el-table-column prop="name" label="钱包名称" width="180" />
        <el-table-column prop="chain_type" label="公鏈類型" width="120" />
        <el-table-column prop="address" label="钱包地址" />
        <el-table-column label="功能" width="350">
          <template #default="scope">
            <el-tag v-if="scope.row.is_deposit" type="success" effect="dark" class="fn-tag">充值</el-tag>
            <el-tag v-if="scope.row.is_payout" type="warning" effect="dark" class="fn-tag">提現</el-tag>
            <el-tag v-if="scope.row.is_bonus" type="info" effect="dark" class="fn-tag">獎金</el-tag>
            <el-tag v-if="scope.row.is_collection" type="danger" effect="dark" class="fn-tag">歸集</el-tag>
            <el-tag v-if="scope.row.is_opener_a" class="fn-tag">開獎A</el-tag>
            <el-tag v-if="scope.row.is_opener_b" class="fn-tag">開獎B</el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="100" fixed="right">
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="700px" :close-on-click-modal="false">
      <el-form ref="walletFormRef" :model="walletForm" :rules="formRules" label-width="100px">
        <el-form-item label="钱包名称" prop="name"><el-input v-model="walletForm.name" placeholder="请输入钱包名称"></el-input></el-form-item>
        <el-form-item label="公鏈類型" prop="chain_type">
          <el-select v-model="walletForm.chain_type" placeholder="请选择公鏈">
            <el-option label="BSC (BEP20)" value="BSC" />
            <el-option label="TRON (TRC20)" value="TRC20" />
            <el-option label="ETH (ERC20)" value="ETH" />
            <el-option label="Polygon" value="POLYGON" />
            <el-option label="Solana" value="SOL" />
          </el-select>
        </el-form-item>
        <el-form-item label="钱包地址" prop="address"><el-input v-model="walletForm.address" placeholder="请输入錢包地址 (T... 或 0x... 或 Sol...)"></el-input></el-form-item>
        
        <el-divider />
        
        <el-form-item label="錢包功能" prop="functions">
           <el-checkbox v-model="walletForm.is_deposit" label="充值 (用戶入金)" />
           <el-checkbox v-model="walletForm.is_payout" label="提現 (用戶出金)" />
           <el-checkbox v-model="walletForm.is_bonus" label="獎金 (等級/活動)" />
           <el-checkbox v-model="walletForm.is_collection" label="歸集 (最終收款)" />
        </el-form-item>
         <el-form-item label="開獎功能" prop="opener">
           <el-checkbox v-model="walletForm.is_opener_a" label="開獎地址 A (支付方)" />
           <el-checkbox v-model="walletForm.is_opener_b" label="開獎地址 B (接收方)" />
        </el-form-item>

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
         // (★★★ v6 修改：searchParams ★★★)
         searchParams: { name: '', chain_type: '', address: '' },
         
         dialogVisible: false,
         dialogTitle: '',
         submitLoading: false,
         
         // (★★★ v6 修改：walletForm ★★★)
         walletForm: { 
           id: null, name: '', chain_type: 'BSC', address: '',
           is_deposit: false, is_payout: false, is_bonus: false, is_collection: false,
           is_opener_a: false, is_opener_b: false
         },
         
         // (★★★ v6 修改：formRules ★★★)
         formRules: {
             name: [{ required: true, message: '请输入钱包名称', trigger: 'blur' }],
             chain_type: [{ required: true, message: '请选择公鏈類型', trigger: 'change' }],
             address: [
                 { required: true, message: '请输入钱包地址', trigger: 'blur' },
                 // (移除 0x 驗證)
             ],
         }
     }
  },
  created() {
      this.fetchWallets();
  },
  methods: {
      // (★★★ v6 修改：fetchWallets ★★★)
      async fetchWallets() {
          if (this.loading) return;
          this.loading = true;
          try {
              const params = {
                  ...this.pagination,
                  name: this.searchParams.name || undefined,
                  chain_type: this.searchParams.chain_type || undefined, // (v6 修改)
                  address: this.searchParams.address || undefined,
              };
              const response = await this.$api.getWallets(params);
              this.tableData = response.list;
              this.totalItems = response.total;
              // (★★★ v6 移除：餘額查詢 ★★★)
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
      // (★★★ v6 修改：handleAdd ★★★)
      getEmptyForm() {
        return { 
           id: null, name: '', chain_type: 'BSC', address: '',
           is_deposit: false, is_payout: false, is_bonus: false, is_collection: false,
           is_opener_a: false, is_opener_b: false
         };
      },
      handleAdd() {
          this.dialogTitle = '新增監控錢包';
          Object.assign(this.walletForm, this.getEmptyForm());
          this.dialogVisible = true;
          this.$nextTick(() => { this.$refs.walletFormRef?.clearValidate(); });
      },
      // (★★★ v6 修改：handleEdit ★★★)
      handleEdit(row) {
          this.dialogTitle = '編輯監控錢包';
          // (複製所有欄位)
          Object.assign(this.walletForm, {
             id: row.id, name: row.name, chain_type: row.chain_type, address: row.address,
             is_deposit: row.is_deposit, is_payout: row.is_payout, is_bonus: row.is_bonus, 
             is_collection: row.is_collection,
             is_opener_a: row.is_opener_a, is_opener_b: row.is_opener_b
          });
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
                      // (walletForm 已包含所有新欄位)
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
      // (★★★ v6 移除：formatType, formatCurrency ★★★)
  }
}
</script>

<style scoped>
.action-card { margin-bottom: 20px; }
.search-card { margin-bottom: 20px; }
.table-card { margin-bottom: 20px; }
.pagination-container { margin-top: 20px; display: flex; justify-content: flex-end; }
.el-form-item { margin-bottom: 10px; }
/* (★★★ v6 新增 ★★★) */
.fn-tag {
  margin-right: 5px;
}
.el-checkbox {
  margin-right: 15px;
}
</style>