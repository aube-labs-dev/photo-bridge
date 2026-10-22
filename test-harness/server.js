// 테스트용 통합 서버: frontend/out 정적 서빙 + /ws,/turn-credentials,/health → Worker(wrangler dev, 8787) 프록시
// 운영 Cloudflare(Pages + Worker) 역할을 로컬에서 대신한다.
const http = require('http');
const fs = require('fs');
const path = require('path');
const httpProxy = require('http-proxy');

const STATIC_DIR = path.join(__dirname, '..', 'frontend', 'out');
const WORKER = process.env.WORKER_URL || 'http://localhost:8787';
const PORT = process.env.HARNESS_PORT ? Number(process.env.HARNESS_PORT) : 8099;

const proxy = httpProxy.createProxyServer({ target: WORKER, ws: true });
proxy.on('error', (err) => console.error('[proxy] error', err.message));

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
};

function isWorkerPath(url) {
  return (
    url.startsWith('/ws') ||
    url.startsWith('/turn-credentials') ||
    url.startsWith('/health')
  );
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  let filePath = path.join(STATIC_DIR, urlPath);

  if (!path.extname(filePath)) {
    if (fs.existsSync(filePath + '.html')) filePath = filePath + '.html';
    else if (fs.existsSync(path.join(filePath, 'index.html')))
      filePath = path.join(filePath, 'index.html');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(STATIC_DIR, 'index.html'), (e2, idx) => {
        if (e2) {
          res.writeHead(404);
          res.end('Not found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(idx);
        }
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (isWorkerPath(req.url)) {
    proxy.web(req, res);
  } else {
    serveStatic(req, res);
  }
});

// WebSocket 업그레이드 프록시 (/ws → Worker)
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/ws')) {
    proxy.ws(req, socket, head);
  }
});

server.listen(PORT, () => {
  console.log(
    `[harness] listening on http://localhost:${PORT} (static=${STATIC_DIR}, worker=${WORKER})`,
  );
});
