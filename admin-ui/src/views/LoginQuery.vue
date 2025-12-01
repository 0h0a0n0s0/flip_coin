<template>
  <div class="login-query-container">
    <h2>登录查询</h2>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchParams" @submit.native.prevent="handleSearch" class="search-form">
        
        <el-form-item label="用户ID">
          <el-input v-model="searchParams.userId" placeholder="请输入用户ID" clearable></el-input>
        </el-form-item>

        <el-form-item label="登录IP">
          <el-input v-model="searchParams.loginIp" placeholder="请输入登录IP查询" clearable></el-input>
        </el-form-item>

        <el-form-item label="注册IP">
          <el-input v-model="searchParams.registrationIp" placeholder="请输入注册IP" clearable></el-input>
        </el-form-item>
        
        <el-form-item label="下注IP">
          <el-input v-model="searchParams.betIp" placeholder="请输入下注IP查询" clearable></el-input>
        </el-form-item>

        <el-form-item label="日期">
          <el-date-picker
            v-model="searchParams.dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DDTHH:mm:ssZ"
            clearable
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleExport">导出</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-table :data="tableData" style="width: 100%" :cell-style="{ paddingTop: '8px', paddingBottom: '8px' }">
        
        <el-table-column prop="user_id" label="用户ID" width="120" fixed="left" />
        <el-table-column prop="username" label="用户帐号" width="150" />
        
        <el-table-column prop="first_login_country" label="首次登陆地区" width="150">
          <template #default="scope">{{ scope.row.first_login_country || '-' }}</template>
        </el-table-column>
        
        <el-table-column label="登陆同IP" width="130">
          <template #default="scope">
            <el-button 
              v-if="scope.row.same_login_ip_count > 0" 
              type="primary" 
              link 
              @click="showDetailDialog('loginIp', scope.row)"
            >
              重复IP({{ scope.row.same_login_ip_count }})
            </el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
        
        <el-table-column label="注册同IP" width="130">
          <template #default="scope">
            <el-button 
              v-if="scope.row.same_registration_ip_count > 0" 
              type="primary" 
              link 
              @click="showDetailDialog('registrationIp', scope.row)"
            >
              重复IP({{ scope.row.same_registration_ip_count }})
            </el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
        
        <el-table-column label="下注同IP" width="130">
          <template #default="scope">
            <el-button 
              v-if="scope.row.same_bet_ip_count > 0" 
              type="primary" 
              link 
              @click="showDetailDialog('betIp', scope.row)"
            >
              重复IP({{ scope.row.same_bet_ip_count }})
            </el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
        
        <el-table-column label="注册同密码" width="130">
          <template #default="scope">
            <el-button 
              v-if="scope.row.same_registration_password_count > 0" 
              type="primary" 
              link 
              @click="showDetailDialog('registrationPassword', scope.row)"
            >
              同密码({{ scope.row.same_registration_password_count }})
            </el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
        
        <el-table-column label="资金同密码" width="130">
          <template #default="scope">
            <el-button 
              v-if="scope.row.same_withdrawal_password_count > 0" 
              type="primary" 
              link 
              @click="showDetailDialog('withdrawalPassword', scope.row)"
            >
              同密码({{ scope.row.same_withdrawal_password_count }})
            </el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
        
        <el-table-column label="同设备ID" width="130">
          <template #default="scope">
            <el-button 
              v-if="scope.row.same_device_id_count > 0" 
              type="primary" 
              link 
              @click="showDetailDialog('deviceId', scope.row)"
            >
              同设备ID({{ scope.row.same_device_id_count }})
            </el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="created_at" label="注册时间" width="180">
          <template #default="scope">{{ formatDateTime(scope.row.created_at) }}</template>
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

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailDialogVisible"
      :title="detailDialogTitle"
      width="800px"
      :close-on-click-modal="false"
    >
      <div class="detail-header">
        <el-form :inline="true">
          <el-form-item label="日期:">
            <el-date-picker
              v-model="detailDateRange"
              type="datetimerange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DDTHH:mm:ssZ"
              clearable
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="fetchDetailData">查询</el-button>
            <el-button @click="handleDetailExport">导出</el-button>
          </el-form-item>
        </el-form>
      </div>
      
      <el-table :data="detailData" v-loading="detailLoading" style="margin-top: 20px;">
        <el-table-column prop="user_id" label="玩家ID" width="120" />
        <el-table-column 
          v-if="detailType === 'loginIp' || detailType === 'registrationIp' || detailType === 'betIp'" 
          :prop="detailType === 'betIp' ? 'bet_ip' : (detailType === 'registrationIp' ? 'registration_ip' : 'login_ip')" 
          label="IP地址" 
          width="150" 
        />
        <el-table-column 
          v-if="detailType === 'registrationPassword' || detailType === 'withdrawalPassword'" 
          prop="masked_password" 
          label="密码" 
          width="200" 
        />
        <el-table-column 
          v-if="detailType === 'deviceId'" 
          prop="device_id" 
          label="设备ID" 
          width="200" 
        />
        <el-table-column prop="registration_time" label="注册时间" width="180">
          <template #default="scope">{{ formatDateTime(scope.row.registration_time) }}</template>
        </el-table-column>
        <el-table-column prop="last_login_time" label="登录时间" width="180">
          <template #default="scope">{{ formatDateTime(scope.row.last_login_time) }}</template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus';

