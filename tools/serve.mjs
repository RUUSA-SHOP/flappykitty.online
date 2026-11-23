/* Маленький сервер для разработки. Ведёт себя как GitHub Pages:
   отдаёт файлы как есть, а на несуществующий адрес отвечает страницей 404.html.

   node tools/serve.mjs                    → http://localhost:8000
   PORT=3000 node tools/serve.mjs          → другой порт
   node tools/serve.mjs --base=/flappykitty.online/
       → сайт в подпапке, как на miagpt.github.io/flappykitty.online/
         (так проверяется, что все пути в проекте относительные) */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

export function createServer({ base = '/' } = {}) {
  if (!base.startsWith('/')) base = '/' + base;
  if (!base.endsWith('/')) base += '/';

  const send = (res, status, file) => {
    res.writeHead(status, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  };
  const notFound = (res) => send(res, 404, path.join(ROOT, '404.html'));

  return http.createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch (e) {
      res.writeHead(400).end('Bad request');
      return;
    }
    if (pathname + '/' === base) {
      res.writeHead(301, { Location: base }).end();
      return;
    }
    if (!pathname.startsWith(base)) return notFound(res);
    const file = path.join(ROOT, pathname.slice(base.length));
    // не выпускаем за пределы папки проекта и не отдаём служебное
    if (!file.startsWith(ROOT) || file.split(path.sep).some((part) => part === '.git' || part === 'node_modules')) return notFound(res);
    fs.stat(file, (e, stat) => {
      if (e) return notFound(res);
      if (stat.isDirectory()) {
        const index = path.join(file, 'index.html');
        return fs.existsSync(index) ? send(res, 200, index) : notFound(res);
      }
      send(res, 200, file);
    });
  });
}

// запуск из командной строки
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const baseArg = process.argv.find((a) => a.startsWith('--base='));
  const base = baseArg ? baseArg.slice(7) : '/';
  const port = Number(process.env.PORT) || 8000;
  const host = process.env.HOST || '0.0.0.0';
  createServer({ base }).listen(port, host, () => {
    console.log(`Flappy Kitty: http://localhost:${port}${base.startsWith('/') ? base : '/' + base}`);
    console.log('Остановить — Ctrl+C');
  });
}
