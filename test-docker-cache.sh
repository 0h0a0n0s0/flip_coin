#!/bin/bash

# Docker 層緩存測試腳本
# 用於驗證 Dockerfile 優化是否生效

set -e

echo "=========================================="
echo "🔍 Docker 層緩存測試腳本"
echo "=========================================="
echo ""

# 顏色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 步驟 1: 清理舊的構建
echo -e "${YELLOW}步驟 1: 清理舊的 Docker 緩存...${NC}"
docker-compose down 2>/dev/null || true
echo "✅ 清理完成"
echo ""

# 步驟 2: 首次構建（建立緩存層）
echo -e "${YELLOW}步驟 2: 首次構建（這會比較慢，建立緩存層）...${NC}"
echo "開始時間: $(date '+%Y-%m-%d %H:%M:%S')"
START_TIME=$(date +%s)

docker-compose build api

END_TIME=$(date +%s)
FIRST_BUILD_TIME=$((END_TIME - START_TIME))
echo ""
echo -e "${GREEN}✅ 首次構建完成！耗時: ${FIRST_BUILD_TIME} 秒${NC}"
echo ""

# 步驟 3: 修改源碼文件（模擬開發場景）
echo -e "${YELLOW}步驟 3: 模擬源碼變更（添加註釋到 server.js）...${NC}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "// Docker 緩存測試 - 時間: ${TIMESTAMP}" >> apps/backend-legacy/server.js
echo "✅ 源碼已修改"
echo ""

# 步驟 4: 重新構建（測試緩存）
echo -e "${YELLOW}步驟 4: 重新構建（應該很快，利用緩存）...${NC}"
echo "開始時間: $(date '+%Y-%m-%d %H:%M:%S')"
START_TIME=$(date +%s)

docker-compose build api

END_TIME=$(date +%s)
SECOND_BUILD_TIME=$((END_TIME - START_TIME))
echo ""
echo -e "${GREEN}✅ 第二次構建完成！耗時: ${SECOND_BUILD_TIME} 秒${NC}"
echo ""

# 步驟 5: 恢復源碼文件
echo -e "${YELLOW}步驟 5: 恢復源碼文件...${NC}"
git checkout apps/backend-legacy/server.js 2>/dev/null || true
echo "✅ 源碼已恢復"
echo ""

# 結果分析
echo "=========================================="
echo "📊 測試結果分析"
echo "=========================================="
echo -e "首次構建時間: ${YELLOW}${FIRST_BUILD_TIME} 秒${NC}"
echo -e "第二次構建時間: ${YELLOW}${SECOND_BUILD_TIME} 秒${NC}"
echo ""

if [ $SECOND_BUILD_TIME -lt 120 ]; then
    echo -e "${GREEN}🎉 優化成功！第二次構建時間少於 2 分鐘！${NC}"
    echo -e "${GREEN}層緩存正常工作，pnpm install 步驟被跳過。${NC}"
    SPEEDUP=$((FIRST_BUILD_TIME / SECOND_BUILD_TIME))
    echo -e "${GREEN}提速倍數: ${SPEEDUP}x${NC}"
else
    echo -e "${RED}⚠️  第二次構建仍然較慢（超過 2 分鐘）${NC}"
    echo -e "${RED}可能原因：${NC}"
    echo "  1. pnpm-lock.yaml 未正確生成或未被複製到容器"
    echo "  2. .dockerignore 配置有誤"
    echo "  3. Docker 守護進程緩存設置問題"
    echo ""
    echo "建議執行: docker-compose build --no-cache api"
fi

echo ""
echo "=========================================="
echo "💡 提示：查看構建日誌中的 'CACHED' 標記"
echo "=========================================="
echo "如果看到以下內容，表示緩存生效："
echo "  => CACHED [builder 5/8] RUN pnpm install..."
echo ""
