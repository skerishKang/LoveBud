import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3456;
const PROXY_TARGET = 'lovebud.pages.dev';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  if (url.pathname.startsWith('/api/')) {
    const options = {
      hostname: PROXY_TARGET,
      port: 443,
      path: url.pathname + url.search,
      method: req.method,
      headers: { ...req.headers, host: PROXY_TARGET },
    };
    const proxyReq = https.request(options, (proxyRes) => {
      const headers = { ...proxyRes.headers };
      delete headers['transfer-encoding'];
      delete headers['content-encoding'];
      res.writeHead(proxyRes.statusCode, headers);
      const chunks = [];
      proxyRes.on('data', chunk => chunks.push(chunk));
      proxyRes.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const ce = proxyRes.headers['content-encoding'];
        if (ce === 'gzip') {
          import('node:zlib').then(z => z.gunzip(buffer, (_, d) => res.end(d || buffer)));
        } else {
          res.end(buffer);
        }
      });
    });
    proxyReq.on('error', () => { res.writeHead(502); res.end('Bad Gateway'); });
    req.pipe(proxyReq);
    return;
  }
  
  let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      const altPath = path.join(__dirname, 'pages', url.pathname.replace(/^\//, ''));
      fs.readFile(altPath, (err2, data2) => {
        if (err2) { res.writeHead(404); res.end('Not found: ' + url.pathname); return; }
        const ext = path.extname(altPath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data2);
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Dev proxy running at http://localhost:${PORT}`);
  console.log(`API proxied to https://${PROXY_TARGET}`);
});
