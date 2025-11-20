<template>
  <div class="user-management-container">
    <h2>用户管理</h2>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch" class="search-form">
        
        <el-form-item label="用户ID">
          <el-input v-model="searchParams.userId" placeholder="用户ID (模糊)" clearable></el-input>
        </el-form-item>

        <el-form-item label="用户帐号">
          <el-input v-model="searchParams.username" placeholder="登入帐号 (模糊)" clearable></el-input>
        </el-form-item>
        
        <el-form-item label="用户昵称">
          <el-input v-model="searchParams.nickname" placeholder="昵称 (精确)" clearable></el-input>
        </el-form-item>

        <el-form-item label="自身邀请码">
          <el-input v-model="searchParams.inviteCode" placeholder="自身邀请码 (精确)" clearable></el-input>
        </el-form-item>
        
        <el-form-item label="推荐人邀请码">
          <el-input v-model="searchParams.referrerCode" placeholder="推荐人邀请码 (精确)" clearable></el-input>
        </el-form-item>
        
        <el-form-item label="最新登入IP">
          <el-input v-model="searchParams.lastLoginIp" placeholder="登入IP (精确)" clearable></el-input>
        </el-form-item>
        
        <el-form-item label="状态">
          <el-select v-model="searchParams.status" placeholder="选择状态" clearable>
            <el-option label="正常 (active)" value="active" />
            <el-option label="禁用 (banned)" value="banned" />
          </el-select>
        </el-form-item>

        <el-form-item label="注册时间">
          <el-date-picker
            v-model="searchParams.dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DDTHH:mm:ssZ"
          />
        </el-form-item>

         <el-form-item label="最新活动时间">
          <el-date-picker
            v-model="searchParams.activityDateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DDTHH:mm:ssZ"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </el-form-item>
        
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-table :data="tableData" style="width: 100%" :cell-style="{ paddingTop: '8px', paddingBottom: '8px' }">
        
        <el-table-column prop="user_id" label="用户ID" width="120" fixed="left" />
        <el-table-column prop="username" label="用户帐号" width="150" />
        <el-table-column prop="balance" label="平台余额 (USDT)" width="150">
           <template #default="scope">{{ formatCurrency(scope.row.balance) }}</template>
        </el-table-column>
        <el-table-column prop="nickname" label="用户昵称" width="120" />
        <el-table-column prop="level" label="用户等级" width="100" />
        
        <el-table-column prop="invite_code" label="自身邀请码" width="130">
           <template #default="scope">
             <el-button type="primary" link @click="handleViewReferrals(scope.row)">
               {{ scope.row.invite_code }}
             </el-button>
           </template>
        </el-table-column>
        <el-table-column prop="referrer_code" label="推荐人邀请码" width="130" />
        
        <el-table-column prop="last_login_ip" label="最新登入IP" width="150" />
        <el-table-column prop="last_activity_at" label="最新活动时间" width="180">
           <template #default="scope">{{ formatDateTime(scope.row.last_activity_at) }}</template>
        </el-table-column>
        
        <el-table-column prop="max_streak" label="最高連胜" width="100" />
        <el-table-column prop="created_at" label="注册时间" width="180">
           <template #default="scope">{{ formatDateTime(scope.row.created_at) }}</template>
        </el-table-column>
        
        <el-table-column prop="status" label="禁用投注" width="100" fixed="right">
          <template #default="scope">
            <el-switch
              v-model="scope.row.status"
              active-value="banned"
              inactive-value="active"
              active-text="禁用"
              inactive-text="正常"
              inline-prompt
              style="--el-switch-on-color: #ff4949; --el-switch-off-color: #13ce66"
              @change="handleStatusChange(scope.row)"
            />
          </template>
        </el-table-column>

        <el-table-column label="操作" width="100" fixed="right">
           <template #default="scope">
             <el-button type="primary" link @click="handleEdit(scope.row)">
               编辑
             </el-button>
           </template>
        </el-table-column>
        
      </el-table>

      <el-pagination
        class="pagination-container"
        layout="total, sizes, prev, pager, next, jumper"
        :total="totalItems"
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.limit"
        :page-sizes="[10, 20, 50, 100]"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </el-card>

    <el-dialog
        v-model="editDialogVisible"
        title="编辑用户"
        width="600px"
        :close-on-click-modal="false"
    >
      <el-form v-if="editForm.currentUser" ref="editFormRef" :model="editForm" :rules="editFormRules" label-width="120px">
        <el-form-item label="用户ID">
          <el-input :value="editForm.currentUser.user_id" disabled />
        </el-form-item>
         <el-form-item label="用户帐号">
          <el-input :value="editForm.currentUser.username" disabled />
        </el-form-item>
        
        <el-form-item label="平台余额 (USDT)" prop="balance">
           <el-input-number v-model="editForm.balance" :min="0" :precision="6" placeholder="用户平台余额" />
           <div class="form-tip">(警告：手动修改余额不会留下金流记录)</div>
        </el-form-item>
        
        <el-form-item label="用户昵称" prop="nickname">
          <el-input v-model="editForm.nickname" placeholder="请输入用户昵称" />
        </el-form-item>
        <el-form-item label="用户等级" prop="level">
          <el-input-number v-model="editForm.level" :min="1" placeholder="请输入用户等级" />
           <div class="form-tip">(注意：手动调整等级不会派发升级奖金)</div>
        </el-form-item>
        <el-form-item label="推荐人邀请码" prop="referrer_code">
          <el-input v-model="editForm.referrer_code" placeholder="(留空可清除推薦人)" clearable />
           <div class="form-tip">(必须是已存在的其他用户的「自身邀请码」)</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitEdit" :loading="editLoading">确认储存</el-button>
      </template>
    </el-dialog>

    <el-dialog
        v-model="referralDialogVisible"
        :title="`查看 ${referralData.inviteCode} 的推薦列表`"
        width="700px"
        :close-on-click-modal="false"
    >
        <el-table :data="referralData.list" v-loading="referralData.loading">
            <el-table-column prop="user_id" label="用户ID" />
            <el-table-column prop="nickname" label="昵称" />
            <el-table-column prop="created_at" label="注册时间">
                 <template #default="scope">{{ formatDateTime(scope.row.created_at) }}</template>
            </el-table-column>
        </el-table>
    </el-dialog>
    
  </div>
