<template>
  <div class="account-management-container">
    <h2>後台帳號管理</h2>
    <p class="page-description">管理可以登入後台的管理員帳號。</p>
    <el-card shadow="never" class="action-card">
       <el-button type="primary" @click="handleAdd">新增帳號</el-button>
    </el-card>
    <el-card shadow="never" class="table-card" v-loading="loading">
       <template #header><div>帳號列表</div></template>
      <el-table :data="tableData" style="width: 100%" row-key="id">
        <el-table-column prop="id" label="ID" width="80" sortable />
        <el-table-column prop="username" label="登入帳號" width="200" />
        <el-table-column prop="role" label="角色" width="150" />
        <el-table-column prop="status" label="狀態" width="120">
           <template #default="scope">
             <el-tag :type="scope.row.status === 'active' ? 'success' : 'danger'">
               {{ scope.row.status === 'active' ? '啟用' : '禁用' }}
             </el-tag>
           </template>
        </el-table-column>
        <el-table-column prop="created_at" label="建立時間">
           <template #default="scope">{{ formatDateTime(scope.row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button type="primary" link @click="handleEdit(scope.row)">编辑</el-button>
            <el-button type="danger" link @click="handleDelete(scope.row)" :disabled="scope.row.id === 1 || scope.row.id === currentUserId">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" :close-on-click-modal="false">
      <el-form ref="accountFormRef" :model="accountForm" :rules="formRules" label-width="100px">
        <el-form-item label="登入帳號" prop="username">
          <el-input v-model="accountForm.username" placeholder="請輸入登入帳號"></el-input>
        </el-form-item>
        <el-form-item label="登入密碼" prop="password">
          <el-input v-model="accountForm.password" type="password" show-password placeholder="留空表示不修改密碼"></el-input>
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-input v-model="accountForm.role" placeholder="例如: super_admin / admin / operator"></el-input>
           <div class="form-tip">(目前僅為標記，權限組功能 待實作)</div>
        </el-form-item>
        <el-form-item label="狀態" prop="status">
           <el-radio-group v-model="accountForm.status">
             <el-radio label="active">啟用</el-radio>
             <el-radio label="disabled">禁用</el-radio>
           </el-radio-group>
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
import { jwtDecode } from 'jwt-decode'; //
export default {
  name: 'AccountManagementView',
   data() {
       const validatePassword = (rule, value, callback) => {
           if (!this.isEditMode && (!value || value.length < 6)) {
               callback(new Error('新增帳號時，密碼為必填且至少 6 位'));
           } else if (this.isEditMode && value && value.length < 6) {
               callback(new Error('密碼至少 6 位'));
           } else {
               callback();
           }
       };
       return {
           loading: true, submitLoading: false, tableData: [], 
           dialogVisible: false, dialogTitle: '', isEditMode: false,
           currentUserId: null, 
           accountForm: { id: null, username: '', password: '', role: 'admin', status: 'active' },
           formRules: {
               username: [{ required: true, message: '登入帳號不能為空', trigger: 'blur' }],
               password: [{ validator: validatePassword, trigger: 'blur' }],
               role: [{ required: true, message: '角色不能為空', trigger: 'blur' }],
               status: [{ required: true, message: '狀態必須選擇', trigger: 'change' }],
           }
       };
   },
   created() {
       this.fetchAccounts();
       try {
           const token = localStorage.getItem('admin_token');
           const decoded = jwtDecode(token);
           this.currentUserId = decoded.id;
       } catch (e) {
           console.error('Failed to decode token:', e);
           this.$router.push('/login');
       }
   },
   methods: {
       async fetchAccounts() {
            this.loading = true;
            try { this.tableData = await this.$api.getAdminAccounts(); } 
            catch (error) { console.error('Failed to fetch admin accounts:', error); }
            finally { this.loading = false; }
       },
       handleAdd() {
           this.dialogTitle = '新增後台帳號'; this.isEditMode = false;
           Object.assign(this.accountForm, { id: null, username: '', password: '', role: 'admin', status: 'active' });
           this.dialogVisible = true;
           this.$nextTick(() => { this.$refs.accountFormRef?.clearValidate(); });
       },
       handleEdit(row) {
           this.dialogTitle = `編輯帳號 ${row.username}`; this.isEditMode = true;
           Object.assign(this.accountForm, { id: row.id, username: row.username, password: '', role: row.role, status: row.status });
           this.dialogVisible = true;
           this.$nextTick(() => { this.$refs.accountFormRef?.clearValidate(); });
       },
       async handleSubmit() {
           const formEl = this.$refs.accountFormRef; if (!formEl) return;
           await formEl.validate(async (valid) => {
               if (valid) {
                   this.submitLoading = true;
                   try {
                       const dataToSubmit = { ...this.accountForm };
                       if (!dataToSubmit.password) { delete dataToSubmit.password; }
                       if (this.isEditMode) {
                          await this.$api.updateAdminAccount(this.accountForm.id, dataToSubmit);
                          ElMessage.success('帳號更新成功');
                       } else {
                          await this.$api.addAdminAccount(dataToSubmit);
                          ElMessage.success('帳號新增成功');
                       }
                       this.dialogVisible = false; await this.fetchAccounts();
                   } catch (error) { console.error('Failed to submit account:', error); }
                   finally { this.submitLoading = false; }
               } else { return false; }
           });
       },
       handleDelete(row) {
           if (row.id === 1 || row.id === this.currentUserId) { ElMessage.warning('無法刪除此帳號'); return; }
           ElMessageBox.confirm(`確定要刪除帳號 "${row.username}" 嗎？`, '警告', { confirmButtonText: '確定刪除', cancelButtonText: '取消', type: 'warning' })
           .then(async () => {
               try {
                   await this.$api.deleteAdminAccount(row.id);
                   ElMessage.success('帳號刪除成功'); await this.fetchAccounts();
               } catch (error) { console.error('Failed to delete account:', error); }
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
.page-description { color: #909399; font-size: 14px; margin-bottom: 20px; }
.action-card { margin-bottom: 20px; }
.table-card { margin-bottom: 20px; }
.el-form-item { margin-bottom: 20px; }
.form-tip { font-size: 12px; color: #909399; margin-top: 5px; line-height: 1.4; }
</style>