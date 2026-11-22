/* Меняет адрес сайта в превью для мессенджеров (теги og:url и og:image во всех страницах).
   Эти теги — единственное место, где нужен полный адрес: всё остальное в проекте относительное.

   Запуск:
     node tools/set-url.mjs https://miagpt.github.io/n1/
     node tools/set-url.mjs https://flappykitty.online/

   Когда нужно: сайт переехал на другой адрес (новый репозиторий, свой домен), и ссылка,
   отправленная в Telegram или WhatsApp, должна показывать картинку и вести туда же. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let base = process.argv[2];
if (!base || !/^https:\/\/[^\s"<>]+$/.test(base)) {
  console.error('Укажи полный адрес сайта, например: node tools/set-url.mjs https://miagpt.github.io/n1/');
  process.exit(2);
}
if (!base.endsWith('/')) base += '/';

let changed = 0;
for (const file of fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'))) {
  const full = path.join(ROOT, file);
  const src = fs.readFileSync(full, 'utf8');
  // og:url — адрес самой страницы (у главной — без index.html), og:image — картинка предпросмотра
  const out = src
    .replace(/(<meta property="og:url" content=")[^"]*(")/g, (m, a, b) => `${a}${base}${file === 'index.html' ? '' : file}${b}`)
    .replace(/(<meta property="og:image" content=")https:\/\/[^"]*?\/(assets\/[^"]+)(")/g, (m, a, asset, b) => `${a}${base}${asset}${b}`);
  if (out !== src) {
    fs.writeFileSync(full, out);
    changed++;
  }
}
console.log(`Адрес в превью: ${base} — обновлено страниц: ${changed}.`);
