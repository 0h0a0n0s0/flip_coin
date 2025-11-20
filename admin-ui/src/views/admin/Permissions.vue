<template>
  <div class="permissions-container">
    <h2>权限组管理</h2>
    <p class="page-description">管理後台帐号的角色 (权限组) 及其权限。</p>

    <el-card shadow="never" class="action-card">
       <el-button type="primary" @click="handleAddRole">新增权限组</el-button>
    </el-card>

    <el-card shadow="never" class="table-card" v-loading="loading">
       <template #header><div>权限组列表</div></template>
      <el-table :data="rolesList" style="width: 100%" row-key="id">
        <el-table-column prop="id" label="ID" width="80" sortable />
        <el-table-column prop="name" label="角色名称" width="200" />
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="created_at" label="建立时间" width="180">
           <template #default="scope">{{ formatDateTime(scope.row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button type="primary" link @click="handleEditRole(scope.row)" :disabled="scope.row.id === 1">
              编辑
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
        <el-form-item label="角色名称" prop="name">
          <el-input v-model="roleForm.name" placeholder="例如: 营運人员"></el-input>
        </el-form-item>
        <el-form-item label="角色描述" prop="description">
          <el-input v-model="roleForm.description" type="textarea" placeholder="例如: 僅可读取用户和注单列表"></el-input>
        </el-form-item>
        
        <el-divider />
        
        <el-form-item label="权限设置" prop="permission_ids">
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
          <div v-else>权限加载中...</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">确认储存</el-button>
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
           
           roleForm: { // 弹窗表单
               id: null,
               name: '',
               description: '',
               permission_ids: [], // (选中的权限 ID 陣列)
           },
           formRules: { // 表单验证规則
               name: [{ required: true, message: '角色名称不能为空', trigger: 'blur' }],
               permission_ids: [{ type: 'array', min: 1, message: '至少必须选择一個权限', trigger: 'change' }]
           }
       };
   },
   created() {
       this.fetchRoles();
       this.fetchAllPermissions(); // (预先载入所有权限)
   },
   methods: {
       // 翻译 Category (可选)
       translateCategory(category) {
            const map = {
                'General': '通用权限',
                'UserManagement': '用户管理',
                'BetManagement': '注单管理',
                'ReportManagement': '报表与钱包',
                'System': '系统管理 (高风险)',
            };
            return map[category] || category;
       },

       // 获取角色列表
       async fetchRoles() {
            this.loading = true;
            try {
                this.rolesList = await this.$api.getRoles();
            } catch (error) { console.error('Failed to fetch roles:', error); }
            finally { this.loading = false; }
       },
       
       // (僅执行一次) 获取所有可用的权限点
       async fetchAllPermissions() {
            try {
                this.allPermissions = await this.$api.getAllPermissions();
            } catch (error) {
                console.error('Failed to fetch all permissions:', error);
                ElMessage.error('無法载入权限列表，请刷新页面');
            }
       },

       // (清空表单)
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
           this.dialogTitle = '新增权限组';
           this.isEditMode = false;
           this.resetForm();
           this.dialogVisible = true;
           this.$nextTick(() => { this.$refs.roleFormRef?.clearValidate(); });
       },
       
       // (编辑)
       async handleEditRole(row) {
           this.dialogTitle = `编辑权限组: ${row.name}`;
           this.isEditMode = true;
           this.resetForm();
           this.dialogVisible = true;
           this.dialogLoading = true;
           
           try {
               // 获取该角色的详細资料 (包含 permission_ids)
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
                       // (准备提交的 data)
                       const dataToSubmit = {
                           name: this.roleForm.name,
                           description: this.roleForm.description,
                           permission_ids: this.roleForm.permission_ids
                       };

                       if (this.isEditMode) {
                          await this.$api.updateRole(this.roleForm.id, dataToSubmit);
                          ElMessage.success('权限组更新成功');
                       } else {
                          await this.$api.addRole(dataToSubmit);
                          ElMessage.success('权限组新增成功');
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
               ElMessage.warning('不能刪除系统预设角色');
               return;
           }
           
           ElMessageBox.confirm(`确定要刪除权限组 "${row.name}" 吗？ (使用此权限组的帐号将失去所有权限)`, '警告', { confirmButtonText: '确定刪除', cancelButtonText: '取消', type: 'warning' })
           .then(async () => {
               try {
                   await this.$api.deleteRole(row.id);
                   ElMessage.success('权限组刪除成功');
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

/* 权限树样式 */
.permissions-tree {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 15px;
  max-height: 40vh; /* 限制最大高度 */
  overflow-y: auto; /* 超出时滾动 */
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
  width: 100%; /* 让每個 checkbox 占满一行 */
  margin-left: 0 !important;
  margin-right: 0 !important;
}
</style>