'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../build');
const port = Number(process.env.FRONTEND_PORT || 3000);
const backendPort = Number(process.env.BACKEND_PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('FRONTEND_PORT must be valid');
if (!Number.isInteger(backendPort) || backendPort < 1 || backendPort > 65535) throw new Error('BACKEND_PORT must be valid');

const types = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'], ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'], ['.txt', 'text/plain; charset=utf-8'],
]);

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    const proxyRequest = http.request({
      hostname: '127.0.0.1',
      port: backendPort,
      method: request.method,
      path: request.url,
      headers: { ...request.headers, host: `127.0.0.1:${backendPort}` },
    }, (proxyResponse) => {
      response.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
      proxyResponse.pipe(response);
    });
    proxyRequest.on('error', () => response.writeHead(502).end('Backend unavailable'));
    request.pipe(proxyRequest);
    return;
  }
  const requested = path.resolve(root, `.${pathname}`);
  const candidate = requested.startsWith(`${root}${path.sep}`) && fs.existsSync(requested) && fs.statSync(requested).isFile()
    ? requested : path.join(root, 'index.html');
  if (!candidate.startsWith(`${root}${path.sep}`)) {
    response.writeHead(400).end('Bad request');
    return;
  }
  response.setHeader('Content-Type', types.get(path.extname(candidate)) || 'application/octet-stream');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', candidate.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable');
  fs.createReadStream(candidate).on('error', () => response.writeHead(500).end('Read failed')).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Finance frontend listening on 127.0.0.1:${port}`);
});
