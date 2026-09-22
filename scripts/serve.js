import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { networkInterfaces } from 'node:os';
import { getBuildVersion, stampVersion } from './version.js';

const root = process.cwd();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const target = path.resolve(root, `.${pathname}`);
    if (!target.startsWith(root + path.sep) && target !== root) { res.writeHead(403).end(); return; }
    const info = await stat(target);
    const file = info.isDirectory() ? path.join(target, 'index.html') : target;
    let data = await readFile(file);
    if (file === path.join(root, 'index.html')) {
      data = stampVersion(data.toString(), { ...getBuildVersion(), local: true });
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch { res.writeHead(404).end('Not found'); }
});
server.listen(Number(process.env.PORT || 4173), '0.0.0.0', () => {
  const port = server.address().port;
  console.log(`Local: http://localhost:${port}/`);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) console.log(`Network: http://${address.address}:${port}/`);
    }
  }
});
