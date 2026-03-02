#!/bin/bash

# Cyber Gain Web 開發服務器啟動腳本
# 支援 Docker 和本地兩種方式

echo "🚀 Cyber Gain Web 啟動腳本"
echo "================================"
echo ""
echo "請選擇啟動方式："
echo "  [1] Docker 方式（推薦，無需安裝依賴）"
echo "  [2] 本地開發方式（需要 pnpm）"
echo ""
read -p "請輸入選項 [1/2]: " choice

case $choice in
  1)
    echo ""
    echo "🐳 使用 Docker 啟動..."
    echo "================================"
    
    # 檢查 Docker 是否運行
    if ! docker info > /dev/null 2>&1; then
      echo "❌ Docker 未運行，請先啟動 Docker Desktop"
      exit 1
    fi
    
    # 切換到項目根目錄
    cd "$(dirname "$0")"
    
    # 構建並啟動 cyber-gain-web 服務
    echo "📦 正在構建 Docker 鏡像..."
    docker compose build cyber-gain-web
    
    echo ""
    echo "🚀 正在啟動容器..."
    docker compose up cyber-gain-web
    
    echo ""
    echo "✅ Cyber Gain Web 已啟動"
    echo "🌐 訪問地址：http://localhost:3001"
    ;;
    
  2)
    echo ""
    echo "💻 使用本地方式啟動..."
    echo "================================"
    
    # 檢查 pnpm 是否安裝
    if ! command -v pnpm &> /dev/null; then
      echo "❌ pnpm 未安裝"
      echo ""
      echo "請選擇安裝方式："
      echo "  [A] 使用 npm 安裝（推薦）："
      echo "      npm install -g pnpm"
      echo ""
      echo "  [B] 使用 corepack（需要 sudo）："
      echo "      sudo corepack enable"
      echo ""
      exit 1
    fi
    
    # 切換到項目根目錄
    cd "$(dirname "$0")"
    
    # 檢查是否已安裝依賴
    if [ ! -d "node_modules" ]; then
      echo "📦 首次運行，正在安裝依賴..."
      pnpm install
      echo ""
    fi
    
    # 啟動開發服務器
    echo "✅ 依賴已就緒"
    echo "🌐 開發服務器將在 http://localhost:3001 啟動"
    echo ""
    
    cd apps/cyber-gain-web
    pnpm dev
    ;;
    
  *)
    echo "❌ 無效選項，請重新執行腳本"
    exit 1
    ;;
esac
