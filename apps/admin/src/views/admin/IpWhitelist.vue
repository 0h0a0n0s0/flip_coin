<template>
  <div class="page-container ip-whitelist-container">
    <h2>後台ip白名单</h2>
    <p class="page-description">
      <el-alert type="warning" show-icon :closable="false">
        <strong>警告：</strong> 此功能启用後，只有列表中的 IP 才能访问後台。
        <br>
        如果您不确定自己的公网 IP，请在新增前查询，并使用 /32 格式 (例如 123.123.123.123/32)。
        <br>
        如果白名单为空，則允许所有 IP 访问 (安全模式)。
      </el-alert>
    </p>
    <el-card shadow="never" class="add-card">
      <el-form ref="addFormRef" :model="addForm" :rules="addFormRules" :inline="true" @submit.native.prevent="handleAddIp" class="search-form">
        <el-form-item label="IP / CIDR" prop="ip_range">
          <el-input v-model="addForm.ip_range" placeholder="例如: 123.123.123.123/32"></el-input>
        </el-form-item>
        <el-form-item label="描述 (选填)">
           <el-input v-model="addForm.description" placeholder="例如: 办公室 IP"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleAddIp" :loading="addLoading">新增</el-button>
        </el-form-item>
      </el-form>
    </el-card>
    <el-card shadow="never" class="table-card" v-loading="loading">
       <template #header><div>IP 白名单列表</div></template>
      <el-table :data="tableData" style="width: 100%">
        <el-table-column prop="ip_range" label="IP / CIDR 范围" />
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="created_at" label="新增时间" width="180">
           <template #default="scope">{{ formatDateTime(scope.row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="scope">
            <div class="action-buttons-container">
              <el-button class="action-btn-delete" @click="handleDelete(scope.row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
<script>
// ( ... <script> 标签内的逻辑保持不变 ... )
import { ElMessage, ElMessageBox } from 'element-plus';
export default {
  name: 'IpWhitelistView',
   data() {
       return {
           loading: true, addLoading: false, tableData: [],
           addForm: { ip_range: '', description: '' },
           addFormRules: {
               ip_range: [
                   { required: true, message: '请输入 IP / CIDR', trigger: 'blur' },
                   { pattern: /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))$/, message: '格式错误，请使用 CIDR (e.g., 1.2.3.4/32)', trigger: 'blur' }
               ],
           }
       };
   },
   created() { this.fetchWhitelist(); },
   methods: {
       async fetchWhitelist() {
            this.loading = true;
            try {
                const response = await this.$api.getIpWhitelist();
                // (★★★ 修復：後端使用標準響應格式 { success: true, data: [...] } ★★★)
                if (response && response.success && response.data) {
                    this.tableData = Array.isArray(response.data) ? response.data : [];
                } else if (Array.isArray(response)) {
                    // 向後兼容：如果直接是數組
                    this.tableData = response;
                } else {
                    this.tableData = [];
                }
            } 
            catch (error) { console.error('Failed to fetch IP whitelist:', error); }
            finally { this.loading = false; }
       },
       async handleAddIp() {
           const formEl = this.$refs.addFormRef; if (!formEl) return;
           await formEl.validate(async (valid) => {
               if (valid) {
                   this.addLoading = true;
                   try {
                       await this.$api.addIpToWhitelist(this.addForm);
                       ElMessage.success('IP 新增成功');
                       formEl.resetFields();
                       await this.fetchWhitelist();
                   } catch (error) { console.error('Failed to add IP:', error); }
                   finally { this.addLoading = false; }
               } else { return false; }
           });
       },
       handleDelete(row) {
           ElMessageBox.confirm(`确定要刪除 IP 规則 "${row.ip_range}" 吗？`, '警告', { confirmButtonText: '确定刪除', cancelButtonText: '取消', type: 'warning' })
           .then(async () => {
               try {
                   await this.$api.deleteIpFromWhitelist(row.id);
                   ElMessage.success('IP 规則刪除成功');
                   await this.fetchWhitelist();
               } catch (error) { console.error('Failed to delete IP:', error); }
           }).catch(() => {});
       },
       formatDateTime(isoString) { 
           if (!isoString) return '';
           try { return new Date(isoString).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }); }
           catch (e) { return isoString; }
       }
   }
};
</script>
<style scoped>
.page-description { margin-bottom: 20px; }
.add-card { margin-bottom: 20px; }
.table-card { margin-bottom: 20px; }
.el-form-item { margin-bottom: 10px; }

/* (★★★ 修改 4: 新增 CSS 规則 ★★★) */
.search-form :deep(.el-input) {
  width: 180px;
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