<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2 class="page-title">钱包监控</h2>
        <p class="page-description">管理平台用于 充值、提現、开奖、归集 的热钱包地址。</p>
      </div>
    </div>

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
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button type="primary" @click="handleRefreshOnChainData" :loading="refreshLoading" style="margin-left: 8px;">
            刷新鏈上數據
          </el-button>
          <el-button class="add-wallet-btn" @click="handleAdd" style="margin-left: 8px;">新增钱包</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-table :data="tableData" style="width: 100%" :cell-style="{ paddingTop: '8px', paddingBottom: '8px' }">
        <el-table-column prop="name" label="钱包名称" width="180" />
        <el-table-column prop="chain_type" label="公链类型" width="120" />
        <el-table-column label="钱包地址">
          <template #default="scope">
            {{ scope.row.address_masked || scope.row.address }}
          </template>
        </el-table-column>
        
        <el-table-column label="功能" width="150">
          <template #default="scope">
            <el-tag v-if="scope.row.is_gas_reserve" type="success" effect="dark" class="fn-tag">Gas 储备</el-tag>
            <el-tag v-if="scope.row.is_collection" type="danger" effect="dark" class="fn-tag">归集</el-tag>
            <el-tag v-if="scope.row.is_payout" type="warning" effect="dark" class="fn-tag">自动出款</el-tag>
            <el-tag v-if="scope.row.is_energy_provider" type="info" effect="dark" class="fn-tag">能量租賃</el-tag>
            <el-tag v-if="scope.row.is_opener_a" class="fn-tag">开奖A</el-tag>
            <el-tag v-if="scope.row.is_opener_b" class="fn-tag">开奖B</el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="USDT" width="120" align="left">
          <template #default="scope">
            {{ getDisplayValue(scope.row, 'usdt') }}
          </template>
        </el-table-column>
        
        <el-table-column label="TRX" width="120" align="left">
          <template #default="scope">
            {{ getDisplayValue(scope.row, 'trx') }}
          </template>
        </el-table-column>
        
        <el-table-column label="質押 (Staked)" width="130" align="left">
          <template #default="scope">
            {{ getDisplayValue(scope.row, 'staked') }}
          </template>
        </el-table-column>
        
        <el-table-column label="能量 (Energy)" width="130" align="left">
          <template #default="scope">
            {{ getDisplayValue(scope.row, 'energy') }}
          </template>
        </el-table-column>
        
        <el-table-column prop="is_active" label="狀态" width="100">
           <template #default="scope">
             <el-tag :type="scope.row.is_active ? 'success' : 'danger'">
               {{ scope.row.is_active ? '启用' : '禁用' }}
             </el-tag>
           </template>
        </el-table-column>
        
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="scope">
            <div class="action-buttons-container">
              <el-button type="primary" class="action-btn-edit" @click="handleEdit(scope.row)">
                编辑
              </el-button>
              <el-button type="danger" class="action-btn-delete" @click="handleDelete(scope.row)">
                删除
              </el-button>
              <el-button v-if="scope.row.is_collection" class="action-btn-collect" @click="handleManualCollection(scope.row)">
                归集
              </el-button>
            </div>
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
           <el-checkbox v-model="walletForm.is_energy_provider" label="能量租賃" />
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
          
          <el-divider content-position="left">扫描策略（系统每小时自动执行）</el-divider>
          
          <el-form-item label="每次执行扫描用户数量" prop="batch_size" label-width="180px">
            <el-input-number 
              v-model="walletForm.batch_size" 
              :min="50" 
              :max="2000" 
              :step="50"
              style="width: 200px;"
              placeholder="批次大小"
              disabled
            />
            <div class="form-tip">每次归集任务扫描的用户数量（固定配置：500 用户/次）</div>
          </el-form-item>
          
          <el-form-item label="用户多少天无充值时触发归集" prop="days_without_deposit" label-width="220px">
            <el-input-number 
              v-model="walletForm.days_without_deposit" 
              :min="1" 
              :max="365" 
              style="width: 200px;"
              placeholder="天数"
            />
            <div class="form-tip">用户最后一笔充值后多少天无新充值，则执行归集</div>
          </el-form-item>
          
          <el-divider content-position="left">能量管理</el-divider>
          
          <el-form-item label="归集钱包最低能量阈值" prop="min_energy" label-width="200px">
            <el-input-number 
              v-model="walletForm.min_energy" 
              :min="10000" 
              :max="100000" 
              :step="5000"
              style="width: 200px;"
              placeholder="能量值"
            />
            <div class="form-tip">当归集钱包能量低于此值时停止归集（建议：30000-40000）</div>
          </el-form-item>
          
          <el-divider content-position="left">性能参数（预留）</el-divider>
          
          <el-form-item label="最大并发归集交易数" prop="max_concurrency" label-width="180px">
            <el-input-number 
              v-model="walletForm.max_concurrency" 
              :min="1" 
              :max="20" 
              style="width: 200px;"
              placeholder="并发数"
            />
            <div class="form-tip">同时执行的最大归集交易数（当前版本暂未启用）</div>
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
         refreshLoading: false,
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
           is_energy_provider: false,
           is_active: true,
           scan_interval_days: 1,
           days_without_deposit: 7,
           batch_size: 500,
           min_energy: 35000,
           max_concurrency: 1
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
      formatNum(v) {
          const n = Number(v || 0);
          if (!Number.isFinite(n)) return '0';
          return n.toLocaleString('zh-CN', { maximumFractionDigits: 6 });
      },
      formatInt(v) {
          const n = Number(v || 0);
          if (!Number.isFinite(n)) return '0';
          return Math.floor(n).toLocaleString('zh-CN');
      },
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
              // (★★★ 修復：後端使用標準響應格式 { success: true, data: { total, list } } ★★★)
              let list = [];
              let total = 0;
              if (response && response.success && response.data) {
                  list = response.data.list || [];
                  total = response.data.total || 0;
              } else {
                  // 向後兼容：如果沒有標準格式，直接使用 response
                  list = response.list || [];
                  total = response.total || 0;
              }
              
              // 過濾掉 HD_WALLET_INDEX_TRACKER 系統內部記錄
              this.tableData = list.filter(row => row.name !== 'HD_WALLET_INDEX_TRACKER');
              // 調整總數（如果過濾掉了記錄，總數也需要相應調整）
              const filteredCount = list.length - this.tableData.length;
              this.totalItems = Math.max(0, total - filteredCount);
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
           is_energy_provider: false,
           is_active: true,
           scan_interval_days: 1,
           days_without_deposit: 7,
           batch_size: 500,
           min_energy: 35000,
           max_concurrency: 1
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
             is_energy_provider: row.is_energy_provider || false,
             is_active: row.is_active,
             // 直接從 row 獲取 collection settings（後端已 JOIN）
             scan_interval_days: row.scan_interval_days || 1,
             days_without_deposit: row.days_without_deposit || 7,
             batch_size: row.batch_size || 500,
             min_energy: row.min_energy || 35000,
             max_concurrency: row.max_concurrency || 1
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
                      if (this.walletForm.id) {
                          // 後端會自動處理 collection_settings 的更新（如果 is_collection=true）
                          await this.$api.updateWallet(this.walletForm.id, this.walletForm);
                          ElMessage.success('钱包更新成功');
                      } else {
                          await this.$api.addWallet(this.walletForm);
                          
                          // 如果是归集钱包，創建归集设定（新增時需要單獨調用）
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
      /**
       * @description 根據錢包角色判斷是否應該顯示某個欄位的值
       * @param {Object} row - 表格行數據
       * @param {string} field - 欄位名稱 ('usdt', 'trx', 'staked', 'energy')
       * @returns {string} 顯示值或 '-'
       */
      getDisplayValue(row, field) {
          // HD Tracker 或特殊行顯示 '-'
          if (row.name === 'HD_WALLET_INDEX_TRACKER' || !row.address || !row.address.startsWith('T')) {
              return '-';
          }

          // 獲取鏈上餘額數據
          const onChainData = row.onChainData || {};
          const value = onChainData[field] !== undefined ? onChainData[field] : null;

          // 如果沒有數據，顯示 '-'
          if (value === null || value === undefined) {
              return '-';
          }

          // 根據角色判斷是否顯示
          const isCollection = row.is_collection;
          const isGasReserve = row.is_gas_reserve;
          const isEnergyProvider = row.is_energy_provider;
          const isPayout = row.is_payout;
          const isOpener = row.is_opener_a || row.is_opener_b;

          switch (field) {
              case 'usdt':
                  // Collection, Gas Reserve, Energy Provider, Payout, Opener 都顯示 USDT
                  if (isCollection || isGasReserve || isEnergyProvider || isPayout || isOpener) {
                      return this.formatNum(value);
                  }
                  return '-';

              case 'trx':
                  // Collection, Gas Reserve, Energy Provider, Payout, Opener 都顯示 TRX
                  if (isCollection || isGasReserve || isEnergyProvider || isPayout || isOpener) {
                      return this.formatNum(value);
                  }
                  return '-';

              case 'staked':
                  // 只有 Energy Provider 顯示質押
                  if (isEnergyProvider) {
                      return this.formatNum(value);
                  }
                  return '-';

              case 'energy':
                  // Collection, Energy Provider, Payout, Opener 顯示能量
                  if (isCollection || isEnergyProvider || isPayout || isOpener) {
                      return this.formatInt(value);
                  }
                  return '-';

              default:
                  return '-';
          }
      },
      /**
       * @description 刷新當前頁面的鏈上數據
       */
      async handleRefreshOnChainData() {
          if (this.refreshLoading) return;

          // 提取當前頁面的有效錢包地址
          const validWallets = this.tableData
              .filter(row => row.address && row.address.startsWith('T') && row.name !== 'HD_WALLET_INDEX_TRACKER')
              .map(row => ({
                  address: row.address,
                  type: row.chain_type
              }));

          if (validWallets.length === 0) {
              ElMessage.warning('當前頁面沒有有效的 TRC20 錢包地址');
              return;
          }

          this.refreshLoading = true;
          try {
              const response = await this.$api.fetchOnChainBalances(validWallets);
              if (response && response.success && response.data) {
                  // 創建地址到餘額的映射
                  const balanceMap = {};
                  response.data.forEach(item => {
                      balanceMap[item.address] = {
                          usdt: item.usdt,
                          trx: item.trx,
                          staked: item.staked,
                          energy: item.energy
                      };
                  });

                  // 更新表格數據
                  this.tableData = this.tableData.map(row => {
                      if (balanceMap[row.address]) {
                          return {
                              ...row,
                              onChainData: balanceMap[row.address]
                          };
                      }
                      return row;
                  });

                  ElMessage.success(`成功刷新 ${response.data.length} 個錢包的鏈上數據`);
              } else {
                  ElMessage.error('刷新鏈上數據失敗');
              }
          } catch (error) {
              console.error('Failed to refresh on-chain data:', error);
              ElMessage.error('刷新鏈上數據失敗：' + (error.response?.data?.error || error.message));
          } finally {
              this.refreshLoading = false;
          }
      },
      /**
       * @description 記錄歸集按鈕檢查（用於調試）
       */
      logCollectionCheck(row) {
          // #region agent log
          const isCollection = !!row.is_collection;
          const isStrictTrue = row.is_collection === true;
          console.log('[DEBUG] WalletMonitoring - is_collection check:', {
              walletName: row.name,
              is_collection: row.is_collection,
              is_collectionType: typeof row.is_collection,
              is_collectionTruthy: isCollection,
              isStrictTrue: isStrictTrue,
              rawValue: row.is_collection
          });
          fetch('http://127.0.0.1:7242/ingest/14db9cbb-ee24-417b-9eeb-3494fd0c6cdc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'WalletMonitoring.vue:logCollectionCheck',message:'檢查 is_collection 值',data:{walletName:row.name,is_collection:row.is_collection,is_collectionType:typeof row.is_collection,is_collectionTruthy:isCollection,isStrictTrue,rawValue:row.is_collection},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          return true; // 返回 true 以確保元素渲染（用於觸發日誌）
      },
      /**
       * @description 檢查是否應該顯示歸集按鈕
       */
      shouldShowCollectionButton(row) {
          if (!row) return false;
          const result = !!row.is_collection;
          // #region agent log
          console.log('[DEBUG] shouldShowCollectionButton:', {
              walletName: row.name,
              is_collection: row.is_collection,
              result: result
          });
          // #endregion
          return result;
      },
      /**
       * @description 手動觸發歸集
       */
      async handleManualCollection(row) {
          try {
              await ElMessageBox.confirm(
                  '是否要手動進行一次歸集？',
                  '確認歸集',
                  {
                      confirmButtonText: '確定',
                      cancelButtonText: '取消',
                      type: 'warning'
                  }
              );

              try {
                  await this.$api.manualCollection();
                  ElMessage.success('後台任務已啟動，請留意右上角通知');
              } catch (error) {
                  console.error('Failed to trigger manual collection:', error);
                  ElMessage.error('觸發歸集失敗：' + (error.response?.data?.error || error.message));
              }
          } catch (error) {
              // 用戶取消操作
              if (error !== 'cancel') {
                  console.error('Manual collection error:', error);
              }
          }
      },
  }
}
</script>

