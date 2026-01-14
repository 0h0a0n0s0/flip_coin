# 自動化測試說明

## 概述

本目錄包含自動化測試腳本，用於執行 API 測試、錯誤處理測試和回歸測試。

## 測試執行器

### test-runner.js

主要的測試執行腳本，執行以下測試套件：

1. **v1 API 測試**
   - 認證測試（註冊、登入、獲取當前用戶）
   - 遊戲測試（獲取遊戲列表、平台名稱）
   - 用戶測試（更新暱稱）
   - 錢包測試（提款歷史、充值歷史）

2. **Admin API 測試**
   - 認證測試（管理員登入）
   - 用戶管理測試
   - 注單管理測試
   - 系統設定測試

3. **錯誤處理測試**
   - 401 錯誤（無認證）
   - 400 錯誤（無效輸入）
   - 404 錯誤（不存在的端點）

4. **回歸測試**
   - 驗證核心 API 可用性
   - 驗證拆分後的路由正常工作

## 使用方法

### 前置條件

1. **啟動服務器**

```bash
# 在 apps/backend-legacy 目錄
npm start
# 或
node server.js
```

2. **安裝測試依賴（如果需要）**

```bash
npm install axios colors
```

3. **準備測試資料**

```bash
# 運行測試資料準備腳本
node scripts/prepare-test-data.js
```

### 執行測試

```bash
# 使用默認配置（http://localhost:3000）
node tests/test-runner.js

# 或指定 API 基礎 URL
API_BASE_URL=http://localhost:3000 node tests/test-runner.js
```

### 測試結果

測試執行完成後，會輸出：

- 總測試數
- 通過/失敗/跳過的測試數
- 錯誤列表
- 執行時間

退出碼：
- `0`: 所有測試通過
- `1`: 有測試失敗

## 測試配置

可以在 `test-runner.js` 中修改以下配置：

```javascript
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_CONFIG = {
    timeout: 10000, // 請求超時時間（毫秒）
    retries: 3,     // 重試次數
};
```

## 測試數據

測試使用以下測試帳號（需要在資料庫中準備）：

- **測試用戶**: 
  - 用戶名: `testuser`
  - 密碼: `test123`

- **測試管理員**: 
  - 用戶名: `admin`
  - 密碼: `admin123`

可以通過 `scripts/prepare-test-data.js` 創建測試管理員。

## 擴展測試

要添加新的測試用例，可以在 `testSuites` 對象中添加新的測試函數：

```javascript
async testNewFeature() {
    log('\n=== 新功能測試 ===', 'test');
    
    const result = await makeRequest('GET', '/api/v1/new-endpoint');
    if (result.success && result.response) {
        assertResponseFormat(result.response);
    }
}
```

然後在 `runTests()` 函數中調用：

```javascript
await testSuites.testNewFeature();
```

## 注意事項

1. **測試環境**: 確保使用測試資料庫，避免影響生產數據
2. **服務器狀態**: 測試前確保服務器已啟動並可訪問
3. **測試數據**: 某些測試需要預先準備的測試數據
4. **並發測試**: 當前測試是順序執行的，不適合並發測試

## 相關文檔

- `TEST_PLAN.md`: 詳細的測試計劃和測試案例
- `TEST_ENVIRONMENT_SETUP.md`: 測試環境設置指南

