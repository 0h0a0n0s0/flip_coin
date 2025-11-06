<template>
  <div class="permissions-container">
    <h2>權限組管理</h2>
    <p class="page-description">管理後台帳號的角色 (權限組) 及其權限。</p>

    <el-card shadow="never" class="action-card">
       <el-button type="primary" @click="handleAddRole">新增權限組</el-button>
    </el-card>

    <el-card shadow="never" class="table-card" v-loading="loading">
       <template #header><div>權限組列表</div></template>
      <el-table :data="rolesList" style="width: 100%" row-key="id">
        <el-table-column prop="id" label="ID" width="80" sortable />
        <el-table-column prop="name" label="角色名稱" width="200" />
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="created_at" label="建立時間" width="180">
           <template #default="scope">{{ formatDateTime(scope.row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button type="primary" link @click="handleEditRole(scope.row)" :disabled="scope.row.id === 1">
              編輯
            </el-button>
            <el-button type="danger" link @click="handleDeleteRole(scope.row)" :disabled="[1, 2, 3].includes(scope.row.id)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="700px" :close-on-click-modal="false">
      <el-form ref="roleFormRef" :model="roleForm" :rules="formRules" label-width="100px" v-loading="dialogLoading">
        <el-form-item label="角色名稱" prop="name">
          <el-input v-model="roleForm.name" placeholder="例如: 營運人員"></el-input>
        </el-form-item>
        <el-form-item label="角色描述" prop="description">
          <el-input v-model="roleForm.description" type="textarea" placeholder="例如: 僅可讀取用戶和注單列表"></el-input>
        </el-form-item>
        
        <el-divider />
        
        <el-form-item label="權限設置" prop="permission_ids">
          <div v-if="allPermissions" class="permissions-tree">
            <div v-for="category in Object.keys(allPermissions)" :key="category" class="permission-category">
              <h4 class="category-title">{{ translateCategory(category) }}</h4>
              <el-checkbox-group v-model="roleForm.permission_ids" class="permission-group">
                <el-checkbox
                  v-for="perm in allPermissions[category]"
                  :key="perm.id"
                  :label="perm.id"
                  :value="perm.id"
                  border
                  class="permission-checkbox"
                >
                  {{ perm.description }} ({{ perm.resource }}:{{ perm.action }})
                </el-checkbox>
              </el-checkbox-group>
            </div>
          </div>
          <div v-else>權限加載中...</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">確認儲存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus';

