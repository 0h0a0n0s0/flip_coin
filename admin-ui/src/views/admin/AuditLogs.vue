<template>
  <div class="audit-logs-container">
    <h2>后台操作稽核日志</h2>
    <p class="page-description">查看所有后台操作记录，包含管理员、动作、资源与时间。</p>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch" class="search-form">
        <el-form-item label="管理员帐号">
          <el-input v-model="searchParams.adminUsername" placeholder="帐号 (模糊)" clearable></el-input>
        </el-form-item>
        <el-form-item label="动作代号">
          <el-input v-model="searchParams.action" placeholder="action (模糊)" clearable></el-input>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="searchParams.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
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
        <el-table-column prop="created_at" label="时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="admin_username" label="管理员" width="150" />
        <el-table-column prop="action" label="动作" width="160" />
        <el-table-column prop="resource" label="资源" width="160" />
        <el-table-column prop="resource_id" label="资源ID" width="120" />
        <el-table-column prop="description" label="描述" min-width="220" />
        <el-table-column prop="ip_address" label="IP" width="140" />
        <el-table-column prop="user_agent" label="User Agent" min-width="220" />
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
        dateRange: null,
      },
    };
  },
  created() {
    this.fetchLogs();
  },
  methods: {
    async fetchLogs() {
      if (this.loading) return;
      this.loading = true;
      try {
        const params = {
          ...this.pagination,
          adminUsername: this.searchParams.adminUsername || undefined,
          action: this.searchParams.action || undefined,
          dateRange: this.searchParams.dateRange ? JSON.stringify(this.searchParams.dateRange) : undefined,
        };
        const response = await this.$api.getAuditLogs(params);
        this.tableData = response.list || [];
        this.totalItems = response.total || 0;
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
      return new Date(value).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
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
.search-form :deep(.el-date-editor) { width: 260px; }
</style>