<style scoped>
.fn-tag {
  margin-right: 6px;
  margin-bottom: 4px;
}

.el-checkbox {
  margin-right: 15px;
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

.add-wallet-btn {
  background-color: #87CEEB;
  border-color: #87CEEB;
  color: #fff;
}

.add-wallet-btn:hover {
  background-color: #6BB6FF;
  border-color: #6BB6FF;
}

.add-wallet-btn:active {
  background-color: #5AA3E6;
  border-color: #5AA3E6;
}

/* 確保操作欄中的按鈕文本可見 - 強制覆蓋全局白色樣式 */
.table-card :deep(.el-table .el-button.is-link),
.table-card :deep(.el-table .el-button--primary.is-link),
.table-card :deep(.el-table .el-button--danger.is-link),
.table-card :deep(.el-table .el-button--warning.is-link) {
  color: inherit !important;
}

.table-card :deep(.el-table .el-button--primary.is-link) {
  color: #409eff !important;
}

.table-card :deep(.el-table .el-button--danger.is-link) {
  color: #f56c6c !important;
}

.table-card :deep(.el-table .el-button--warning.is-link) {
  color: #e6a23c !important;
}

/* 確保按鈕內的 span 文本可見 - 強制顯示 */
.table-card :deep(.el-table .el-button.is-link span),
.table-card :deep(.el-table .el-button--primary.is-link span),
.table-card :deep(.el-table .el-button--danger.is-link span),
.table-card :deep(.el-table .el-button--warning.is-link span) {
  color: inherit !important;
  display: inline-block !important;
  visibility: visible !important;
  opacity: 1 !important;
  font-size: 14px !important;
  line-height: 1.5 !important;
}

.table-card :deep(.el-table .el-button--primary.is-link span) {
  color: #409eff !important;
}

.table-card :deep(.el-table .el-button--danger.is-link span) {
  color: #f56c6c !important;
}

.table-card :deep(.el-table .el-button--warning.is-link span) {
  color: #e6a23c !important;
}

/* 操作欄位按鈕容器 - 參考用戶列表樣式 */
.action-buttons-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-start;
}

/* 操作欄位按鈕樣式 */
.action-btn-edit {
  background-color: #409eff !important;
  border-color: #409eff !important;
  color: #ffffff !important;
  margin: 0 !important;
}

.action-btn-edit:hover {
  background-color: #66b1ff !important;
  border-color: #66b1ff !important;
  color: #ffffff !important;
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

.action-btn-collect {
  background-color: #e6a23c !important;
  border-color: #e6a23c !important;
  color: #ffffff !important;
  margin: 0 !important;
}

.action-btn-collect:hover {
  background-color: #ebb563 !important;
  border-color: #ebb563 !important;
  color: #ffffff !important;
}
</style>