'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../build');
const port = Number(process.env.FRONTEND_PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('FRONTEND_PORT must be valid');

const types = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'], ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'], ['.txt', 'text/plain; charset=utf-8'],
]);

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
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
