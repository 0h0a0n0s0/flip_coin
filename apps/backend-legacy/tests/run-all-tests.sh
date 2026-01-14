#!/bin/bash
# 執行所有自動化測試的腳本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

echo "=== 自動化測試執行腳本 ==="
echo ""

# 檢查 Node.js
if ! command -v node &> /dev/null; then
    echo "錯誤: 未找到 Node.js，請先安裝 Node.js"
    exit 1
fi

echo "Node.js 版本: $(node --version)"
echo ""

# 檢查服務器是否運行
echo "檢查服務器狀態..."
if curl -s -f -o /dev/null "http://localhost:3000/api/v1/games" 2>/dev/null; then
    echo "✓ 服務器正在運行 (http://localhost:3000)"
else
    echo "⚠ 警告: 無法連接到服務器 (http://localhost:3000)"
    echo "  請確保服務器已啟動："
    echo "    cd apps/backend-legacy && npm start"
    echo ""
    read -p "是否繼續執行測試？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""

# 設置 API 基礎 URL（可通過環境變數覆蓋）
export API_BASE_URL=${API_BASE_URL:-http://localhost:3000}

# 執行測試
echo "開始執行測試..."
echo "API 基礎 URL: $API_BASE_URL"
echo ""

node tests/test-runner.js

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✓ 所有測試通過"
else
    echo "✗ 測試失敗 (退出碼: $EXIT_CODE)"
fi

exit $EXIT_CODE

