<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2 class="page-title">帐号管理</h2>
        <p class="page-description">管理可以登入後台的管理员帐号。</p>
      </div>
    </div>
    <el-card shadow="never" class="action-card">
       <el-button type="primary" @click="handleAdd">新增帐号</el-button>
    </el-card>
    <el-card shadow="never" class="table-card" v-loading="loading">
       <template #header><div>帐号列表</div></template>
      <el-table :data="tableData" style="width: 100%" row-key="id">
        <el-table-column prop="id" label="ID" width="80" sortable />
        <el-table-column prop="username" label="登入帐号" width="200" />
        <el-table-column prop="role_name" label="角色 (权限组)" width="150">
           <template #default="scope">
             <el-tag v-if="scope.row.role_id">{{ scope.row.role_name || `ID: ${scope.row.role_id}` }}</el-tag>
             <el-tag v-else type="info">未分配</el-tag>
           </template>
        </el-table-column>
        <el-table-column prop="status" label="狀态" width="120">
           <template #default="scope">
             <el-tag :type="scope.row.status === 'active' ? 'success' : 'danger'">
               {{ scope.row.status === 'active' ? '启用' : '禁用' }}
             </el-tag>
           </template>
        </el-table-column>
        <el-table-column prop="created_at" label="建立时间">
           <template #default="scope">{{ formatDateTime(scope.row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="scope">
            <div class="action-buttons-container">
              <el-button class="action-btn-edit" @click="handleEdit(scope.row)">编辑</el-button>
              <el-button class="action-btn-delete" @click="handleDelete(scope.row)" :disabled="scope.row.id === 1 || scope.row.id === currentUserId">删除</el-button>
              <el-button 
                v-if="scope.row.has_google_auth" 
                class="action-btn-collect"
                @click="handleUnbindGoogleAuth(scope.row)"
              >
                解绑谷歌验证
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" :close-on-click-modal="false">
      <el-form ref="accountFormRef" :model="accountForm" :rules="formRules" label-width="100px" v-loading="dialogLoading">
        <el-form-item label="登入帐号" prop="username">
          <el-input v-model="accountForm.username" placeholder="请输入登入帐号"></el-input>
        </el-form-item>
        <el-form-item label="登入密码" prop="password">
          <el-input v-model="accountForm.password" type="password" show-password placeholder="留空表示不修改密码"></el-input>
        </el-form-item>
        <el-form-item label="角色" prop="role_id">
          <el-select v-model="accountForm.role_id" placeholder="请选择权限组" style="width: 100%">
            <el-option
              v-for="role in rolesList"
              :key="role.id"
              :label="`${role.name} (ID: ${role.id})`"
              :value="role.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="狀态" prop="status">
           <el-radio-group v-model="accountForm.status">
             <el-radio label="active">启用</el-radio>
             <el-radio label="disabled">禁用</el-radio>
           </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">确认</el-button>
      </template>
    </el-dialog>
    
    <!-- 解绑谷歌验证弹窗 -->
    <el-dialog 
      v-model="unbindDialogVisible" 
      title="解绑谷歌验证" 
      width="500px"
      :close-on-click-modal="false"
    >
      <el-alert
        type="warning"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        <template #title>
          <span>确定要解绑账号 "{{ unbindTargetAccount?.username }}" 的谷歌验证吗？</span>
        </template>
      </el-alert>
      
      <el-alert
        type="info"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        <template #title>
          <span>请输入<strong>您自己</strong>的谷歌验证码以确认操作</span>
        </template>
      </el-alert>
      
      <el-form
        ref="unbindFormRef"
        :model="unbindForm"
        :rules="unbindRules"
        label-width="120px"
      >
        <el-form-item label="谷歌验证码" prop="googleAuthCode">
          <el-input
            v-model="unbindForm.googleAuthCode"
            placeholder="请输入6位验证码"
            maxlength="6"
            style="width: 200px;"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="unbindDialogVisible = false">取消</el-button>
          <el-button type="danger" @click="handleUnbindSubmit" :loading="unbindLoading">
            确认解绑
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus';
import { jwtDecode } from 'jwt-decode';

