/* Flappy Kitty · работа без сети.
   После первого открытия игра и сайт запускаются и без связи (метро, самолёт, дача).
   Правила простые:
   - страницы, стили и скрипты — сначала из сети (чтобы правки владельца были видны сразу),
     а если сети нет или она не ответила за три секунды — из сохранённой копии;
   - картинки и шрифты — сразу из копии, а в фоне копия обновляется.
   Файл лежит в корне сайта: так он обслуживает все страницы. Пути только относительные —
   сайт работает и в подпапке GitHub Pages, и в корне домена.
   ⚠ Поменял список CORE — увеличь номер в VERSION. */

const VERSION = 'fk-3';
const CACHE = `flappykitty-${VERSION}`;

// Всё, без чего игра не запустится, и страницы сайта, на которые из неё ведут ссылки.
// Картинки сайта и альбома сохраняются по мере просмотра.
const CORE = [
  'play.html',
  'index.html',
  'love.html',
  'mia.html',
  'gallery.html',
  'worlds.html',
  'assets/css/site.css',
  'assets/js/site.js',
  'assets/js/love.js',
  'site.webmanifest',
  'assets/css/base.css',
  'assets/css/game.css',
  'assets/js/config.js',
  'assets/js/storage.js',
  'assets/js/game/main.js',
  'assets/js/game/levels.js',
  'assets/js/game/sim.js',
  'assets/js/game/render.js',
  'assets/js/game/audio.js',
  'assets/js/game/themes.js',
  'assets/fonts/nunito-cyrillic-wght-normal.woff2',
  'assets/fonts/nunito-latin-wght-normal.woff2',
  'assets/fonts/pacifico-latin-400-normal.woff2',
  'assets/fonts/pacifico-cyrillic-400-normal.woff2',
  'assets/fonts/caveat-cyrillic-wght-normal.woff2',
  'assets/fonts/caveat-latin-wght-normal.woff2',
  'assets/img/skins/super.webp',
  'assets/img/skins/hood.webp',
  'assets/img/skins/eyes.webp',
  'assets/img/skins/frog.webp',
  'assets/img/skins/face.webp',
  'assets/img/skins/wink.webp',
  'assets/img/icons/favicon-32.png',
  'assets/img/icons/apple-touch-icon.png',
  'assets/img/icons/icon-192.png',
  'assets/img/gallery/armrest-thumb.webp',
  'assets/img/gallery/faucet-thumb.webp',
  'assets/img/gallery/cake-thumb.webp',
  'assets/img/gallery/night-thumb.webp',
  'assets/img/gallery/sweater-thumb.webp',
  'assets/img/gallery/raincoat-eyes-thumb.webp',
  'assets/img/gallery/frog-thumb.webp',
  'assets/img/gallery/council-thumb.webp',
  'assets/img/gallery/art-kiss-or-bite-thumb.webp',
  'assets/img/gallery/roses-thumb.webp',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // по одному файлу: если какой-то не скачался, остальные всё равно сохранятся
      .then((cache) => Promise.all(CORE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('flappykitty-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function store(request, response) {
  if (response && response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
  }
  return response;
}

// play.html?level=3 и play.html — одна и та же страница
const fromCache = (request) => caches.match(request, { ignoreSearch: true });

function networkFirst(request) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r) => {
      if (!settled && r) {
        settled = true;
        resolve(r);
      }
    };
    // сеть молчит три секунды — отдаём сохранённую копию, если она есть
    const timer = setTimeout(() => fromCache(request).then(done), 3000);
    fetch(request)
      .then((response) => {
        clearTimeout(timer);
        if (response.ok) done(store(request, response));
        else fromCache(request).then((c) => done(c || response));
      })
      .catch(() => {
        clearTimeout(timer);
        fromCache(request).then((c) => done(c || Response.error()));
      });
  });
}

function cacheFirst(request) {
  return fromCache(request).then((cached) => {
    const fresh = fetch(request)
      .then((response) => store(request, response))
      .catch(() => cached || Response.error());
    return cached || fresh;
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const isMedia = /\.(webp|png|jpe?g|svg|woff2)$/.test(url.pathname);
  event.respondWith(isMedia ? cacheFirst(request) : networkFirst(request));
});
