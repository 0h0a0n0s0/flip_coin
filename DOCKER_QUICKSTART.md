# 🚀 Cyber Gain Web - Docker 快速啟動指南

## 方案 A：Docker 方式（✅ 推薦，無需安裝 pnpm）

### 1. 構建 Docker 鏡像

```bash
cd /Users/tuofan/Desktop/Hans/flip_coin
docker compose build cyber-gain-web
```

### 2. 啟動容器

```bash
# 前台運行（可看到日誌）
docker compose up cyber-gain-web

# 後台運行
docker compose up -d cyber-gain-web
```

### 3. 訪問網站

打開瀏覽器：**http://localhost:3001**

### 4. 查看日誌

```bash
docker compose logs cyber-gain-web -f
```

### 5. 停止服務

```bash
docker compose stop cyber-gain-web
```

---

## 方案 B：互動式啟動腳本

```bash
./start-cyber-gain.sh
```

選擇 `[1] Docker 方式`

---

## 🐛 疑難排解

### 問題 1：構建失敗或卡住

```bash
# 清理並重建
docker compose down
docker compose build --no-cache cyber-gain-web
docker compose up cyber-gain-web
```

### 問題 2：3001 端口無法訪問

```bash
# 檢查容器狀態
docker compose ps

# 查看日誌
docker compose logs cyber-gain-web --tail=50

# 確認端口映射
docker port flipcoin-cyber-gain-web
```

### 問題 3：依賴安裝失敗（網絡問題）

Docker 已配置使用淘寶 npm 鏡像，如果還是失敗：

```bash
# 檢查 Docker 網絡
docker compose exec cyber-gain-web ping -c 3 registry.npmmirror.com

# 重新構建（清除緩存）
docker builder prune -a
docker compose build --no-cache cyber-gain-web
```

---

## 📝 與舊版本的區別

| 項目 | 舊版（FlipCoin） | 新版（Cyber Gain） |
|-----|-----------------|-------------------|
| 端口 | 3000 | **3001** |
| 訪問地址 | http://localhost:3000 | **http://localhost:3001** |
| 架構 | 後端渲染 | Vue 3 SPA |
| 佈局 | 全寬 | H5 置中（500px） |

---

## ✅ 預期效果

啟動成功後，你將看到：

1. **深灰色外層背景**（#121212）
2. **500px 寬的 APP 主容器**（置中，設計圖底色 #0B132B）
3. **頂部導航欄**：
   - 左側：黃色六角形 + "CYBER GAIN" Logo
   - 右側：「登入」按鈕（深灰） + 「註冊」按鈕（黃色漸變）
   - 註冊按鈕右上角：紅色 +150% 徽章（帶金幣圖示）
4. **下方測試區塊**："Banner 預留區"（1000px 高，可滾動）

---

## 🔍 驗證清單

- [ ] Docker 容器 `flipcoin-cyber-gain-web` 狀態為 `Up`
- [ ] 訪問 http://localhost:3001 可以看到新界面
- [ ] PC 端佈局最大寬度 500px，左右留白
- [ ] 頂部導航顯示正確（Logo + 按鈕）
- [ ] 註冊按鈕有 +150% 徽章
- [ ] 頁面可以滾動

---

## 📞 如果還有問題

請提供以下信息：

```bash
# 1. Docker 狀態
docker compose ps

# 2. 容器日誌
docker compose logs cyber-gain-web --tail=100

# 3. 端口佔用
lsof -i :3001
```
