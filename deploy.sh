#!/bin/bash
set -e

# ==============================
# 配置区：按实际情况修改
# ==============================
PROJECT_DIR="/your/project/path"   # 项目根目录
PM2_NAME="texas"                   # pm2 list 里显示的进程名

# ==============================
# 部署流程
# ==============================
echo "▶ 进入项目目录..."
cd "$PROJECT_DIR"

echo "▶ 拉取最新代码..."
git pull origin master

echo "▶ 安装依赖..."
npm run install:all

echo "▶ 构建前端..."
npm run build --prefix client

echo "▶ 重启后端..."
pm2 restart "$PM2_NAME"

echo "✅ 部署完成"
