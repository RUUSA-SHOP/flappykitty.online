/* Проверка сайта «на целостность» без браузера.
   Ловит то, что легко сломать правкой: битые ссылки и картинки, потерянные id,
   на которые опирается JavaScript, неверные размеры в <img>, внешние ресурсы.
   Запуск: npm run test:site (входит в npm test). Зависимости не нужны. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

/* ---------- размеры картинок (PNG, JPEG, WebP) ---------- */

function imageSize(file) {
  const b = fs.readFileSync(path.join(ROOT, file));
  if (b.toString('ascii', 1, 4) === 'PNG') return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') {
      const n = b.readUInt32LE(21);
      return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8X') return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

/* ---------- HTML ---------- */

const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
const html = Object.fromEntries(pages.map((p) => [p, read(p)]));
const idsOf = (src) => new Set([...src.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const pageIds = Object.fromEntries(pages.map((p) => [p, idsOf(html[p])]));
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : null;
};
const isExternal = (u) => /^(https?:)?\/\//.test(u);
const titles = new Map();
const ogBases = new Set();

for (const page of pages) {
  const src = html[page];
  const noComments = src.replace(/<!--[\s\S]*?-->/g, '');

  if (!/<html lang="ru">/.test(src)) err(page, 'нет <html lang="ru">');
  if (!/<meta charset="utf-8">/i.test(src)) err(page, 'нет <meta charset="utf-8">');
  if (!/<meta name="viewport"/.test(src)) err(page, 'нет <meta name="viewport">');
  if (!/<meta name="robots" content="noindex">/.test(src)) err(page, 'нет <meta name="robots" content="noindex"> — сайт личный и не должен попадать в поиск');
  const title = (src.match(/<title>([^<]*)<\/title>/) || [])[1];
  if (!title || !title.trim()) err(page, 'пустой <title>');
  else if (titles.has(title)) err(page, `заголовок страницы совпадает с ${titles.get(title)}`);
  else titles.set(title, page);
  if (page !== '404.html' && !/<meta name="description" content="[^"]{20,}"/.test(src)) err(page, 'нет осмысленного <meta name="description">');
  if ((src.match(/<h1[\s>]/g) || []).length !== 1) err(page, 'на странице должен быть ровно один <h1>');
  if (!/<main[\s>]/.test(src)) err(page, 'нет <main>');

  // повторяющиеся id
  const seen = new Set();
  for (const m of src.matchAll(/\sid="([^"]+)"/g)) {
    if (seen.has(m[1])) err(page, `id="${m[1]}" встречается дважды`);
    seen.add(m[1]);
  }

  // ссылки и файлы
  for (const m of noComments.replace(/<use\b[^>]*>/g, '').matchAll(/\s(href|src|data-full|poster)="([^"]*)"/g)) {
    const url = m[2];
    if (!url || url.includes("' +") || /^(mailto:|tel:|data:)/.test(url)) continue;
    if (isExternal(url)) continue; // внешние адреса проверяются ниже по тегам
    const [file, hash] = url.split('#');
    const clean = file.split('?')[0];
    if (clean && !exists(clean)) err(page, `ссылка на несуществующий файл: ${url}`);
    if (hash) {
      const target = clean || page;
      if (target.endsWith('.html') && pageIds[target] && !pageIds[target].has(hash)) err(page, `якорь #${hash} не найден в ${target}`);
    }
  }

  // всё, что страница загружает, должно лежать в репозитории: сайт работает без внешних сервисов
  for (const m of noComments.matchAll(/<(script|link|img|source|iframe|video|audio)\b[^>]*>/g)) {
    const url = attr(m[0], 'src') || attr(m[0], 'href');
    if (url && isExternal(url)) err(page, `внешний ресурс в <${m[1]}>: ${url}`);
  }

  // картинки: alt и настоящие размеры, чтобы страница не прыгала при загрузке
  for (const m of noComments.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    const file = attr(tag, 'src');
    if (attr(tag, 'alt') === null) err(page, `<img src="${file}"> без alt`);
    if (!file) continue; // картинка подставляется скриптом
    const w = +attr(tag, 'width');
    const h = +attr(tag, 'height');
    if (!w || !h) { err(page, `<img src="${file}"> без width/height`); continue; }
    if (!exists(file)) continue;
    const real = imageSize(file);
    if (real && Math.abs(w / h - real.w / real.h) > 0.02) err(page, `<img src="${file}">: в разметке ${w}×${h}, а файл ${real.w}×${real.h} — пропорции не совпадают`);
  }

  // значки из SVG-набора
  const symbols = new Set([...src.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
  for (const m of src.matchAll(/<use href="#([^"]+)"/g)) if (!symbols.has(m[1])) err(page, `значок #${m[1]} не описан на этой странице`);

  // соцсети: картинка предпросмотра. Адрес сайта может быть любым (см. tools/set-url.mjs), файл должен лежать в проекте,
  // а og:url и og:image — указывать на один и тот же сайт.
  const og = src.match(/property="og:image" content="(https:\/\/[^"]*?\/)(assets\/[^"]+)"/);
  const ogUrl = src.match(/property="og:url" content="([^"]+)"/);
  if (src.includes('property="og:image"') && !og) err(page, 'og:image должен быть полным адресом вида https://…/assets/…');
  if (og && !exists(og[2])) err(page, `og:image указывает на несуществующий файл ${og[2]}`);
  if (og && ogUrl && !ogUrl[1].startsWith(og[1])) err(page, `og:url (${ogUrl[1]}) и og:image (${og[1]}…) указывают на разные сайты — запусти node tools/set-url.mjs`);
  if (og) ogBases.add(og[1]);
}

if (ogBases.size > 1) err('страницы', `в превью для мессенджеров указаны разные адреса сайта: ${[...ogBases].join(', ')} — запусти node tools/set-url.mjs`);

/* ---------- JavaScript ---------- */

function walk(dir, out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const jsFiles = walk('assets/js').filter((f) => f.endsWith('.js'));
for (const file of jsFiles) {
  const src = read(file);
  for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g)) {
    const spec = m[1] || m[2];
    if (!spec.startsWith('.')) { err(file, `импорт не из проекта: ${spec}`); continue; }
    const target = rel(path.resolve(ROOT, path.dirname(file), spec));
    if (!exists(target)) err(file, `импорт несуществующего файла: ${spec}`);
  }
  if (/\bfetch\(|XMLHttpRequest|https?:\/\/(?!www\.w3\.org)/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))) warn(file, 'похоже на обращение к внешнему адресу — сайт задуман полностью автономным');
}

