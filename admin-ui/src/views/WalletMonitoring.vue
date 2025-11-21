<template>
  <div class="wallet-monitoring-container">
    <h2>钱包监控</h2> <p class="page-description">管理平台用于 充值、提現、开奖、归集 的热钱包地址。</p>

    <el-card shadow="never" class="action-card">
       <el-button type="primary" @click="handleAdd">新增钱包</el-button>
    </el-card>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch" class="search-form">
        <el-form-item label="钱包名称"><el-input v-model="searchParams.name" placeholder="名称 (模糊)" clearable></el-input></el-form-item>
        <el-form-item label="公链类型">
          <el-select v-model="searchParams.chain_type" placeholder="选择公链" clearable>
            <el-option label="全部" value="" />
            <el-option label="BSC (BEP20)" value="BSC" />
            <el-option label="TRON (TRC20)" value="TRC20" />
            <el-option label="ETH (ERC20)" value="ETH" />
            <el-option label="Polygon" value="POLYGON" />
            <el-option label="Solana" value="SOL" />
          </el-select>
        </el-form-item>
        <el-form-item label="钱包地址"><el-input v-model="searchParams.address" placeholder="地址 (精确)" clearable></el-input></el-form-item>
        <el-form-item><el-button type="primary" @click="handleSearch">查询</el-button></el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-table :data="tableData" style="width: 100%">
        <el-table-column prop="name" label="钱包名称" width="180" />
        <el-table-column prop="chain_type" label="公链类型" width="120" />
        <el-table-column label="钱包地址">
          <template #default="scope">
            {{ scope.row.address_masked || scope.row.address }}
          </template>
        </el-table-column>
        
        <el-table-column label="功能" width="420">
          <template #default="scope">
            <el-tag v-if="scope.row.is_gas_reserve" type="success" effect="dark" class="fn-tag">Gas 储备</el-tag>
            <el-tag v-if="scope.row.is_collection" type="danger" effect="dark" class="fn-tag">归集</el-tag>
            <el-tag v-if="scope.row.is_payout" type="warning" effect="dark" class="fn-tag">自动出款</el-tag> <el-tag v-if="scope.row.is_opener_a" class="fn-tag">开奖A</el-tag>
            <el-tag v-if="scope.row.is_opener_b" class="fn-tag">开奖B</el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="is_active" label="狀态" width="100">
           <template #default="scope">
             <el-tag :type="scope.row.is_active ? 'success' : 'danger'">
               {{ scope.row.is_active ? '启用' : '禁用' }}
             </el-tag>
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
        <el-form-item label="公链类型" prop="chain_type">
          <el-select v-model="walletForm.chain_type" placeholder="请选择公链">
            <el-option label="BSC (BEP20)" value="BSC" />
            <el-option label="TRON (TRC20)" value="TRC20" />
            <el-option label="ETH (ERC20)" value="ETH" />
            <el-option label="Polygon" value="POLYGON" />
            <el-option label="Solana" value="SOL" />
          </el-select>
        </el-form-item>
        <el-form-item label="钱包地址" prop="address"><el-input v-model="walletForm.address" placeholder="请输入钱包地址 (T... 或 0x... 或 Sol...)"></el-input></el-form-item>
        
        <el-divider />
        
        <el-form-item label="钱包功能" prop="functions">
           <el-checkbox v-model="walletForm.is_gas_reserve" label="Gas 储备 (TRX/BNB)" />
           <el-checkbox v-model="walletForm.is_collection" label="归集 (USDT)" />
           <el-checkbox v-model="walletForm.is_payout" label="自动出款 (USDT)" />
        </el-form-item>
         <el-form-item label="开奖功能" prop="opener">
           <el-checkbox v-model="walletForm.is_opener_a" label="开奖地址 A (支付方)" />
           <el-checkbox v-model="walletForm.is_opener_b" label="开奖地址 B (接收方)" />
        </el-form-item>
        <el-form-item label="钱包狀态" prop="is_active">
           <el-switch
              v-model="walletForm.is_active"
              active-text="启用"
              inactive-text="禁用"
              inline-prompt
            />
        </el-form-item>

        <!-- (★★★ 归集参数设定区块 ★★★) -->
        <el-divider v-if="walletForm.is_collection" />
        <div v-if="walletForm.is_collection" class="collection-settings-block">
          <h4>归集参数设定</h4>
          <el-form-item label="每x天扫描一次" prop="scan_interval_days">
            <el-input-number 
              v-model="walletForm.scan_interval_days" 
              :min="1" 
              :max="30" 
              style="width: 200px;"
              placeholder="天数"
            />
            <div class="form-tip">每隔多少天执行一次归集扫描</div>
          </el-form-item>
          <el-form-item label="用户n天無充值时归集" prop="days_without_deposit">
            <el-input-number 
              v-model="walletForm.days_without_deposit" 
              :min="1" 
              :max="365" 
              style="width: 200px;"
              placeholder="天数"
            />
            <div class="form-tip">用户最後一笔充值後多少天無新充值，則执行归集</div>
          </el-form-item>
        </div>

      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
// ( ... <script> 标签内的逻辑保持不变 ... )
import { ElMessage, ElMessageBox } from 'element-plus';

