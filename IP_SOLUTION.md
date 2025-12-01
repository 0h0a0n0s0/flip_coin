# IP 獲取問題解決方案

## 問題描述

用戶通過 OpenVPN 連接到 IP `114.34.82.230`，訪問 `http://192.168.50.124:8080/`，但後台記錄的 IP 是 Docker 網關 IP `192.168.65.1`，而不是真實客戶端 IP。

## 環境分析

- **系統**：macOS (Darwin) + Docker Desktop
- **問題**：Docker Desktop 在 macOS 上運行在虛擬機中，`network_mode: "host"` 不起作用
- **Docker 網關**：`172.18.0.1` 或 `192.168.65.1`

## 解決方案

### 方案一：使用 Nginx realip 模組（已實施）✅

**適用於**：Docker Desktop (Mac/Windows) 和 Linux 服務器

**原理**：
- 使用 Nginx 的 `realip` 模組
- 將 Docker 內部 IP 範圍設為「可信代理」
- 從 `X-Forwarded-For` 頭中提取真實 IP

**實施步驟**：

1. **創建自訂 nginx.conf**（包含 realip 配置）
2. **修改 Dockerfile**（複製自訂配置）
3. **重啟服務**

**優點**：
- ✅ 適用於 Docker Desktop
- ✅ 不需要修改 docker-compose.yml
- ✅ 保持 Docker 網路隔離

**限制**：
- 需要 `X-Forwarded-For` 頭存在
- 如果請求直接進入容器且沒有代理，可能仍無法獲取真實 IP

### 方案二：Host 網路模式（Gemini 方案）

**適用於**：Linux 服務器（不適用於 Docker Desktop）

**原理**：
- 使用 `network_mode: "host"`
- Nginx 直接使用宿主機網路堆棧
- 繞過 Docker NAT，直接看到真實 IP

**實施步驟**（僅在 Linux 服務器上）：

1. 修改 `docker-compose.yml`：
```yaml
nginx:
  network_mode: "host"
  # 移除 ports 映射
```

2. 修改 `nginx/default.conf`：
```nginx
listen 8080;  # 直接監聽宿主機端口
proxy_pass http://127.0.0.1:3000;  # 連接本地 API
```

**優點**：
- ✅ 在 Linux 上完美工作
- ✅ 直接獲取真實 IP

**限制**：
- ❌ 在 Docker Desktop (Mac/Windows) 上不起作用
- ❌ 失去 Docker 網路隔離優勢

## 當前實施狀態

✅ **已實施方案一**（realip 模組）

### 文件變更：

1. **nginx/nginx.conf**（新建）
   - 包含 realip 模組配置
   - 設定可信代理 IP 範圍

2. **nginx/Dockerfile**（修改）
   - 複製自訂 nginx.conf

3. **nginx/default.conf**（簡化）
   - 移除 realip 配置（已移到 nginx.conf）

## 測試方法

1. **重啟服務**：
```bash
docker-compose down
docker-compose up -d --build
```

2. **讓用戶重新登入**：
   - 通過 VPN 訪問 `http://192.168.50.124:8080/`
   - 重新登入

3. **檢查記錄的 IP**：
```sql
SELECT user_id, last_login_ip, last_activity_at 
FROM users 
WHERE user_id = '15470016';
```

4. **查看日誌**：
```bash
docker-compose logs api | grep -E "(15470016|Login.*IP)"
```

## 預期結果

- ✅ 後台記錄的 IP 應該是 VPN IP（例如 `10.8.0.x` 或 `114.34.82.230`）
- ✅ 不應該是 Docker 網關 IP（`192.168.65.1` 或 `172.18.0.1`）

## 如果方案一不起作用

如果 realip 模組方案不起作用（因為 Docker Desktop 的限制），可以考慮：

1. **在宿主機上運行 Nginx**（不使用 Docker）
   - 在 macOS 上安裝 Nginx
   - 配置反向代理到 Docker 的 API 端口（3000）
   - 這樣宿主機的 Nginx 可以獲取真實 IP

2. **部署到 Linux 服務器**
   - 在 Linux 服務器上使用 Host 模式（方案二）
   - 或繼續使用 realip 模組方案

## 注意事項

- 如果用戶是通過 VPN 訪問，記錄的 IP 可能是 VPN 服務器分配的內網 IP
- 如果需要獲取用戶的真實公網 IP，需要 VPN 服務器正確傳遞 `X-Forwarded-For` 頭