// какой скрипт на какую страницу опирается
const CONTRACTS = [
  ['assets/js/game/main.js', 'play.html'],
  ['assets/js/love.js', 'love.html'],
  ['assets/js/site.js', 'gallery.html'],
];
for (const [file, page] of CONTRACTS) {
  const src = read(file);
  const ids = new Set([...src.matchAll(/\$\(\s*'#([\w-]+)'/g), ...src.matchAll(/getElementById\(\s*'([\w-]+)'/g), ...src.matchAll(/\$\$\(\s*'#([\w-]+)[ '.]/g)].map((m) => m[1]));
  for (const id of ids) if (!pageIds[page].has(id)) err(file, `обращается к #${id}, которого нет в ${page}`);
  const symbols = new Set([...html[page].matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
  for (const m of src.matchAll(/#(i-[a-z-]+)/g)) if (!symbols.has(m[1])) err(file, `использует значок #${m[1]}, которого нет в ${page}`);
}
// экраны игры: каждый data-go должен вести на существующий экран
{
  const screens = new Set([...html['play.html'].matchAll(/data-name="(\w+)"/g)].map((m) => m[1]));
  for (const m of html['play.html'].matchAll(/data-go="(\w+)"/g)) if (!screens.has(m[1])) err('play.html', `кнопка ведёт на несуществующий экран «${m[1]}»`);
  for (const m of read('assets/js/game/main.js').matchAll(/\bgo\('(\w+)'\)/g)) if (!screens.has(m[1]) && m[1] !== 'play') err('assets/js/game/main.js', `go('${m[1]}') — такого экрана нет в play.html`);
}

/* ---------- CSS ---------- */

for (const file of walk('assets/css').filter((f) => f.endsWith('.css'))) {
  const src = read(file);
  for (const m of src.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    if (m[1].startsWith('data:')) continue;
    if (isExternal(m[1])) { err(file, `внешний ресурс: ${m[1]}`); continue; }
    const target = rel(path.resolve(ROOT, path.dirname(file), m[1]));
    if (!exists(target)) err(file, `url(${m[1]}) — файла нет`);
  }
  const open = (src.match(/{/g) || []).length;
  const close = (src.match(/}/g) || []).length;
  if (open !== close) err(file, `фигурные скобки не сходятся: { ${open}, } ${close}`);
}

/* ---------- работа без сети ---------- */

if (exists('sw.js')) {
  const sw = read('sw.js');
  const core = (sw.match(/const CORE = \[([\s\S]*?)\];/) || [])[1] || '';
  const files = [...core.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  if (!files.length) err('sw.js', 'список CORE пуст или не читается');
  for (const f of files) {
    if (f.startsWith('/') || isExternal(f)) err('sw.js', `в CORE должен быть относительный путь: ${f}`);
    else if (!exists(f)) err('sw.js', `в CORE указан несуществующий файл: ${f}`);
  }
  // каждый скрипт игры должен быть в списке, иначе без сети она не запустится
  for (const f of jsFiles.filter((x) => x.startsWith('assets/js/game/') || x === 'assets/js/config.js' || x === 'assets/js/storage.js')) {
    if (!files.includes(f)) err('sw.js', `скрипт игры ${f} не попал в CORE — без сети игра не откроется`);
  }
  // фото к запискам тоже должны открываться без сети
  const { CONFIG } = await import('../assets/js/config.js');
  for (const [id, ph] of Object.entries(CONFIG.photos || {})) {
    const f = `assets/img/gallery/${ph.file}-thumb.webp`;
    if (!files.includes(f)) err('sw.js', `фото к записке № ${id} (${f}) не попало в CORE — без сети записка останется без снимка`);
  }
}

/* ---------- инструменты проверок: файл должен хотя бы запускаться ---------- */

{
  // e2e.mjs не входит в `npm test` (он идёт отдельной задачей CI) и грузится только в браузере.
  // Однажды из-за этого целый файл падал сразу на первой строке: обращение к CONFIG без импорта.
  // `node --check` такое не видит — он проверяет только синтаксис, а не имена.
  for (const file of ['tools/e2e.mjs', 'tools/bot-test.mjs']) {
    if (!exists(file)) continue;
    const src = read(file);
    // каждое имя, которое файл берёт из модулей, должно быть импортировано
    const imported = new Set();
    for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from/g)) {
      m[1].split(',').forEach((x) => imported.add(x.trim().split(/\s+as\s+/).pop()));
    }
    for (const m of src.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from/g)) imported.add(m[1]);
    // Имена, которые приходят из config.js и levels.js. Внутри page.evaluate() код исполняется
    // в браузере и может импортировать что угодно сам — такие куски из проверки выкидываем.
    const top = src.replace(/page\.evaluate\(([\s\S]*?)\n\s*\}\);|page\.evaluate\(\(\) =>[^;]*\)/g, '');
    for (const name of ['CONFIG', 'LEVELS', 'SKINS', 'POWERUPS', 'WORLD']) {
      const used = new RegExp(`(?<![.\\w$])${name}\\b`).test(top);
      if (used && !imported.has(name)) err(file, `${name} используется, но не импортирован — файл упадёт при запуске`);
    }
  }
}

/* ---------- число уровней: тексты страниц сверяются с игрой ---------- */

{
  // Уровни добавляются в levels.js, а «шесть уровней» остаётся в десятке текстов. Ловим это здесь.
  const { LEVELS } = await import('../assets/js/game/levels.js');
  const { CONFIG } = await import('../assets/js/config.js');
  const N = LEVELS.length;
  const WORDS = { один: 1, одного: 1, два: 2, двух: 2, три: 3, трёх: 3, четыре: 4, четырёх: 4, пять: 5, пяти: 5, пятью: 5, шесть: 6, шести: 6, шестью: 6, семь: 7, семи: 7, семью: 7, восемь: 8, восьми: 8, восемью: 8, девять: 9, девяти: 9, девятью: 9, десять: 10, десяти: 10, десятью: 10, одиннадцать: 11, двенадцать: 12 };
  const ORD = { первого: 1, второго: 2, третьего: 3, четвёртого: 4, пятого: 5, шестого: 6, седьмого: 7, восьмого: 8, девятого: 9, десятого: 10, одиннадцатого: 11, двенадцатого: 12 };
  const num = (w) => (/^\d+$/.test(w) ? +w : WORDS[w.toLowerCase()]);
  const texts = [...pages.map(rel), 'README.md', 'AGENTS.md', 'docs/PLAN.md'].filter(exists).map((f) => [f, read(f)]);
  // Тексты писем — личные, владелец может писать там что угодно про числа. Их в сверку не берём.
  for (const [file, text] of texts) {
    // «шесть уровней», «6 сюжетных уровней», «с десятью уровнями», «все шесть уровней»
    for (const m of text.matchAll(/(?<![\wа-яё.,-])(\d+|[а-яё]+)\s+(?:сюжетны[а-яё]+\s+)?уровн(?:ей|ями|ях|я)(?![а-яё])/gi)) {
      const n = num(m[1]);
      if (n != null && n !== N) err(file, `«${m[0]}» — а уровней в игре ${N}`);
    }
    // «письмо после шестого (уровня)», «после шестого — письмо»
    for (const m of text.matchAll(/после\s+([а-яё]+ого)(?:\s+уровня)?[^.!?\n]{0,24}письмо|письмо[^.!?\n]{0,24}после\s+([а-яё]+ого)(?![а-яё])/gi)) {
      const n = ORD[(m[1] || m[2]).toLowerCase()];
      if (n != null && n !== N) err(file, `«${m[0]}» — письмо открывается после уровня № ${N}`);
    }
  }
  // карточки уровней на главной: столько же, сколько уровней, названия по порядку
  if (exists('index.html')) {
    const cards = [...read('index.html').matchAll(/class="lvl__n"[^>]*>(\d+)<[\s\S]*?<h3>([^<]+)<\/h3>/g)].map((m) => [+m[1], m[2].trim()]);
    if (cards.length !== N) err('index.html', `карточек уровней ${cards.length}, а уровней в игре ${N}`);
    // финалы называются по имени Насти: уровень 10 — «Дорога к …», 20 — «Дорога к … · рассвет»
    const names = LEVELS.map((l) => {
      if (l.theme === 'love') return `Дорога к ${CONFIG.her.dative}`;
      if (l.theme === 'dawn') return `Дорога к ${CONFIG.her.dative} · рассвет`;
      return l.name;
    });
    cards.forEach(([n, name], i) => {
      if (n !== i + 1 || name !== names[i]) err('index.html', `карточка № ${i + 1}: «${n}. ${name}», а в игре «${i + 1}. ${names[i]}»`);
    });
  }
  // счётчик записок в разметке — до того, как его перерисует скрипт
  if (exists('love.html')) {
    // Карточек на странице записок: обычные записки + у каждого финала записка Мии и письмо.
    const LETTERS = (CONFIG.letters || []).length;
    const TOTAL = CONFIG.notes.length + LETTERS * 2;
    const m = read('love.html').match(/id="noteCount">Открыто 0 из (\d+)</);
    if (!m || +m[1] !== TOTAL) err('love.html', `счётчик записок «Открыто 0 из ${m ? m[1] : '?'}», должно быть ${TOTAL}`);
  }
  // счётчик звёзд в разметке — до того, как его перерисует скрипт
  if (exists('play.html')) {
    const m = read('play.html').match(/id="starTotal">0\/(\d+)</);
    if (!m || +m[1] !== N * 3) err('play.html', `счётчик звёзд «0/${m ? m[1] : '?'}», должно быть 0/${N * 3}`);
  }
}

/* ---------- манифест ---------- */

try {
  const man = JSON.parse(read('site.webmanifest'));
  for (const icon of man.icons || []) {
    if (!exists(icon.src)) { err('site.webmanifest', `нет значка ${icon.src}`); continue; }
    const real = imageSize(icon.src);
    if (real && icon.sizes !== `${real.w}x${real.h}`) err('site.webmanifest', `${icon.src}: указано ${icon.sizes}, на деле ${real.w}x${real.h}`);
  }
  if (!exists(man.start_url.split('?')[0])) err('site.webmanifest', `start_url ведёт в никуда: ${man.start_url}`);
} catch (e) {
  err('site.webmanifest', 'не читается как JSON: ' + e.message);
}

/* ---------- вес ---------- */

let total = 0;
for (const file of walk('assets')) {
  const size = fs.statSync(path.join(ROOT, file)).size;
  total += size;
  if (/\.(webp|png|jpe?g)$/.test(file) && size > 450 * 1024) warn(file, `картинка весит ${(size / 1024).toFixed(0)} КБ — на мобильном интернете это заметно`);
}
if (total > 8 * 1024 * 1024) warn('assets/', `папка весит ${(total / 1048576).toFixed(1)} МБ`);

/* ---------- что попадёт в публикацию ---------- */

// GitHub Pages в режиме «Deploy from a branch» выкладывает весь репозиторий как есть.
for (const file of fs.readdirSync(ROOT)) {
  if (/\.(zip|rar|7z|tar|gz|psd|heic)$/i.test(file)) {
    warn(file, 'архив или исходник лежит в корне — после публикации его сможет скачать любой по прямой ссылке. Убери перед включением Pages: git rm ' + file);
  }
}
if (exists('CNAME')) {
  const domain = read('CNAME').trim();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) err('CNAME', `в файле должна быть одна строка с доменом, сейчас: «${domain}»`);
}

/* ---------- итог ---------- */

for (const w of warnings) console.warn('! ' + w);
if (errors.length) {
  for (const e of errors) console.error('✗ ' + e);
  console.error(`\n✗ Проверка сайта: найдено ошибок — ${errors.length}.`);
  process.exit(1);
}
console.log(`✓ Проверка сайта: ${pages.length} страниц, ${jsFiles.length} скриптов, ${(total / 1048576).toFixed(1)} МБ в assets — ошибок нет.`);
