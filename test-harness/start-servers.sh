#!/bin/bash
# 테스트 서버 2개 기동 (wrangler dev Worker + harness), 로그는 /tmp
cd /Users/jonghwa/dev/source/photo-bridge
NB=/Users/jonghwa/.nvm/versions/node/v22.18.0/bin/node
NPX=/Users/jonghwa/.nvm/versions/node/v22.18.0/bin/npx
pkill -f "wrangler dev" 2>/dev/null
pkill -f "test-harness/server.js" 2>/dev/null
pkill -f "workerd" 2>/dev/null
sleep 1

# wrangler dev (Worker + Durable Object) on 8787, local 모드
cd signaling
PATH=/Users/jonghwa/.nvm/versions/node/v22.18.0/bin:$PATH \
  $NPX wrangler dev --port 8795 --local --ip 127.0.0.1 > /tmp/pb_worker.log 2>&1 &
echo "worker_pid=$!"
cd ..

# harness (정적 서빙 + /ws 프록시) on 8099
HARNESS_PORT=8099 WORKER_URL=http://127.0.0.1:8795 $NB test-harness/server.js > /tmp/pb_harness.log 2>&1 &
echo "harness_pid=$!"

# wrangler dev는 기동이 느림 → 최대 40초 대기
for i in $(seq 1 40); do
  if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8795/health 2>/dev/null | grep -q 200; then
    echo "worker ready after ${i}s"
    break
  fi
  sleep 1
done
echo "=== worker log (tail) ==="; tail -5 /tmp/pb_worker.log
echo "=== harness log ==="; cat /tmp/pb_harness.log
echo "=== health via harness ==="; curl -s http://localhost:8099/health
