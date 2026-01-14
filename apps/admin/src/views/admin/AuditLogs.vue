<template>
  <div class="page-container audit-logs-container">
    <h2>操作稽核日志</h2>
    <p class="page-description">
      查看所有后台操作记录，包含管理员、动作、资源与时间。
      <br>
      <strong>资源（Resource）</strong>：表示被操作的对象类型，例如「用户」、「平台钱包」、「提款」等。
      <br>
      <strong>资源ID（Resource ID）</strong>：表示被操作的具体对象ID，例如用户ID、钱包ID、提款单ID等。
    </p>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch" class="search-form">
        <el-form-item label="管理员帐号">
          <el-input v-model="searchParams.adminUsername" placeholder="帐号 (模糊)" clearable></el-input>
        </el-form-item>
        <el-form-item label="动作">
          <el-select v-model="searchParams.action" placeholder="选择动作" clearable>
            <el-option
              v-for="action in availableActions"
              :key="action.value"
              :label="action.label"
              :value="action.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="searchParams.dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            unlink-panels
            clearable
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-table :data="tableData" style="width: 100%">
        <el-table-column prop="admin_username" label="管理员" width="150" />
        <el-table-column prop="action" label="动作" width="160">
          <template #default="scope">
            {{ formatAction(scope.row.action) }}
          </template>
        </el-table-column>
        <el-table-column prop="resource" label="被操作对象" width="160">
          <template #default="scope">
            {{ formatResource(scope.row.resource) }}
          </template>
        </el-table-column>
        <el-table-column prop="resource_id" label="被操作对象ID" width="120" />
        <el-table-column prop="description" label="描述" min-width="220" />
        <el-table-column prop="ip_address" label="IP" width="140" />
        <el-table-column prop="user_agent" label="User Agent" min-width="220" />
        <el-table-column prop="created_at" label="时间" width="180" fixed="right">
          <template #default="scope">
            {{ formatDate(scope.row.created_at) }}
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
  </div>
</template>

<script>
// 创建当日日期范围
const createTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return [start, end];
};

// 将日期范围转换为 ISO 字符串数组
const toIsoRange = (range) => {
  if (!Array.isArray(range) || range.length !== 2) return null;
  const [start, end] = range;
  const startIso = start instanceof Date && !isNaN(start) ? start.toISOString() : null;
  const endIso = end instanceof Date && !isNaN(end) ? end.toISOString() : null;
  if (!startIso || !endIso) return null;
  return [startIso, endIso];
};

export default {
  name: 'AuditLogsView',
  data() {
    return {
      loading: false,
      tableData: [],
      totalItems: 0,
      pagination: {
        page: 1,
        limit: 20,
      },
      searchParams: {
        adminUsername: '',
        action: '',
        dateRange: createTodayRange(),
      },
      // 可用动作列表（用于下拉选单）
      availableActions: [
        { value: 'update_user', label: '更新用户资料' },
        { value: 'update_user_status', label: '更新用户状态' },
        { value: 'create_wallet', label: '新增钱包' },
        { value: 'update_wallet', label: '更新钱包' },
        { value: 'delete_wallet', label: '删除钱包' },
        { value: 'update_setting', label: '更新系统设定' },
        { value: 'create_admin_account', label: '新增后台帐号' },
        { value: 'update_admin_account', label: '更新后台帐号' },
        { value: 'delete_admin_account', label: '删除后台帐号' },
        { value: 'add_ip_whitelist', label: '新增IP白名单' },
        { value: 'delete_ip_whitelist', label: '删除IP白名单' },
        { value: 'create_role', label: '新增权限组' },
        { value: 'update_role', label: '更新权限组' },
        { value: 'delete_role', label: '删除权限组' },
        { value: 'approve_withdrawal', label: '批准提款' },
        { value: 'reject_withdrawal', label: '拒绝提款' },
        { value: 'complete_withdrawal', label: '完成提款' },
      ],
      // 动作映射表（用于显示）
      actionMap: {
        'update_user': '更新用户资料',
        'update_user_status': '更新用户状态',
        'create_wallet': '新增钱包',
        'update_wallet': '更新钱包',
        'delete_wallet': '删除钱包',
        'update_setting': '更新系统设定',
        'create_admin_account': '新增后台帐号',
        'update_admin_account': '更新后台帐号',
        'delete_admin_account': '删除后台帐号',
        'add_ip_whitelist': '新增IP白名单',
        'delete_ip_whitelist': '删除IP白名单',
        'create_role': '新增权限组',
        'update_role': '更新权限组',
        'delete_role': '删除权限组',
        'approve_withdrawal': '批准提款',
        'reject_withdrawal': '拒绝提款',
        'complete_withdrawal': '完成提款',
      },
      // 资源映射表（用于显示）
      resourceMap: {
        'users': '用户',
        'platform_wallets': '平台钱包',
        'system_settings': '系统设定',
        'admin_users': '后台帐号',
        'admin_ip_whitelist': 'IP白名单',
        'admin_roles': '权限组',
        'withdrawals': '提款',
      },
    };
  },
  created() {
    this.handleSearch();
  },
  methods: {
    async fetchLogs() {
      if (this.loading) return;
      this.loading = true;
      try {
        const isoRange = toIsoRange(this.searchParams.dateRange);
        const params = {
          ...this.pagination,
          adminUsername: this.searchParams.adminUsername || undefined,
          action: this.searchParams.action || undefined,
          dateRange: isoRange ? JSON.stringify(isoRange) : undefined,
        };
        const response = await this.$api.getAuditLogs(params);
        // (★★★ 修復：後端使用標準響應格式 { success: true, data: { total, list } } ★★★)
        if (response && response.success && response.data) {
            this.tableData = response.data.list || [];
            this.totalItems = response.data.total || 0;
        } else {
            // 向後兼容：如果沒有標準格式，直接使用 response
            this.tableData = response.list || [];
            this.totalItems = response.total || 0;
        }
      } catch (error) {
        console.error('Failed to fetch audit logs:', error);
      } finally {
        this.loading = false;
      }
    },
    handleSearch() {
      this.pagination.page = 1;
      this.fetchLogs();
    },
    handleSizeChange(newLimit) {
      this.pagination.limit = newLimit;
      this.pagination.page = 1;
      this.fetchLogs();
    },
    handlePageChange(newPage) {
      this.pagination.page = newPage;
      this.fetchLogs();
    },
    formatDate(value) {
      if (!value) return '-';
      try {
        return new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
      } catch (e) {
        return value;
      }
    },
    formatAction(action) {
      return this.actionMap[action] || action || '-';
    },
    formatResource(resource) {
      return this.resourceMap[resource] || resource || '-';
    },
  },
};
</script>

<style scoped>
.page-description { color: #909399; font-size: 14px; margin-bottom: 20px; }
.search-card { margin-bottom: 20px; }
.table-card { margin-bottom: 20px; }
.pagination-container { margin-top: 20px; display: flex; justify-content: flex-end; }
.el-form-item { margin-bottom: 10px; }
.search-form :deep(.el-input) { width: 180px; }
.search-form :deep(.el-select) { width: 180px; }
.search-form :deep(.el-date-editor) { width: 360px; }
</style>