export default {
  name: 'WalletMonitoringView',
  data() {
     return {
         loading: false,
         tableData: [],
         totalItems: 0,
         pagination: { page: 1, limit: 10 },
         searchParams: { name: '', chain_type: '', address: '' },
         
         dialogVisible: false,
         dialogTitle: '',
         submitLoading: false,
         
         walletForm: { 
           id: null, name: '', chain_type: 'TRC20', address: '',
           is_gas_reserve: false, 
           is_collection: false,
           is_opener_a: false, 
           is_opener_b: false,
           is_payout: false,
           is_active: true,
           scan_interval_days: 1,
           days_without_deposit: 7
         },
         
         formRules: {
             name: [{ required: true, message: '请输入钱包名称', trigger: 'blur' }],
             chain_type: [{ required: true, message: '请选择公链类型', trigger: 'change' }],
             address: [
                 { required: true, message: '请输入钱包地址', trigger: 'blur' },
             ],
         }
     }
  },
  created() {
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
                  chain_type: this.searchParams.chain_type || undefined,
                  address: this.searchParams.address || undefined,
              };
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
      getEmptyForm() {
        return { 
           id: null, name: '', chain_type: 'TRC20', address: '',
           is_gas_reserve: false, 
           is_collection: false,
           is_opener_a: false, 
           is_opener_b: false,
           is_payout: false,
           is_active: true,
           scan_interval_days: 1,
           days_without_deposit: 7
         };
      },
      handleAdd() {
          this.dialogTitle = '新增平台钱包';
          Object.assign(this.walletForm, this.getEmptyForm());
          this.dialogVisible = true;
          this.$nextTick(() => { this.$refs.walletFormRef?.clearValidate(); });
      },
      async handleEdit(row) {
          this.dialogTitle = '编辑平台钱包';
          Object.assign(this.walletForm, {
             id: row.id, name: row.name, chain_type: row.chain_type, address: row.address,
             is_gas_reserve: row.is_gas_reserve, 
             is_collection: row.is_collection,
             is_opener_a: row.is_opener_a, 
             is_opener_b: row.is_opener_b,
             is_payout: row.is_payout,
             is_active: row.is_active,
             scan_interval_days: 1,
             days_without_deposit: 7
          });
          
          // 如果是归集钱包，载入归集设定
          if (row.is_collection && row.address) {
              try {
                  const settings = await this.$api.getCollectionSettings();
                  const walletSetting = settings.find(s => s.collection_wallet_address === row.address);
                  if (walletSetting) {
                      this.walletForm.scan_interval_days = walletSetting.scan_interval_days;
                      this.walletForm.days_without_deposit = walletSetting.days_without_deposit;
                  }
              } catch (error) {
                  console.error('Failed to load collection settings:', error);
              }
          }
          
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
                          
                          // 如果是归集钱包，更新归集设定
                          if (this.walletForm.is_collection && this.walletForm.address) {
                              try {
                                  await this.$api.updateCollectionSettings({
                                      collection_wallet_address: this.walletForm.address,
                                      scan_interval_days: this.walletForm.scan_interval_days,
                                      days_without_deposit: this.walletForm.days_without_deposit,
                                      is_active: true
                                  });
                              } catch (error) {
                                  console.error('Failed to update collection settings:', error);
                              }
                          }
                          
                          ElMessage.success('钱包更新成功');
                      } else {
                          await this.$api.addWallet(this.walletForm);
                          
                          // 如果是归集钱包，創建归集设定
                          if (this.walletForm.is_collection && this.walletForm.address) {
                              try {
                                  await this.$api.updateCollectionSettings({
                                      collection_wallet_address: this.walletForm.address,
                                      scan_interval_days: this.walletForm.scan_interval_days,
                                      days_without_deposit: this.walletForm.days_without_deposit,
                                      is_active: true
                                  });
                              } catch (error) {
                                  console.error('Failed to create collection settings:', error);
                              }
                          }
                          
                          ElMessage.success('钱包新增成功');
                      }
                      this.dialogVisible = false;
                      this.fetchWallets();
                  } catch (error) { 
                      console.error('Failed to submit wallet:', error);
                      ElMessage.error('操作失败：' + (error.response?.data?.error || error.message));
                  }
                  finally { this.submitLoading = false; }
              } else { return false; }
          });
      },
      handleDelete(row) {
          ElMessageBox.confirm(`确定要刪除钱包 "${row.name}" (${row.address}) 吗？`, '提示', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
          .then(async () => {
              try {
                  await this.$api.deleteWallet(row.id);
                  ElMessage.success('钱包刪除成功');
                  this.fetchWallets();
              } catch (error) { console.error('Failed to delete wallet:', error); }
          }).catch(() => {});
      },
  }
}
</script>

<style scoped>
.page-description { color: #909399; font-size: 14px; margin-bottom: 20px; }
.action-card { margin-bottom: 20px; }
.search-card { margin-bottom: 20px; }
.table-card { margin-bottom: 20px; }
.pagination-container { margin-top: 20px; display: flex; justify-content: flex-end; }
.el-form-item { margin-bottom: 10px; }
.fn-tag {
  margin-right: 5px;
}
.el-checkbox {
  margin-right: 15px;
}

/* (★★★ 修改 2: 新增 CSS 规則 ★★★) */
.search-form :deep(.el-input) {
  width: 180px;
}
.search-form :deep(.el-select) {
  width: 180px;
}

.collection-settings-block {
  margin-top: 20px;
  padding: 20px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.collection-settings-block h4 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #303133;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
  line-height: 1.4;
}
</style>