export default {
  name: 'LoginQueryView',
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
        userId: '',
        loginIp: '',
        registrationIp: '',
        betIp: '',
        dateRange: null,
      },
      detailDialogVisible: false,
      detailDialogTitle: '',
      detailType: '',
      detailUserId: '',
      detailData: [],
      detailLoading: false,
      detailDateRange: null,
    };
  },
  created() {
    this.fetchData();
  },
  methods: {
    async fetchData() {
      if (this.loading) return;
      this.loading = true;
      try {
        const params = {
          ...this.pagination,
          userId: this.searchParams.userId || undefined,
          loginIp: this.searchParams.loginIp || undefined,
          registrationIp: this.searchParams.registrationIp || undefined,
          betIp: this.searchParams.betIp || undefined,
          dateRange: this.searchParams.dateRange ? JSON.stringify(this.searchParams.dateRange) : undefined,
        };
        const response = await this.$api.getLoginQuery(params);
        this.tableData = response.list;
        this.totalItems = response.total;
      } catch (error) {
        console.error('Failed to fetch login query data:', error);
        ElMessage.error('加载数据失败');
      } finally {
        this.loading = false;
      }
    },
    
    async showDetailDialog(type, row) {
      this.detailType = type;
      this.detailUserId = row.user_id;
      this.detailDateRange = null;
      this.detailData = [];
      
      const titles = {
        loginIp: '详情',
        registrationIp: '详情',
        betIp: '详情',
        registrationPassword: '详情',
        withdrawalPassword: '详情',
        deviceId: '详情',
      };
      this.detailDialogTitle = titles[type] || '详情';
      this.detailDialogVisible = true;
      
      await this.fetchDetailData();
    },
    
    async fetchDetailData() {
      this.detailLoading = true;
      try {
        const endpointMap = {
          loginIp: `/login-query/same-login-ip/${this.detailUserId}`,
          registrationIp: `/login-query/same-registration-ip/${this.detailUserId}`,
          betIp: `/login-query/same-bet-ip/${this.detailUserId}`,
          registrationPassword: `/login-query/same-registration-password/${this.detailUserId}`,
          withdrawalPassword: `/login-query/same-withdrawal-password/${this.detailUserId}`,
          deviceId: `/login-query/same-device-id/${this.detailUserId}`,
        };
        
        const endpoint = endpointMap[this.detailType];
        if (!endpoint) {
          ElMessage.error('未知的详情类型');
          return;
        }
        
        const response = await this.$api.getLoginQueryDetail(endpoint);
        this.detailData = response.list || [];
        
        // 如果有日期筛选，进行过滤
        if (this.detailDateRange && this.detailDateRange.length === 2) {
          const [startDate, endDate] = this.detailDateRange;
          this.detailData = this.detailData.filter(item => {
            const loginTime = new Date(item.last_login_time);
            return loginTime >= new Date(startDate) && loginTime <= new Date(endDate);
          });
        }
      } catch (error) {
        console.error('Failed to fetch detail data:', error);
        ElMessage.error('加载详情数据失败');
      } finally {
        this.detailLoading = false;
      }
    },
    
    handleSearch() {
      this.pagination.page = 1;
      this.fetchData();
    },
    
    handleSizeChange(newLimit) {
      this.pagination.limit = newLimit;
      this.pagination.page = 1;
      this.fetchData();
    },
    
    handlePageChange(newPage) {
      this.pagination.page = newPage;
      this.fetchData();
    },
    
    handleExport() {
      ElMessage.info('导出功能开发中');
    },
    
    handleDetailExport() {
      ElMessage.info('导出功能开发中');
    },
    
    formatDateTime(isoString) {
      if (!isoString) return '';
      try {
        return new Date(isoString).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
      } catch (e) {
        return isoString;
      }
    },
  },
};
</script>

<style scoped>
.search-card {
  margin-bottom: 20px;
}
.table-card {
  margin-bottom: 20px;
}
.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
.search-form :deep(.el-input) {
  width: 180px;
}
.search-form :deep(.el-select) {
  width: 180px;
}
.search-form :deep(.el-date-picker) {
  width: 240px;
}
.detail-header {
  margin-bottom: 20px;
}
</style>

