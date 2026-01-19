<template>
  <div class="page-container blocked-regions-container">
    <h2>阻挡地区设定</h2>
    <p class="page-description">在此处新增或刪除要阻挡的 IP 地址或 CIDR 范围。</p>

    <el-card shadow="never" class="add-card">
      <el-form ref="addFormRef" :model="addForm" :rules="addFormRules" :inline="true" @submit.native.prevent="handleAddRegion" class="search-form">
        <el-form-item label="IP / CIDR" prop="ip_range">
          <el-input v-model="addForm.ip_range" placeholder="例如: 1.2.3.4/32 或 1.2.3.0/24"></el-input>
        </el-form-item>
        <el-form-item label="描述 (选填)">
          <el-input v-model="addForm.description" placeholder="例如: 地区名称"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleAddRegion" :loading="addLoading">新增</el-button>
        </el-form-item>
      </el-form>
       <div class="form-tip">
          请使用 CIDR 格式。单一 IP 请使用 /32 结尾 (例如 1.2.3.4/32)。
       </div>
    </el-card>

    <el-card shadow="never" class="table-card" v-loading="loading">
       <template #header><div>已阻挡列表</div></template>
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
                   { pattern: /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/, message: '格式错误，请使用 CIDR (e.g., 1.2.3.4/32 or 1.2.3.0/24)', trigger: 'blur' }
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
                       ElMessage.success('阻挡地区新增成功');
                       formEl.resetFields(); // 清空表单
                       await this.fetchRegions(); // 刷新列表
                   } catch (error) { console.error('Failed to add region:', error); }
                   finally { this.addLoading = false; }
               } else { return false; }
           });
       },
       handleDelete(row) {
           ElMessageBox.confirm(`确定要刪除阻挡规則 "${row.ip_range}" 吗？`, '提示', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
           .then(async () => {
               try {
                   await this.$api.deleteBlockedRegion(row.id);
                   ElMessage.success('阻挡规則刪除成功');
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
  margin-bottom: 10px; /* 減少 inline form 的垂直间距 */
}
.form-tip {
  font-size: 12px;
  color: #909399;
  display: block; /* 让提示换行 */
  clear: both; /* 避免影响後面的元素 */
}

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