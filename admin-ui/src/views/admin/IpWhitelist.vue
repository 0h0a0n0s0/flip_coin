<template>
  <div class="ip-whitelist-container">
    <h2>後台 IP 白名單</h2>
    <p class="page-description">
      <el-alert type="warning" show-icon :closable="false">
        <strong>警告：</strong> 此功能啟用後，只有列表中的 IP 才能訪問後台。
        <br>
        如果您不確定自己的公網 IP，請在新增前查詢，並使用 /32 格式 (例如 123.123.123.123/32)。
        <br>
        如果白名單為空，則允許所有 IP 訪問 (安全模式)。
      </el-alert>
    </p>
    <el-card shadow="never" class="add-card">
      <el-form ref="addFormRef" :model="addForm" :rules="addFormRules" :inline="true" @submit.native.prevent="handleAddIp">
        <el-form-item label="IP / CIDR" prop="ip_range">
          <el-input v-model="addForm.ip_range" placeholder="例如: 123.123.123.123/32" style="width: 250px;"></el-input>
        </el-form-item>
        <el-form-item label="描述 (選填)">
          <el-input v-model="addForm.description" placeholder="例如: 辦公室 IP" style="width: 200px;"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleAddIp" :loading="addLoading">新增</el-button>
        </el-form-item>
      </el-form>
    </el-card>
    <el-card shadow="never" class="table-card" v-loading="loading">
       <template #header><div>IP 白名單列表</div></template>
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
                   { pattern: /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))$/, message: '格式錯誤，請使用 CIDR (e.g., 1.2.3.4/32)', trigger: 'blur' }
               ],
           }
       };
   },
   created() { this.fetchWhitelist(); },
   methods: {
       async fetchWhitelist() {
            this.loading = true;
            try { this.tableData = await this.$api.getIpWhitelist(); } 
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
           ElMessageBox.confirm(`確定要刪除 IP 規則 "${row.ip_range}" 嗎？`, '警告', { confirmButtonText: '確定刪除', cancelButtonText: '取消', type: 'warning' })
           .then(async () => {
               try {
                   await this.$api.deleteIpFromWhitelist(row.id);
                   ElMessage.success('IP 規則刪除成功');
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
</style>