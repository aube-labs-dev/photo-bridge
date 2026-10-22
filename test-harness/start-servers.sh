#!/bin/bash
# 테스트 서버 2개 기동 (backend + harness), 로그는 /tmp
cd /Users/jonghwa/dev/source/photo-bridge
NB=/Users/jonghwa/.nvm/versions/node/v22.18.0/bin/node
pkill -f "dist/main.js" 2>/dev/null
pkill -f "test-harness/server.js" 2>/dev/null
sleep 1
$NB backend/dist/main.js > /tmp/pb_backend.log 2>&1 &
echo "backend_pid=$!"
HARNESS_PORT=8099 $NB test-harness/server.js > /tmp/pb_harness.log 2>&1 &
echo "harness_pid=$!"
sleep 3
echo "=== backend log ==="; cat /tmp/pb_backend.log
echo "=== harness log ==="; cat /tmp/pb_harness.log
echo "=== 리슨 3000 ==="; lsof -nP -iTCP:3000 -sTCP:LISTEN 2>/dev/null | tail -1
echo "=== 리슨 8099 ==="; lsof -nP -iTCP:8099 -sTCP:LISTEN 2>/dev/null | tail -1