</template>

<script>
// ( ... <script> 标签内的逻辑保持不变 ... )
import { ElMessage } from 'element-plus';

export default {
  name: 'UserManagementView',
  data() {
    return {
      loading: false,
      tableData: [], 
      totalItems: 0, 
      pagination: {
        page: 1,
        limit: 10,
      },
      searchParams: {
        userId: '',
        username: '', 
        dateRange: null, 
        nickname: '',
        status: '',
        inviteCode: '',
        referrerCode: '',
        lastLoginIp: '',
        activityDateRange: null, 
      },
      editDialogVisible: false,
      editLoading: false,
      editForm: {
        currentUser: null,
        nickname: '',
        level: 1,
        referrer_code: '',
        balance: 0, 
      },
      editFormRules: {
        nickname: [{ max: 50, message: '昵称长度不能超过 50 个字符', trigger: 'blur' }],
        level: [{ required: true, message: '等级不能为空' }, { type: 'integer', min: 1, message: '等级必须是正整数', trigger: 'blur' }],
        referrer_code: [{ max: 8, message: '邀请码长度不能超过 8 个字符', trigger: 'blur' }],
        balance: [{ required: true, message: '余额不能为空' }, { type: 'number', min: 0, message: '余额必须是非负数', trigger: 'blur' }]
      },
      referralDialogVisible: false,
      referralData: {
        loading: false,
        inviteCode: '',
        list: []
      }
    };
  },
  created() {
    this.fetchUsers();
  },
  methods: {
    async fetchUsers() {
      if (this.loading) return;
      this.loading = true;
      try {
        const params = {
          ...this.pagination,
          userId: this.searchParams.userId || undefined, 
          username: this.searchParams.username || undefined,
          dateRange: this.searchParams.dateRange ? JSON.stringify(this.searchParams.dateRange) : undefined,
          nickname: this.searchParams.nickname || undefined,
          status: this.searchParams.status || undefined,
          inviteCode: this.searchParams.inviteCode || undefined,
          referrerCode: this.searchParams.referrerCode || undefined,
          lastLoginIp: this.searchParams.lastLoginIp || undefined,
          activityDateRange: this.searchParams.activityDateRange ? JSON.stringify(this.searchParams.activityDateRange) : undefined,
        };
        const response = await this.$api.getUsers(params);
        this.tableData = response.list;
        this.totalItems = response.total;
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        this.loading = false;
      }
    },
    
    async handleStatusChange(row) {
        const newStatus = row.status;
        const oldStatus = newStatus === 'active' ? 'banned' : 'active';
        try {
            await this.$api.updateUserStatus(row.id, newStatus);
            ElMessage.success(`用户 ${row.user_id} 狀态已更新为 ${newStatus}`);
        } catch (error) {
            console.error('Failed to update status:', error);
            row.status = oldStatus; 
        }
    },

    handleSearch() { this.pagination.page = 1; this.fetchUsers(); },
    handleSizeChange(newLimit) { this.pagination.limit = newLimit; this.pagination.page = 1; this.fetchUsers(); },
    handlePageChange(newPage) { this.pagination.page = newPage; this.fetchUsers(); },
    
    formatDateTime(isoString) { 
        if (!isoString) return '';
        try { return new Date(isoString).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }); }
        catch (e) { return isoString; }
    },
    
    formatCurrency(value) {
      if (value === null || value === undefined) return '0.00';
      try {
        const num = parseFloat(value);
        if (isNaN(num)) return '0.00';
        return num.toFixed(2);
      } catch (e) {
        return '0.00';
      }
    },

    handleEdit(row) {
      this.editForm.currentUser = row;
      this.editForm.nickname = row.nickname || '';
      this.editForm.level = row.level;
      this.editForm.referrer_code = row.referrer_code || '';
      this.editForm.balance = parseFloat(row.balance) || 0; 
      
      this.editDialogVisible = true;
      this.$nextTick(() => {
        this.$refs.editFormRef?.clearValidate();
      });
    },

    async handleSubmitEdit() {
      const formEl = this.$refs.editFormRef;
      if (!formEl) return;
      await formEl.validate(async (valid) => {
        if (valid) {
          this.editLoading = true;
          try {
            const dataToSubmit = {
              nickname: this.editForm.nickname,
              level: this.editForm.level,
              referrer_code: this.editForm.referrer_code || null,
              balance: this.editForm.balance, 
            };
            await this.$api.updateUser(this.editForm.currentUser.id, dataToSubmit);
            ElMessage.success('用户资料更新成功');
            this.editDialogVisible = false;
            await this.fetchUsers();
          } catch (error) {
            console.error('Failed to update user:', error);
          } finally {
            this.editLoading = false;
          }
        } else {
          return false;
        }
      });
    },

    async handleViewReferrals(row) {
        this.referralData.inviteCode = row.invite_code;
        this.referralData.list = [];
        this.referralData.loading = true;
        this.referralDialogVisible = true;
        try {
            const referrals = await this.$api.getReferrals(row.invite_code);
            this.referralData.list = referrals;
        } catch (error) {
             console.error('Failed to fetch referrals:', error);
             ElMessage.error('载入推薦列表失败');
        } finally {
            this.referralData.loading = false;
        }
    }
  },
};
</script>

<style scoped>
.search-card { margin-bottom: 20px; }
.table-card { margin-bottom: 20px; }
.pagination-container { margin-top: 20px; display: flex; justify-content: flex-end; }
.el-form-item { margin-bottom: 10px; }
.form-tip { font-size: 12px; color: #909399; margin-top: 5px; line-height: 1.2; }

/* (★★★ 关键修复 ★★★) */
.search-form :deep(.el-input) {
  width: 180px;
}

/* (★★★ 关键修复：新增此规則以锁定 el-select 的寬度 ★★★) */
.search-form :deep(.el-select) {
  width: 180px;
}

/* (日期范围选择器需要更寬) */
.search-form :deep(.el-date-picker) {
  width: 240px;
}
</style>