export default {
  name: 'PermissionsView',
   data() {
       return {
           loading: true,
           submitLoading: false,
           dialogLoading: false,
           rolesList: [], // { id, name, description, ... }
           allPermissions: null, // { General: [...], UserManagement: [...] }
           
           dialogVisible: false,
           dialogTitle: '',
           isEditMode: false,
           
           roleForm: { // 彈窗表單
               id: null,
               name: '',
               description: '',
               permission_ids: [], // (選中的權限 ID 陣列)
           },
           formRules: { // 表單驗證規則
               name: [{ required: true, message: '角色名稱不能為空', trigger: 'blur' }],
               permission_ids: [{ type: 'array', min: 1, message: '至少必須選擇一個權限', trigger: 'change' }]
           }
       };
   },
   created() {
       this.fetchRoles();
       this.fetchAllPermissions(); // (預先載入所有權限)
   },
   methods: {
       // 翻譯 Category (可選)
       translateCategory(category) {
            const map = {
                'General': '通用權限',
                'UserManagement': '用戶管理',
                'BetManagement': '注單管理',
                'ReportManagement': '報表與錢包',
                'System': '系統管理 (高風險)',
            };
            return map[category] || category;
       },

       // 獲取角色列表
       async fetchRoles() {
            this.loading = true;
            try {
                this.rolesList = await this.$api.getRoles();
            } catch (error) { console.error('Failed to fetch roles:', error); }
            finally { this.loading = false; }
       },
       
       // (僅執行一次) 獲取所有可用的權限點
       async fetchAllPermissions() {
            try {
                this.allPermissions = await this.$api.getAllPermissions();
            } catch (error) {
                console.error('Failed to fetch all permissions:', error);
                ElMessage.error('無法載入權限列表，請刷新頁面');
            }
       },

       // (清空表單)
       resetForm() {
            Object.assign(this.roleForm, {
               id: null,
               name: '',
               description: '',
               permission_ids: [],
            });
       },

       // (新增)
       handleAddRole() {
           this.dialogTitle = '新增權限組';
           this.isEditMode = false;
           this.resetForm();
           this.dialogVisible = true;
           this.$nextTick(() => { this.$refs.roleFormRef?.clearValidate(); });
       },
       
       // (編輯)
       async handleEditRole(row) {
           this.dialogTitle = `編輯權限組: ${row.name}`;
           this.isEditMode = true;
           this.resetForm();
           this.dialogVisible = true;
           this.dialogLoading = true;
           
           try {
               // 獲取該角色的詳細資料 (包含 permission_ids)
               const roleDetails = await this.$api.getRoleDetails(row.id);
               Object.assign(this.roleForm, {
                   id: roleDetails.id,
                   name: roleDetails.name,
                   description: roleDetails.description || '',
                   permission_ids: roleDetails.permission_ids || []
               });
               this.$nextTick(() => { this.$refs.roleFormRef?.clearValidate(); });
           } catch (error) {
               console.error('Failed to fetch role details:', error);
               this.dialogVisible = false;
           } finally {
               this.dialogLoading = false;
           }
       },

       // (提交)
       async handleSubmit() {
           const formEl = this.$refs.roleFormRef;
           if (!formEl) return;
           
           await formEl.validate(async (valid) => {
               if (valid) {
                   this.submitLoading = true;
                   try {
                       // (準備提交的 data)
                       const dataToSubmit = {
                           name: this.roleForm.name,
                           description: this.roleForm.description,
                           permission_ids: this.roleForm.permission_ids
                       };

                       if (this.isEditMode) {
                          await this.$api.updateRole(this.roleForm.id, dataToSubmit);
                          ElMessage.success('權限組更新成功');
                       } else {
                          await this.$api.addRole(dataToSubmit);
                          ElMessage.success('權限組新增成功');
                       }
                       this.dialogVisible = false;
                       await this.fetchRoles(); // 刷新列表
                   } catch (error) { console.error('Failed to submit role:', error); }
                   finally { this.submitLoading = false; }
               } else { return false; }
           });
       },

       // (刪除)
       handleDeleteRole(row) {
           if ([1, 2, 3].includes(row.id)) {
               ElMessage.warning('不能刪除系統預設角色');
               return;
           }
           
           ElMessageBox.confirm(`確定要刪除權限組 "${row.name}" 嗎？ (使用此權限組的帳號將失去所有權限)`, '警告', { confirmButtonText: '確定刪除', cancelButtonText: '取消', type: 'warning' })
           .then(async () => {
               try {
                   await this.$api.deleteRole(row.id);
                   ElMessage.success('權限組刪除成功');
                   await this.fetchRoles(); // 刷新列表
               } catch (error) { console.error('Failed to delete role:', error); }
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

/* 權限樹樣式 */
.permissions-tree {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 15px;
  max-height: 40vh; /* 限制最大高度 */
  overflow-y: auto; /* 超出時滾動 */
}
.permission-category {
  margin-bottom: 15px;
}
.permission-category:last-child {
  margin-bottom: 0;
}
.category-title {
  font-size: 16px;
  margin: 0 0 10px 0;
  border-bottom: 1px solid #e4e7ed;
  padding-bottom: 5px;
  color: #303133;
}
.permission-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.permission-checkbox.el-checkbox.is-bordered {
  width: 100%; /* 讓每個 checkbox 佔滿一行 */
  margin-left: 0 !important;
  margin-right: 0 !important;
}
</style>