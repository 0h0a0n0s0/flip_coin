<template>
  <div class="page-container data-retention-container">
    <h2>資料保存規範</h2>
    <p class="page-description">
      本頁面彙整各類資料的保存期限，供營運團隊參考。規範依據 GDPR/CCPA 隱私合規及金融監管要求制定。
    </p>

    <!-- 日誌與審計資料 -->
    <el-card shadow="never" class="retention-card">
      <template #header>
        <div class="card-header">
          <el-icon><Document /></el-icon>
          <span>日誌與審計資料</span>
        </div>
      </template>
      <el-table :data="auditRetentionData" style="width: 100%" border>
        <el-table-column prop="category" label="資料類型" width="180" />
        <el-table-column prop="retention" label="保存期限" width="150" />
        <el-table-column prop="relatedPage" label="相關頁面" width="200" />
        <el-table-column prop="remark" label="備註" />
      </el-table>
    </el-card>

    <!-- PII 個人資料（GDPR） -->
    <el-card shadow="never" class="retention-card">
      <template #header>
        <div class="card-header">
          <el-icon><User /></el-icon>
          <span>個人資料 (PII) 保存期限</span>
        </div>
      </template>
      <el-table :data="piiRetentionData" style="width: 100%" border>
        <el-table-column prop="dataType" label="資料類型" width="180" />
        <el-table-column prop="purpose" label="處理目的" width="160" />
        <el-table-column prop="legalBasis" label="法律依據" width="180" />
        <el-table-column prop="retention" label="保存期限" width="200" />
        <el-table-column prop="deletion" label="刪除機制" />
      </el-table>
    </el-card>

    <!-- 業務/財務資料 -->
    <el-card shadow="never" class="retention-card">
      <template #header>
        <div class="card-header">
          <el-icon><Money /></el-icon>
          <span>業務與財務資料</span>
        </div>
      </template>
      <el-table :data="businessRetentionData" style="width: 100%" border>
        <el-table-column prop="category" label="資料類型" width="200" />
        <el-table-column prop="retention" label="保存期限" width="180" />
        <el-table-column prop="relatedPage" label="相關頁面" width="200" />
        <el-table-column prop="remark" label="備註" />
      </el-table>
    </el-card>

    <!-- 更新說明 -->
    <el-alert
      title="規範依據"
      type="info"
      :closable="false"
      show-icon
      class="info-alert"
    >
      <template #default>
        <p>本規範依據以下標準制定：</p>
        <ul>
          <li>GDPR (歐盟一般資料保護規範) Article 5、17、30</li>
          <li>CCPA (加州消費者隱私法)</li>
          <li>金融合規要求（交易記錄 7 年）</li>
          <li>專案憲法第 13、14 章（日誌與審計、隱私合規）</li>
        </ul>
        <p class="update-note">最後更新：2026-02-12</p>
      </template>
    </el-alert>
  </div>
</template>

<script setup>
import { Document, User, Money } from '@element-plus/icons-vue';

// 日誌與審計資料保存時間
const auditRetentionData = [
  {
    category: '操作稽核日誌',
    retention: '7 年',
    relatedPage: '操作稽核日誌',
    remark: '金融合規要求，記錄管理員登入、用戶資料修改、系統設定變更等'
  },
  {
    category: '應用程式日誌',
    retention: '90 天',
    relatedPage: '-',
    remark: '應用層日誌（INFO/WARN/ERROR 等）'
  },
  {
    category: '除錯日誌',
    retention: '7 天',
    relatedPage: '-',
    remark: '僅限開發環境，生產環境禁用 DEBUG 級別'
  }
];

// PII 個人資料保存時間（GDPR）
const piiRetentionData = [
  {
    dataType: '註冊 IP',
    purpose: '風控、地區封鎖',
    legalBasis: '合法利益',
    retention: '帳號存續期間 + 1 年',
    deletion: '帳號刪除後 1 年自動清除'
  },
  {
    dataType: 'Device ID',
    purpose: '多帳號偵測',
    legalBasis: '合法利益',
    retention: '帳號存續期間 + 1 年',
    deletion: '帳號刪除後 1 年自動清除'
  },
  {
    dataType: 'Email',
    purpose: '帳號復原、通知',
    legalBasis: '合約履行',
    retention: '帳號存續期間 + 5 年',
    deletion: '用戶主動刪除或法定期限後'
  },
  {
    dataType: '登入日誌 (IP/Device)',
    purpose: '安全審計',
    legalBasis: '合法利益',
    retention: '帳號存續期間 + 1 年',
    deletion: '與用戶主記錄同步刪除'
  }
];

// 業務/財務資料保存時間
const businessRetentionData = [
  {
    category: '交易記錄（投注、充值、提款）',
    retention: '7 年',
    relatedPage: '注單列表、充值記錄、提款審核',
    remark: '法律義務，不可刪除。GDPR 帳號刪除時改為匿名化保留'
  },
  {
    category: '餘額變動記錄',
    retention: '7 年',
    relatedPage: '账变记录',
    remark: '財務審計需求'
  },
  {
    category: '歸集記錄',
    retention: '7 年',
    relatedPage: '归集记录',
    remark: '區塊鏈交易對帳'
  }
];
</script>

<style scoped>
.page-container {
  padding: 20px;
}

.page-description {
  color: #606266;
  font-size: 14px;
  margin-bottom: 24px;
  line-height: 1.6;
}

.retention-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.card-header .el-icon {
  font-size: 18px;
}

.info-alert {
  margin-top: 24px;
}

.info-alert ul {
  margin: 8px 0 0 0;
  padding-left: 20px;
}

.info-alert p {
  margin: 0;
}

.update-note {
  margin-top: 12px !important;
  font-size: 12px;
  color: #909399;
}
</style>
