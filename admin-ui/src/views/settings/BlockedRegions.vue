<template>
  <div class="blocked-regions-container">
    <h2>阻擋地區設定</h2>
    <p class="page-description">在此處新增或刪除要阻擋的 IP 地址或 CIDR 範圍。</p>

    <el-card shadow="never" class="add-card">
      <el-form ref="addFormRef" :model="addForm" :rules="addFormRules" :inline="true" @submit.native.prevent="handleAddRegion" class="search-form">
        <el-form-item label="IP / CIDR" prop="ip_range">
          <el-input v-model="addForm.ip_range" placeholder="例如: 1.2.3.4/32 或 1.2.3.0/24"></el-input>
        </el-form-item>
        <el-form-item label="描述 (選填)">
          <el-input v-model="addForm.description" placeholder="例如: 地區名稱"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleAddRegion" :loading="addLoading">新增</el-button>
        </el-form-item>
      </el-form>
       <div class="form-tip">
          請使用 CIDR 格式。單一 IP 請使用 /32 結尾 (例如 1.2.3.4/32)。
       </div>
    </el-card>

    <el-card shadow="never" class="table-card" v-loading="loading">
       <template #header><div>已阻擋列表</div></template>
      <el-table :data="tableData" style="width: 100%">
        <el-table-column prop="ip_range" label="IP / CIDR 範圍" />
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="created_at" label="新增時間" width="180">
           <template #default="scope">{{ formatDateTime(scope.row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="scope">
            <el-button type="danger" link @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
       </el-card>
  </div>
</template>

<script>
// ( ... <script> 標籤內的邏輯保持不變 ... )
import { ElMessage, ElMessageBox } from 'element-plus';

export default {
  name: 'BlockedRegionsView',
   data() {
       return {
           loading: true,
           addLoading: false,
           tableData: [],
           addForm: {
               ip_range: '',
               description: '',
           },
           addFormRules: {
               ip_range: [
                   { required: true, message: '请输入 IP / CIDR', trigger: 'blur' },
                   { pattern: /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/, message: '格式錯誤，請使用 CIDR (e.g., 1.2.3.4/32 or 1.2.3.0/24)', trigger: 'blur' }
               ],
           }
       };
   },
   created() {
       this.fetchRegions();
   },
   methods: {
       async fetchRegions() {
            this.loading = true;
            try {
                this.tableData = await this.$api.getBlockedRegions();
            } catch (error) { console.error('Failed to fetch blocked regions:', error); }
            finally { this.loading = false; }
       },
       async handleAddRegion() {
           const formEl = this.$refs.addFormRef;
           if (!formEl) return;
           await formEl.validate(async (valid) => {
               if (valid) {
                   this.addLoading = true;
                   try {
                       await this.$api.addBlockedRegion(this.addForm);
                       ElMessage.success('阻擋地區新增成功');
                       formEl.resetFields(); // 清空表單
                       await this.fetchRegions(); // 刷新列表
                   } catch (error) { console.error('Failed to add region:', error); }
                   finally { this.addLoading = false; }
               } else { return false; }
           });
       },
       handleDelete(row) {
           ElMessageBox.confirm(`確定要刪除阻擋規則 "${row.ip_range}" 嗎？`, '提示', { confirmButtonText: '確定', cancelButtonText: '取消', type: 'warning' })
           .then(async () => {
               try {
                   await this.$api.deleteBlockedRegion(row.id);
                   ElMessage.success('阻擋規則刪除成功');
                   await this.fetchRegions(); // 刷新列表
               } catch (error) { console.error('Failed to delete region:', error); }
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
.page-description {
  color: #909399;
  font-size: 14px;
  margin-bottom: 20px;
}
.add-card {
  margin-bottom: 20px;
}
.table-card {
  margin-bottom: 20px;
}
.el-form-item {
  margin-bottom: 10px; /* 減少 inline form 的垂直間距 */
}
.form-tip {
  font-size: 12px;
  color: #909399;
  display: block; /* 讓提示換行 */
  clear: both; /* 避免影響後面的元素 */
}

/* (★★★ 修改 4: 新增 CSS 規則 ★★★) */
.search-form :deep(.el-input) {
  width: 180px;
}
</style>