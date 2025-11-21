<template>
  <div class="same-ip-monitor">
    <h2>同 IP 风控监控</h2>

    <el-card shadow="never" class="info-card">
      <p>
        当前风控阈值：
        <strong>{{ threshold }}</strong>
        <span class="note">（超过该数量的同 IP 账号会触发自动封锁）</span>
      </p>
      <el-button type="primary" link @click="$router.push('/settings/game-parameters')">
        前往系统参数设定
      </el-button>
    </el-card>

    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-table :data="ipList" style="width: 100%">
        <el-table-column prop="ip_address" label="IP 地址" width="180" />
        <el-table-column prop="total_count" label="总用户数" width="120" />
        <el-table-column prop="active_count" label="启用中" width="120" />
        <el-table-column prop="banned_count" label="已封锁" width="120" />
        <el-table-column prop="last_activity_at" label="最后活动时间" width="200">
          <template #default="scope">
            {{ formatDateTime(scope.row.last_activity_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="scope">
            <el-button size="small" @click="handleViewDetail(scope.row)">查看详情</el-button>
            <el-button size="small" type="danger" @click="handleBan(scope.row)" :disabled="scope.row.banned_count === scope.row.total_count">一键封锁</el-button>
            <el-button size="small" type="success" @click="handleUnban(scope.row)" :disabled="scope.row.active_count === scope.row.total_count">一键解禁</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="detailDialog.visible"
      title="IP 用户详情"
      width="800px"
      :close-on-click-modal="false"
    >
      <p class="dialog-ip">IP：{{ detailDialog.ip }}</p>
      <el-table :data="detailDialog.users" style="width: 100%" v-loading="detailDialog.loading">
        <el-table-column prop="user_id" label="用户ID" width="120" />
        <el-table-column prop="username" label="帐号" width="150" />
        <el-table-column prop="nickname" label="昵称" width="150" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'active' ? 'success' : 'danger'">
              {{ scope.row.status === 'active' ? '启用' : '封锁' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="last_activity_at" label="最后活动时间" width="200">
          <template #default="scope">
            {{ formatDateTime(scope.row.last_activity_at) }}
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus';
import { getSameIpSummary, getUsersByIp, banUsersByIp, unbanUsersByIp } from '@/api';

export default {
  name: 'SameIpMonitor',
  data() {
    return {
      loading: false,
      ipList: [],
      threshold: '-',
      detailDialog: {
        visible: false,
        ip: '',
        loading: false,
        users: []
      }
    };
  },
  created() {
    this.fetchSummary();
  },
  methods: {
    async fetchSummary() {
      this.loading = true;
      try {
        const response = await getSameIpSummary();
        this.threshold = response.threshold ?? '-';
        this.ipList = response.list || [];
      } catch (error) {
        console.error('Failed to fetch same IP summary:', error);
        ElMessage.error('载入同 IP 风控资料失败');
      } finally {
        this.loading = false;
      }
    },
    formatDateTime(value) {
      if (!value) return '-';
      try {
        return new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
      } catch (e) {
        return value;
      }
    },
    async handleViewDetail(row) {
      this.detailDialog.visible = true;
      this.detailDialog.ip = row.ip_address;
      this.detailDialog.loading = true;
      this.detailDialog.users = [];
      try {
        const response = await getUsersByIp(row.ip_address);
        this.detailDialog.users = response.list || [];
      } catch (error) {
        console.error('Failed to fetch users by IP:', error);
        ElMessage.error('载入用户详情失败');
      } finally {
        this.detailDialog.loading = false;
      }
    },
    async handleBan(row) {
      try {
        await ElMessageBox.confirm(`确定要封锁 IP ${row.ip_address} 下的所有用户吗？`, '封锁确认', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        });
        await banUsersByIp(row.ip_address);
        ElMessage.success('封锁成功');
        this.fetchSummary();
        if (this.detailDialog.visible && this.detailDialog.ip === row.ip_address) {
          this.handleViewDetail(row);
        }
      } catch (error) {
        if (error !== 'cancel') {
          console.error('Failed to ban users by IP:', error);
          ElMessage.error(error.response?.data?.error || '封锁失败');
        }
      }
    },
    async handleUnban(row) {
      try {
        await ElMessageBox.confirm(`确定要解禁 IP ${row.ip_address} 下的所有用户吗？`, '解禁确认', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        });
        await unbanUsersByIp(row.ip_address);
        ElMessage.success('解禁成功');
        this.fetchSummary();
        if (this.detailDialog.visible && this.detailDialog.ip === row.ip_address) {
          this.handleViewDetail(row);
        }
      } catch (error) {
        if (error !== 'cancel') {
          console.error('Failed to unban users by IP:', error);
          ElMessage.error(error.response?.data?.error || '解禁失败');
        }
      }
    }
  }
};
</script>

<style scoped>
.same-ip-monitor {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.info-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.info-card .note {
  margin-left: 10px;
  color: #909399;
  font-size: 14px;
}
.table-card {
  margin-bottom: 20px;
}
.dialog-ip {
  margin-bottom: 10px;
  font-weight: bold;
}
</style>