export default {
  name: 'AccountManagementView',
   data() {
       const validatePassword = (rule, value, callback) => {
           if (!this.isEditMode && (!value || value.length < 6)) {
               callback(new Error('新增帐号时，密码为必填且至少 6 位'));
           } else if (this.isEditMode && value && value.length < 6) {
               callback(new Error('密码至少 6 位'));
           } else {
               callback();
           }
       };
       return {
           loading: true, 
           submitLoading: false, 
           dialogLoading: false, // (★★★ Y-22: 新增 ★★★)
           tableData: [], 
           rolesList: [], // (★★★ Y-23: 新增，用于下拉选单 ★★★)
           
           dialogVisible: false, dialogTitle: '', isEditMode: false,
           currentUserId: null, 
           
           // (★★★ Y-24: 修改 Form ★★★)
           accountForm: { 
               id: null, 
               username: '', 
               password: '', 
               role_id: null, // (从 'role' 改为 'role_id')
               status: 'active' 
            },
           formRules: {
               username: [{ required: true, message: '登入帐号不能为空', trigger: 'blur' }],
               password: [{ validator: validatePassword, trigger: 'blur' }],
               role_id: [{ required: true, message: '必须选择一個角色', trigger: 'change' }], // (★★★ Y-25: 修改规則 ★★★)
               status: [{ required: true, message: '狀态必须选择', trigger: 'change' }],
           },
           // 解绑谷歌验证相关
           unbindDialogVisible: false,
           unbindLoading: false,
           unbindTargetAccount: null,
           unbindForm: {
               googleAuthCode: ''
           },
           unbindRules: {
               googleAuthCode: [
                   { required: true, message: '请输入验证码', trigger: 'blur' },
                   { pattern: /^\d{6}$/, message: '验证码必须是6位数字', trigger: 'blur' }
               ]
           }
       };
   },
   created() {
       this.fetchAccounts();
       this.fetchRolesList(); // (★★★ Y-26: 新增 ★★★)
       this.getCurrentUserId();
   },
   methods: {
       // (解码 Token)
       getCurrentUserId() {
            try {
                const token = localStorage.getItem('admin_token');
                const decoded = jwtDecode(token);
                this.currentUserId = decoded.id;
            } catch (e) {
                console.error('Failed to decode token:', e);
                this.$router.push('/login');
            }
       },
       // (获取帐号列表)
       async fetchAccounts() {
            this.loading = true;
            try { 
                const response = await this.$api.getAdminAccounts();
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
            catch (error) { console.error('Failed to fetch admin accounts:', error); }
            finally { this.loading = false; }
       },
       // (★★★ Y-27: 新增：获取角色列表 ★★★)
       async fetchRolesList() {
           try {
               const response = await this.$api.getRoles();
               // (★★★ 修復：後端使用標準響應格式 { success: true, data: [...] } ★★★)
               if (response && response.success && response.data) {
                   this.rolesList = Array.isArray(response.data) ? response.data : [];
               } else if (Array.isArray(response)) {
                   // 向後兼容：如果直接是數組
                   this.rolesList = response;
               } else {
                   this.rolesList = [];
               }
           } catch (error) {
               console.error('Failed to fetch roles list:', error);
               ElMessage.error('無法载入权限组列表');
           }
       },
       
       // (清空表单)
       resetForm() {
            Object.assign(this.accountForm, { 
                id: null, 
                username: '', 
                password: '', 
                role_id: null, 
                status: 'active' 
            });
       },

       // (新增)
       handleAdd() {
           this.dialogTitle = '新增後台帐号'; 
           this.isEditMode = false;
           this.resetForm();
           this.dialogVisible = true;
           this.$nextTick(() => { this.$refs.accountFormRef?.clearValidate(); });
       },
       
       // (编辑)
       handleEdit(row) {
           this.dialogTitle = `编辑帐号 ${row.username}`; 
           this.isEditMode = true;
           // (★★★ Y-28: 修改：填充 role_id ★★★)
           Object.assign(this.accountForm, { 
               id: row.id, 
               username: row.username, 
               password: '', 
               role_id: row.role_id, // (使用 role_id)
               status: row.status 
            });
           this.dialogVisible = true;
           this.$nextTick(() => { this.$refs.accountFormRef?.clearValidate(); });
       },

       // (提交)
       async handleSubmit() {
           const formEl = this.$refs.accountFormRef; if (!formEl) return;
           await formEl.validate(async (valid) => {
               if (valid) {
                   this.submitLoading = true;
                   try {
                       // (★★★ Y-29: 修改：提交 role_id ★★★)
                       const dataToSubmit = { 
                           username: this.accountForm.username,
                           role_id: this.accountForm.role_id,
                           status: this.accountForm.status,
                       };
                       // (只有在填寫时才提交密码)
                       if (this.accountForm.password) {
                           dataToSubmit.password = this.accountForm.password;
                       }
                       
                       if (this.isEditMode) {
                          await this.$api.updateAdminAccount(this.accountForm.id, dataToSubmit);
                          ElMessage.success('帐号更新成功');
                       } else {
                          await this.$api.addAdminAccount(dataToSubmit);
                          ElMessage.success('帐号新增成功');
                       }
                       this.dialogVisible = false; 
                       await this.fetchAccounts(); // 刷新列表
                   } catch (error) { console.error('Failed to submit account:', error); }
                   finally { this.submitLoading = false; }
               } else { return false; }
           });
       },

       // (刪除)
       handleDelete(row) {
           if (row.id === 1 || row.id === this.currentUserId) { ElMessage.warning('無法刪除此帐号'); return; }
           ElMessageBox.confirm(`确定要刪除帐号 "${row.username}" 吗？`, '警告', { confirmButtonText: '确定刪除', cancelButtonText: '取消', type: 'warning' })
           .then(async () => {
               try {
                   await this.$api.deleteAdminAccount(row.id);
                   ElMessage.success('帐号刪除成功'); 
                   await this.fetchAccounts();
               } catch (error) { console.error('Failed to delete account:', error); }
           }).catch(() => {});
       },
       
       formatDateTime(isoString) { 
           if (!isoString) return '';
           try { return new Date(isoString).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }); }
           catch (e) { return isoString; }
       },
       
       // 解绑谷歌验证
       handleUnbindGoogleAuth(row) {
           this.unbindTargetAccount = row;
           this.unbindForm.googleAuthCode = '';
           this.unbindDialogVisible = true;
           this.$nextTick(() => {
               if (this.$refs.unbindFormRef) {
                   this.$refs.unbindFormRef.clearValidate();
               }
           });
       },
       
       async handleUnbindSubmit() {
           const formEl = this.$refs.unbindFormRef;
           if (!formEl) return;
           
           await formEl.validate(async (valid) => {
               if (valid) {
                   this.unbindLoading = true;
                   try {
                       await this.$api.unbindGoogleAuthForAccount(this.unbindTargetAccount.id, {
                           googleAuthCode: this.unbindForm.googleAuthCode
                       });
                       ElMessage.success('谷歌验证解绑成功');
                       this.unbindDialogVisible = false;
                       await this.fetchAccounts(); // 刷新列表
                   } catch (error) {
                       console.error('Failed to unbind google auth:', error);
                       if (error.response && error.response.data && error.response.data.error) {
                           ElMessage.error(error.response.data.error);
                       } else {
                           ElMessage.error('解绑失败');
                       }
                   } finally {
                       this.unbindLoading = false;
                   }
               }
           });
       }
   }
};
</script>

<style scoped>
.action-card {
  margin-bottom: var(--spacing-md);
}

.form-tip {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 5px;
  line-height: 1.5;
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