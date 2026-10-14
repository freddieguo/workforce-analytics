#!/bin/bash
# 一键更新数据：跑管线 -> 提交 dashboard.json -> 推送
# 每天用法：把当天的新 Excel 放进 data/raw/，然后跑 ./update.sh
set -e
cd "$(dirname "$0")"

echo "=== 1. 跑管线 ==="
python3 scripts/run_all.py

echo ""
echo "=== 2. 提交 + 推送 ==="
git add data/processed/dashboard.json
if git diff --cached --quiet; then
  echo "数据没有变化，不用提交。"
else
  git commit -m "更新数据 $(date +%Y-%m-%d)"
  git push
  echo "已推送，Vercel 会自动重新部署。"
fi
