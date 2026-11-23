/* Сквозная проверка в настоящем браузере: открывает страницы, нажимает кнопки,
   проходит и проигрывает уровни и смотрит, что всё ведёт себя как задумано.

   Нужны две библиотеки, которых нет в репозитории (они тяжёлые):
     npm i --no-save puppeteer-core @sparticuz/chromium
   Запуск:
     npm run test:e2e
   Свой Chrome вместо скачанного:  CHROME_PATH=/путь/к/chrome npm run test:e2e
   Только часть проверок:           npm run test:e2e -- записк

   Сайт поднимается в подпапке /flappykitty.online/ — как на GitHub Pages до подключения
   домена. Заодно проверяется, что все пути в проекте относительные. */

import { createServer } from './serve.mjs';
import { LEVELS } from '../assets/js/game/levels.js';
import { CONFIG } from '../assets/js/config.js';

const TOTAL = LEVELS.length; // уровней в сюжете
// На странице записок карточек больше: у каждого финала записка Мии и письмо создателя.
const CARDS = CONFIG.notes.length + (CONFIG.letters || []).length * 2;
const upTo = (n) => Array.from({ length: n }, (_, i) => i + 1);

let puppeteer;
try {
  puppeteer = (await import('puppeteer-core')).default;
} catch (e) {
  console.error('Не найден puppeteer-core. Установи: npm i --no-save puppeteer-core @sparticuz/chromium');
  process.exit(2);
}

let executablePath = process.env.CHROME_PATH;
// Оба настоящих адреса сайта направляем на этот компьютер: так страница 404 проверяется
// ровно в тех условиях, в которых будет работать (подпапка на github.io и корень на домене).
let args = [
  '--no-sandbox',
  '--autoplay-policy=no-user-gesture-required',
  '--host-resolver-rules=MAP ruusa-shop.github.io 127.0.0.1, MAP flappykitty.online 127.0.0.1',
];
if (!executablePath) {
  try {
    const chromium = (await import('@sparticuz/chromium')).default;
    executablePath = await chromium.executablePath();
    args = [...chromium.args, ...args];
  } catch (e) {
    console.error('Не найден браузер. Установи @sparticuz/chromium или укажи CHROME_PATH.');
    process.exit(2);
  }
}

const BASE = '/flappykitty.online/';
const server = createServer({ base: BASE });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;
const rootServer = createServer({ base: '/' });
await new Promise((r) => rootServer.listen(0, '127.0.0.1', r));
const PAGES_URL = `http://ruusa-shop.github.io:${server.address().port}${BASE}`;
const DOMAIN_URL = `http://flappykitty.online:${rootServer.address().port}/`;
// protocolTimeout: на слабой машине без видеокарты один долгий вызов (прогон уровня с отрисовкой) идёт дольше трёх минут по умолчанию
const browser = await puppeteer.launch({ executablePath, args, headless: true, protocolTimeout: 600000 });

const only = process.argv[2];
const results = [];
const SAVE_KEY = 'flappykitty.save.v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function equal(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: ожидалось ${JSON.stringify(b)}, получено ${JSON.stringify(a)}`);
}

/** Открывает страницу с чистым (или заданным) сохранением и следит за ошибками. */
async function open(url, { w = 390, h = 844, save = null, touch = false, date = null, dialog = 'accept', allow404 = false, root = ORIGIN + BASE } = {}) {
  const page = await browser.newPage();
  const problems = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !(allow404 && /404/.test(m.text()))) problems.push('console: ' + m.text());
  });
  page.on('pageerror', (e) => problems.push('ошибка скрипта: ' + e.message));
  page.on('response', (r) => {
    if (r.status() >= 400 && !(allow404 && r.url() === root + url)) problems.push(`${r.status()} ${r.url()}`);
  });
  page.on('dialog', (d) => (dialog === 'accept' ? d.accept() : d.dismiss()));
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch });
  await page.evaluateOnNewDocument(
    (key, saved, fixedDate) => {
      if (!sessionStorage.getItem('__e2e')) {
        sessionStorage.setItem('__e2e', '1');
        localStorage.clear();
        if (saved) localStorage.setItem(key, saved);
      }
      if (fixedDate) {
        const Real = Date;
        // eslint-disable-next-line no-global-assign
        Date = class extends Real {
          constructor(...a) {
            super(...(a.length ? a : [fixedDate]));
          }
          static now() {
            return new Real(fixedDate).getTime();
          }
        };
      }
    },
    SAVE_KEY,
    save ? JSON.stringify(save) : null,
    date
  );
  await page.goto(root + url, { waitUntil: 'networkidle0' });
  page.problems = problems;
  return page;
}

const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), SAVE_KEY);
const screen = (page) => page.evaluate(() => window.__fk.screen);
const waitScreen = (page, name) => page.waitForFunction((n) => window.__fk && window.__fk.screen === n, { timeout: 60000 }, name);
const visible = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  }, sel);
const text = (page, sel) => page.evaluate((s) => document.querySelector(s).textContent.trim(), sel);

/** Ждёт, пока доиграют все конечные анимации появления (бесконечные — «дыхание» кнопок — не в счёт). */
const settle = (page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect && a.effect.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {}))
    ).then(() => true)
  );

/** Игра открыта на экране меню. */
async function game(opts = {}, query = '') {
  const page = await open('play.html' + query, opts);
  await waitScreen(page, opts.expect || 'menu');
  return page;
}

/** Проматывает текущий уровень: 'win' — автопилот долетает до финиша, 'lose' — Мия падает. */
function fastForward(page, how, { hits = 0 } = {}) {
  return page.evaluate(
    (how, hits) => {
      const sim = window.__fk.sim;
      const DT = 1 / 120;
      sim.flap();
      let i = 0;
      let hitsLeft = hits;
      while ((sim.status === 'playing' || sim.status === 'dying') && i < 120 * 400) {
        if (how === 'win') {
          if (hitsLeft > 0 && i === 240) {
            sim.inv = 0;
            sim.hit('test');
            hitsLeft--;
          }
          sim.inv = Math.max(sim.inv, 0.5); // автопилот неуязвим: проверяем экраны, а не баланс
          if (i % 15 === 0) {
            const wx = sim.dist + sim.miaX;
            const g = sim.gates.find((x) => x.x + x.w > wx - 20);
            if (sim.mia.y + sim.mia.vy * 0.07 > (g ? g.gapY + 22 : 330)) sim.flap();
          }
        }
        sim.step(DT);
        i++;
      }
      return { status: sim.status, hearts: sim.hearts, pathHearts: sim.pathHearts, stars: sim.stars(), passed: sim.passed, progress: sim.progress };
    },
    how,
    hits
  );
}

async function test(name, fn) {
  if (only && !name.toLowerCase().includes(only.toLowerCase())) return;
  const pages = [];
  const track = (p) => (pages.push(p), p);
  const t0 = Date.now();
  try {
    await fn(track);
    for (const p of pages) if (p.problems.length) throw new Error('ошибки на странице:\n      ' + p.problems.join('\n      '));
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false });
    console.error(`✗ ${name}\n    ${e.message}`);
    // В GitHub Actions ошибка дублируется пометкой к проверке: её видно на странице pull request
    // и через API (check-runs/…/annotations), даже когда полный журнал недоступен.
    if (process.env.GITHUB_ACTIONS) {
      const esc = (t) => String(t).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
      console.log(`::error title=${esc(name).replace(/[:,]/g, ' ')}::${esc(e.message.slice(0, 1500))}`);
    }
  } finally {
    for (const p of pages) await p.close().catch(() => {});
  }
}

/* ======================= страницы сайта ======================= */

const PAGES = ['index.html', 'mia.html', 'gallery.html', 'love.html', 'worlds.html', 'play.html'];

for (const [w, h, label] of [[360, 740, 'узкий телефон'], [390, 844, 'телефон'], [820, 1180, 'планшет'], [1280, 800, 'компьютер']]) {
  await test(`страницы открываются без ошибок и не вылезают за экран · ${label} ${w}px`, async (track) => {
    for (const url of PAGES) {
      const page = track(await open(url, { w, h, touch: w < 800 }));
      if (url !== 'play.html') {
        await page.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => (i.loading = 'eager')));
        await page.waitForFunction(() => [...document.images].every((i) => i.complete), { timeout: 15000 });
      } else await waitScreen(page, 'menu');
      const info = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        broken: [...document.images].filter((i) => i.getAttribute('src') && i.naturalWidth === 0).map((i) => i.getAttribute('src')),
        fonts: [...document.fonts].filter((f) => f.status === 'error').map((f) => f.family),
      }));
      assert(info.overflow <= 0, `${url}: страница шире экрана на ${info.overflow}px`);
      equal(info.broken, [], `${url}: не загрузились картинки`);
      equal(info.fonts, [], `${url}: не загрузились шрифты`);
    }
  });
}

await test('шапка: активный раздел отмечен, кошелёк виден только тем, кто уже играл', async (track) => {
  const fresh = track(await open('mia.html'));
  equal(await fresh.evaluate(() => document.querySelector('.nav [aria-current="page"]').getAttribute('href')), 'mia.html', 'активный пункт меню');
  assert(!(await visible(fresh, '[data-wallet-box]')), 'у нового гостя кошелёк должен быть скрыт');
  const played = track(await open('mia.html', { save: { hearts: 57, totalHearts: 80, plays: 3 } }));
  assert(await visible(played, '[data-wallet-box]'), 'кошелёк должен появиться');
  equal(await text(played, '[data-wallet]'), '57', 'число сердечек в шапке');
});

await test('альбом: фото открывается, листается стрелками и закрывается по Esc', async (track) => {
  const page = track(await open('gallery.html', { w: 1280, h: 800 }));
  const total = await page.evaluate(() => document.querySelectorAll('.photo').length);
  assert(total >= 10, 'в альбоме слишком мало фотографий');
  assert((await text(page, '.page-head .lead')).startsWith(String(total)), `в заголовке должно быть ${total} снимков`);
  await page.click('.photo:nth-of-type(1)');
  await page.waitForFunction(() => document.getElementById('lightbox').open);
  equal(await text(page, '#lbCount'), `1 / ${total}`, 'счётчик');
  await page.keyboard.press('ArrowRight');
  equal(await text(page, '#lbCount'), `2 / ${total}`, 'после стрелки вправо');
  await page.click('#lbPrev');
  await page.click('#lbPrev');
  equal(await text(page, '#lbCount'), `${total} / ${total}`, 'листание по кругу назад');
  await page.waitForFunction(() => document.getElementById('lbImg').naturalWidth > 0, { timeout: 15000 });
  assert((await text(page, '#lbCap')).length > 0, 'у фото должна быть подпись');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('lightbox').open);
  assert(await page.evaluate(() => document.activeElement.classList.contains('photo')), 'фокус должен вернуться на миниатюру');
});

await test('записки: закрыты до прохождения, открываются по одной', async (track) => {
  const fresh = track(await open('love.html'));
  equal(await fresh.evaluate(() => document.querySelectorAll('.note--locked').length), CARDS, 'у нового гостя заперто всё');
  equal(await text(fresh, '#noteCount'), `Открыто 0 из ${CARDS}`, 'счётчик');
  equal(await fresh.evaluate(() => [...document.querySelectorAll('.note--locked a')].map((a) => a.getAttribute('href'))), ['play.html?level=1'], 'кнопка «Пройти уровень» только у первой');
  assert(!(await fresh.evaluate(() => document.body.textContent.includes('Люблю'))), 'текст письма не должен попадать на страницу раньше времени');

  const some = track(await open('love.html', { save: { notes: [1, 2], levels: { 1: { done: true, stars: 3 }, 2: { done: true, stars: 1 } }, plays: 2 } }));
  equal(await some.evaluate(() => document.querySelectorAll('.note:not(.note--locked)').length), 2, 'открыто две записки');
  equal(await text(some, '#noteCount'), `Открыто 2 из ${CARDS}`, 'счётчик');
  equal((await stored(some)).seenNotes, [1, 2], 'открытые записки отмечаются прочитанными');

  const all = track(await open('love.html', { save: { rounds: TOTAL, notes: upTo(TOTAL), plays: 9 } }));
  equal(await all.evaluate(() => document.querySelectorAll('.note--locked').length), 0, 'после всех уровней открыто всё');
  equal(await text(all, '#noteCount'), `Открыты все ${CARDS}`, 'счётчик');
  equal(await all.evaluate(() => document.querySelectorAll('#notes .note').length), CONFIG.notes.length, 'обычных записок на странице');
  equal(await all.evaluate(() => document.querySelectorAll('#final .note--final').length), (CONFIG.letters || []).length, 'писем в блоке финала');
  assert(await visible(all, '.note--final'), 'письмо показано');

  const peek = track(await open('love.html?peek=1'));
  equal(await peek.evaluate(() => document.querySelectorAll('.note--locked').length), 0, '?peek=1 показывает всё');
  equal(await stored(peek), null, '?peek=1 ничего не записывает в сохранение');
});

await test('несуществующий адрес показывает страницу 404, ссылки с неё ведут на сайт', async (track) => {
  for (const [root, label] of [[PAGES_URL, 'github.io'], [DOMAIN_URL, 'свой домен']]) {
    const page = track(await open('nope/deep/page.html', { allow404: true, root }));
    equal(await text(page, 'h1'), 'Мия сюда не залетала', `${label}: заголовок`);
    const info = await page.evaluate(() => ({
      home: document.querySelector('.lost a').href,
      img: document.querySelector('.lost img').naturalWidth,
      styled: getComputedStyle(document.querySelector('.lost__code')).fontFamily.includes('Pacifico'),
    }));
    equal(info.home, root + 'index.html', `${label}: ссылка «На главную»`);
    assert(info.img > 0, `${label}: картинка на странице 404 не загрузилась`);
    assert(info.styled, `${label}: стили на странице 404 не подключились`);
    equal(page.problems, [], `${label}: ошибки на странице`);
  }
});

/* ======================= игра ======================= */

await test('первый запуск: меню → вступление → полёт', async (track) => {
  const page = track(await game());
  equal(await text(page, '#btnPlayLabel'), 'Играть', 'надпись на главной кнопке');
  equal(await page.evaluate(() => document.getElementById('btnEndless').getAttribute('aria-disabled')), 'true', 'бесконечный режим закрыт до первого уровня');
  assert(!(await visible(page, '#bday')), 'поздравление видно не в день рождения');
  await page.click('#btnEndless');
  equal(await screen(page), 'menu', 'закрытый бесконечный режим не должен запускаться');
  await page.click('#btnPlay');
  await waitScreen(page, 'intro');
  equal(await text(page, '#introName'), 'Гостиная', 'название уровня');
  assert((await text(page, '#introTip')).length > 10, 'нет подсказки перед уровнем');
  await page.click('#btnGo');
  await waitScreen(page, 'play');
  assert(await visible(page, '#hud'), 'счётчики должны быть видны');
  assert(await visible(page, '#hint'), 'подсказка «Тапни» должна быть видна до первого взмаха');
  equal(await page.evaluate(() => document.querySelectorAll('#hudLives .icon').length), 3, 'жизней в сюжете');
  equal(await page.evaluate(() => window.__fk.sim.status), 'ready', 'до первого касания Мия ждёт');
  await page.mouse.click(195, 500);
  await page.waitForFunction(() => window.__fk.sim.status === 'playing');
  // подсказку убирает игровой цикл на следующем кадре после взмаха
  await page
    .waitForFunction(() => document.getElementById('hint').hidden, { timeout: 5000 })
    .catch(() => assert(false, 'подсказка должна исчезнуть после взмаха'));
  equal((await stored(page)).plays, 1, 'запуск засчитан');
});

await test('управление: касание, пробел, пауза по Esc и кнопкой', async (track) => {
  const page = track(await game({ touch: true }));
  await page.tap('#btnPlay');
  await waitScreen(page, 'intro');
  await page.tap('#btnGo');
  await waitScreen(page, 'play');
  await page.touchscreen.tap(195, 500);
  await page.waitForFunction(() => window.__fk.sim.status === 'playing');
  const vy = await page.evaluate(() => {
    window.__fk.sim.mia.vy = 300;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    return window.__fk.sim.mia.vy;
  });
  assert(vy < 0, 'пробел должен давать взмах');
  await page.keyboard.press('Escape');
  await waitScreen(page, 'pause');
  const t1 = await page.evaluate(() => window.__fk.sim.t);
  await sleep(400);
  equal(await page.evaluate(() => window.__fk.sim.t), t1, 'на паузе время стоит');
  await page.keyboard.press('Escape');
  await waitScreen(page, 'play');
  await page.tap('#btnPause');
  await waitScreen(page, 'pause');
  await page.tap('#btnRestart');
  await waitScreen(page, 'play');
  equal(await page.evaluate(() => window.__fk.sim.status), 'ready', '«Заново» начинает уровень сначала');
});

await test('сворачивание вкладки ставит игру на паузу', async (track) => {
  const page = track(await game());
  await page.click('#btnPlay');
  await waitScreen(page, 'intro');
  await page.click('#btnGo');
  await waitScreen(page, 'play');
  await page.mouse.click(195, 500);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  equal(await screen(page), 'pause', 'экран после сворачивания');
});

await test('победа: звёзды, сердечки в кошелёк, записка, следующий уровень', async (track) => {
  const page = track(await game());
  await page.click('#btnPlay');
  await page.click('#btnGo');
  await waitScreen(page, 'play');
  const run = await fastForward(page, 'win');
  equal(run.status, 'won', 'автопилот должен долететь');
  equal(run.stars, 3, 'без потерь и с сердечками — три звезды');
  assert(run.progress > 0.999, 'на финише полоска должна быть полной');
  await waitScreen(page, 'win');
  const d = await stored(page);
  equal(d.levels[1], { done: true, stars: 3, hearts: run.pathHearts }, 'результат уровня');
  equal(d.hearts, run.hearts + 15, 'в кошельке собранное плюс 5 за каждую звезду');
  equal(d.notes, [1], 'записка открыта');
  equal(await text(page, '#winHearts'), `+${run.hearts + 15}`, 'награда на экране');
  assert(await visible(page, '#btnNote'), 'кнопка записки');
  assert(!(await visible(page, '#btnWinNext')), 'до записки «Дальше» не показываем');
  assert(!(await visible(page, '#btnWinRetry')), 'при трёх звёздах «Ещё раз на три звезды» не нужно');
  await sleep(1300);
  equal(await page.evaluate(() => document.querySelectorAll('#winStars .on').length), 3, 'загорелось звёзд');

  await page.click('#btnNote');
  await waitScreen(page, 'note');
  equal(await text(page, '#noteTitle'), 'Я умею летать', 'заголовок записки');
  assert((await text(page, '#noteText')).length > 40, 'текст записки пустой');
  equal((await stored(page)).seenNotes, [1], 'записка прочитана');
  await page.click('#btnNoteNext');
  await waitScreen(page, 'intro');
  equal(await text(page, '#introName'), 'Кухня', 'после записки — второй уровень');

  // меню после первого уровня
  await page.click('.screen[data-name="intro"] [data-go="menu"]');
  await waitScreen(page, 'menu');
  equal(await text(page, '#btnPlayLabel'), 'Уровень 2', 'главная кнопка ведёт дальше');
  equal(await page.evaluate(() => document.getElementById('btnEndless').getAttribute('aria-disabled')), 'false', 'бесконечный режим открылся');
  equal(await text(page, '.screen[data-name="menu"] [data-wallet]'), String(d.hearts), 'кошелёк в меню');
});

await test('повторная победа: записку можно пропустить; потеря жизни — две звезды', async (track) => {
  const page = track(await game({ save: { levels: { 1: { done: true, stars: 3, hearts: 30 } }, notes: [1], seenNotes: [1], hearts: 10, totalHearts: 10, plays: 1 } }));
  await page.click('#btnLevels');
  await waitScreen(page, 'levels');
  equal(await page.evaluate(() => [...document.querySelectorAll('#levelList .level')].map((b) => b.disabled)), upTo(TOTAL).map((id) => id > 2), 'какие уровни открыты');
  equal(await text(page, '#starTotal'), `3/${TOTAL * 3}`, 'счётчик звёзд');
  await page.click('#levelList li:nth-child(1) .level');
  await waitScreen(page, 'intro');
  await page.click('#btnGo');
  const run = await fastForward(page, 'win', { hits: 1 });
  equal(run.stars, 2, 'одна потерянная жизнь — две звезды');
  await waitScreen(page, 'win');
  assert(await visible(page, '#btnWinNext'), 'записка уже прочитана — нужна кнопка «Дальше»');
  assert(await visible(page, '#btnWinRetry'), 'не три звезды — предлагаем попробовать ещё раз');
  equal(await text(page, '#btnWinNext'), 'Дальше · уровень 2', 'надпись на кнопке');
  equal((await stored(page)).levels[1].stars, 3, 'лучший результат не затёрся');
  await page.click('#btnWinNext');
  await waitScreen(page, 'intro');
  equal(await text(page, '#introName'), 'Кухня', 'переход на следующий уровень');
});

await test('проигрыш: сердечки остаются, «Ещё раз» запускает уровень заново', async (track) => {
  const page = track(await game({ save: { hearts: 5, totalHearts: 5, plays: 1 } }));
  await page.click('#btnPlay');
  await page.click('#btnGo');
  await page.evaluate(() => (window.__fk.sim.hearts = 4));
  const run = await fastForward(page, 'lose');
  equal(run.status, 'lost', 'без взмахов уровень проигран');
  await waitScreen(page, 'lose');
  equal((await stored(page)).hearts, 9, 'собранные сердечки зачислены');
  equal((await stored(page)).levels, {}, 'уровень не засчитан');
  equal(await text(page, '#loseHearts'), '+4', 'награда на экране');
  assert(/^Пройдено \d+%$/.test(await text(page, '#loseProgress')), 'нет строки «Пройдено N%»');
  await page.click('#btnRetry');
  await waitScreen(page, 'play');
  equal(await page.evaluate(() => [window.__fk.sim.status, window.__fk.sim.lives, window.__fk.sim.hearts]), ['ready', 3, 0], 'новая попытка');
});

await test('выход через паузу: собранные сердечки не пропадают и не удваиваются', async (track) => {
  const page = track(await game({ save: { hearts: 5, totalHearts: 5, plays: 1 } }));
  await page.click('#btnPlay');
  await page.click('#btnGo');
  await page.evaluate(() => (window.__fk.sim.hearts = 3));
  await page.keyboard.press('Escape');
  await waitScreen(page, 'pause');
  await page.click('.screen[data-name="pause"] [data-go="menu"]');
  await waitScreen(page, 'menu');
  equal((await stored(page)).hearts, 8, '«В меню» из паузы сохраняет собранное');
  equal(await text(page, '.screen[data-name="menu"] [data-wallet]'), '8', 'кошелёк в меню');

  await page.click('#btnPlay');
  await page.click('#btnGo');
  await page.evaluate(() => (window.__fk.sim.hearts = 2));
  await page.keyboard.press('Escape');
  await waitScreen(page, 'pause');
  await page.click('#btnRestart');
  await waitScreen(page, 'play');
  equal((await stored(page)).hearts, 10, '«Заново» из паузы сохраняет собранное');
  equal(await page.evaluate(() => window.__fk.sim.hearts), 0, 'новая попытка начинается с нуля');

  // сворачивание вкладки посреди полёта, потом проигрыш: каждое сердечко засчитано один раз
  await page.evaluate(() => (window.__fk.sim.hearts = 1));
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  equal((await stored(page)).hearts, 11, 'закрытие вкладки сохраняет собранное');
  await page.evaluate(() => (window.__fk.sim.hearts = 4));
  await fastForward(page, 'lose');
  await waitScreen(page, 'lose');
  equal((await stored(page)).hearts, 14, 'после проигрыша добавлено только новое');
  equal(await text(page, '#loseHearts'), '+4', 'на экране — всё, что собрано за попытку');
});

await test('финал: после последнего уровня открывается письмо, меню предлагает играть снова', async (track) => {
  const levels = {};
  for (let i = 1; i < TOTAL; i++) levels[i] = { done: true, stars: 2, hearts: 20 };
  const page = track(await game({ save: { rounds: TOTAL, levels, notes: upTo(TOTAL - 1), seenNotes: upTo(TOTAL - 1), plays: 9 } }));
  equal(await text(page, '#btnPlayLabel'), `Уровень ${TOTAL}`, 'главная кнопка');
  await page.click('#btnPlay');
  await waitScreen(page, 'intro');
  assert((await text(page, '#introName')).startsWith('Дорога к'), 'название финального уровня');
  equal(await text(page, '#introEyebrow'), `Уровень ${TOTAL} из ${TOTAL} · ${LEVELS[TOTAL - 1].gates} ворот`, 'строка над названием');
  await page.click('#btnGo');
  equal((await fastForward(page, 'win')).status, 'won', 'финальный уровень пройден');
  await waitScreen(page, 'win');
  equal(await text(page, '#btnNoteLabel'), 'Открыть письмо', 'кнопка письма');
  await page.click('#btnNote');
  await waitScreen(page, 'note');
  // У финала две ступени. Сначала Мия пишет сама — конверта ещё нет.
  const finLetter = (CONFIG.letters || []).find((l) => l.level === TOTAL);
  assert(finLetter, 'у финала должно быть письмо в CONFIG.letters');
  equal(await text(page, '#noteTitle'), finLetter.note.title, 'сначала записка Мии');
  assert(!(await visible(page, '#envelope')), 'на первой ступени конверта быть не должно');
  equal(await text(page, '#btnNoteNext'), 'Распечатать письмо', 'кнопка ведёт ко второй ступени');
  await page.click('#btnNoteNext');
  await waitScreen(page, 'note');
  // Вторая ступень: письмо приходит в запечатанном конверте — пока он закрыт, ни текста, ни кнопок не видно
  assert(await visible(page, '#envelope'), 'конверт должен быть виден');
  equal(await text(page, '.envelope__to'), 'Насте', 'на конверте — кому письмо');
  assert(!(await visible(page, '#letter')), 'письмо не должно быть видно до вскрытия конверта');
  assert(!(await visible(page, '#btnNoteNext')), 'кнопки под письмом появляются после вскрытия');
  equal(await page.evaluate(() => window.__fk.renderer.fest), true, 'пока открыто письмо, на фоне летят сердечки');
  await page.click('#envelope');
  await page.waitForFunction(() => !document.getElementById('letter').hidden, { timeout: 15000 });
  assert(!(await visible(page, '#envelope')), 'после вскрытия конверт убирается');
  // у каждого письма своя тема: первое — 'letter', второе — 'email' (см. letterTheme в main.js)
  equal(await page.evaluate(() => window.__fk.sound.theme), 'email', 'у второго письма своя музыка');
  equal(await text(page, '#noteNo'), `Письмо № ${(CONFIG.letters || []).length} из ${(CONFIG.letters || []).length}`, 'подпись над письмом');
  assert((await text(page, '#noteText')).length > 100, 'текст письма пустой');
  const top = await page.evaluate(() => {
    const scr = document.querySelector('.screen[data-name="note"]');
    scr.scrollTop = 0;
    return document.getElementById('noteNo').getBoundingClientRect().top;
  });
  assert(top >= 0, `начало письма уехало за верх экрана и недоступно: ${top}`);
  const photo = await page.evaluate(() => {
    const img = document.querySelector('#notePhoto img');
    return img ? { ok: img.complete && img.naturalWidth > 0, cap: document.querySelector('#notePhoto figcaption').textContent } : null;
  });
  assert(photo && photo.ok && photo.cap.length > 3, `к письму должно быть приклеено фото Мии с подписью: ${JSON.stringify(photo)}`);
  const fits = await page.evaluate(() => {
    const scr = document.querySelector('.screen[data-name="note"]');
    const btn = document.getElementById('btnNoteNext');
    scr.scrollTop = scr.scrollHeight;
    const r = btn.getBoundingClientRect();
    return r.bottom <= innerHeight + 1 && r.top >= 0;
  });
  assert(fits, 'до кнопки под длинным письмом должно быть можно долистать');
  const sign = await page.evaluate(() => {
    const el = document.getElementById('noteSign');
    const svg = el.querySelector('svg');
    return { text: el.textContent, heart: !!el.querySelector('use[href="#i-heart"]'), w: svg ? svg.getBoundingClientRect().width : 0 };
  });
  assert(!/[\u2764\u2665]/.test(sign.text) && sign.heart && sign.w > 8, `сердечко в подписи должно быть нарисованным значком: ${JSON.stringify(sign)}`);
  equal(await text(page, '#btnNoteNext'), 'В меню', 'после письма — в меню');
  await page.click('#btnNoteNext');
  await waitScreen(page, 'menu');
  equal(await text(page, '#btnPlayLabel'), 'Играть снова', 'главная кнопка после финала');
  equal((await stored(page)).notes, upTo(TOTAL), 'все записки открыты');
  equal(await page.evaluate(() => window.__fk.renderer.fest), false, 'в меню праздник заканчивается');
  assert(!['letter', 'email'].includes(await page.evaluate(() => window.__fk.sound.theme)), 'в меню возвращается обычная музыка');
});

await test('старое сохранение (шесть уровней): финал и письмо переезжают на последний номер, новые раунды открываются по очереди', async (track) => {
  const old = {};
  for (let i = 1; i <= 6; i++) old[i] = { done: true, stars: i === 6 ? 2 : 3, hearts: 20 };
  const saved = { levels: old, notes: [1, 2, 3, 4, 5, 6], seenNotes: [1, 2, 3, 4, 5, 6], hearts: 300, totalHearts: 400, skins: ['super', 'hood'], skin: 'hood', plays: 12 };
  const page = track(await game({ save: saved }));
  equal(await text(page, '#btnPlayLabel'), 'Уровень 6', 'главная кнопка зовёт в первый новый раунд');
  await page.click('#btnLevels');
  await waitScreen(page, 'levels');
  const cards = await page.evaluate(() => [...document.querySelectorAll('#levelList .level')].map((c) => `${c.disabled ? 'закрыт' : 'открыт'}:${c.querySelectorAll('.level__stars .on').length}`));
  // Старое сохранение знало один финал — шестой. Переезжает он на ПЕРВЫЙ финал новой сетки
  // (это уровень 10 из 20), а не на последний. Открыты: 1–5, шестой (ждёт прохождения),
  // сам финал и следующий за ним уровень — пройденный уровень открывает соседа.
  const firstFinal = CONFIG.letters[0].level;
  const want = Array.from({ length: TOTAL }, (_, i) => {
    const id = i + 1;
    if (id <= 5) return 'открыт:3';
    if (id === 6) return 'открыт:0';
    if (id === firstFinal) return 'открыт:2';
    if (id === firstFinal + 1) return 'открыт:0';
    return 'закрыт:0';
  });
  equal(cards, want, 'карточки уровней');
  equal(await text(page, '#starTotal'), `17/${TOTAL * 3}`, 'звёзды не потерялись');
  equal(await text(page, '.screen[data-name="menu"] [data-wallet]'), '300', 'сердечки не потерялись');
  await page.close();

  const love = track(await open('love.html', { save: saved }));
  // Открыто: записки пройденных раундов + обе карточки финала, который уже проходили.
  const oldDone = new Set([1, 2, 3, 4, 5, firstFinal]);
  const openNotes = CONFIG.notes.filter((n) => oldDone.has(n.level)).length;
  equal(await text(love, '#noteCount'), `Открыто ${openNotes + 2} из ${CARDS}`, 'счётчик записок');
  assert(!(await love.evaluate(() => document.querySelector('#final .note').classList.contains('note--locked'))), 'письмо, которое уже открывали, остаётся открытым');
  equal(await love.evaluate(() => document.querySelectorAll('#notes .note--locked').length), CONFIG.notes.length - openNotes, 'записки новых раундов ещё заперты');
  // «Пройти уровень» есть только у запертых, но доступных записок: шестой раунд и 11-й
  // (второй финал пройден, значит следующий за ним уровень открыт).
  const reachable = [6, firstFinal + 1].map((id) => `play.html?level=${id}`);
  equal(await love.evaluate(() => [...document.querySelectorAll('.note--locked a')].map((a) => a.getAttribute('href'))), reachable, 'кнопка «Пройти уровень» — у открытых, но ещё не пройденных раундов');
});

await test('новые раунды: вступление с подсказкой, своя записка и фото из альбома', async (track) => {
  const page = track(await game({}, '?dev=1'));
  // все обычные раунды второй главы: финалы 10 и 20 проверяются отдельно, в тестах писем
  const newIds = LEVELS.filter((l) => l.id > 5 && !CONFIG.letters.some((x) => x.level === l.id)).map((l) => l.id);
  for (const id of newIds) {
    const l = LEVELS[id - 1];
    await page.evaluate((n) => window.__fk.startLevel(n), id);
    await waitScreen(page, 'intro');
    equal(await text(page, '#introName'), l.name, `название раунда ${id}`);
    equal(await text(page, '#introTip'), l.tip, `подсказка раунда ${id}`);
    equal(await page.evaluate(() => window.__fk.sim.theme), l.theme, `мир раунда ${id}`);
    await page.evaluate(() => {
      const fk = window.__fk;
      fk.beginPlay();
      fk.sim.flap();
      fk.sim.status = 'won';
      fk.showWin();
    });
    await waitScreen(page, 'win');
    await page.evaluate(() => document.getElementById('btnNote').click());
    await waitScreen(page, 'note');
    const note = CONFIG.notes.find((n) => n.level === id);
    equal(await text(page, '#noteNo'), `Записка № ${id} из ${CONFIG.notes.length}`, `номер записки ${id}`);
    equal(await text(page, '#noteTitle'), note.title, `заголовок записки ${id}`);
    assert(!(await visible(page, '#envelope')), `у записки ${id} конверта нет — он только у письма`);
    await page.waitForFunction(() => { const i = document.querySelector('#notePhoto img'); return i && i.complete && i.naturalWidth > 0; }, { timeout: 15000 });
    equal(await text(page, '#notePhoto figcaption'), CONFIG.photos[id].caption, `подпись под фото ${id}`);
    equal(await text(page, '#btnNoteNext'), `Дальше · уровень ${id + 1}`, `кнопка под запиской ${id}`);
  }
  equal((await stored(page)).notes, newIds, 'записки новых раундов открыты');
});

await test('уровни и гардероб: шапка и кнопка «назад» видны на любом телефоне, до последней карточки можно долистать', async (track) => {
  const page = track(await game({ w: 390, h: 844, touch: true, save: { hearts: 900, totalHearts: 900, plays: 3 } }, '?dev=1'));
  for (const [w, h] of [[320, 568], [360, 700], [375, 812], [390, 664], [393, 740], [412, 780], [430, 800], [740, 360]]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    for (const name of ['levels', 'wardrobe']) {
      await page.evaluate((n) => window.__fk.go(n), name);
      await settle(page);
      const m = await page.evaluate((n) => {
        const scr = document.querySelector(`.screen[data-name="${n}"]`);
        scr.scrollTop = 0;
        const head = scr.querySelector('.panel__head').getBoundingClientRect();
        const back = scr.querySelector('.iconbtn').getBoundingClientRect();
        scr.scrollTop = scr.scrollHeight;
        const last = [...scr.querySelectorAll('li')].pop().getBoundingClientRect();
        scr.scrollTop = 0;
        return { head: Math.round(head.top), back: Math.round(back.top), lastBottom: Math.round(last.bottom), vh: innerHeight, n: scr.querySelectorAll('li').length };
      }, name);
      assert(m.head >= 0 && m.back >= 0, `${name} ${w}×${h}: шапка уехала за верх экрана: ${JSON.stringify(m)}`);
      assert(m.lastBottom <= m.vh + 1, `${name} ${w}×${h}: до последней карточки не долистать: ${JSON.stringify(m)}`);
      if (name === 'levels') equal(m.n, TOTAL, 'карточек уровней');
    }
    await page.evaluate(() => window.__fk.go('menu'));
  }
});

await test('меню: Мия здоровается и отвечает на касание', async (track) => {
  const page = track(await game());
  await page.waitForFunction(() => !document.getElementById('bubble').hidden, { timeout: 15000 });
  const first = await text(page, '#bubble');
  assert(first.length > 0, 'первая реплика пустая');
  const at = await page.evaluate(() => {
    const { sim, renderer } = window.__fk;
    const c = document.getElementById('game').getBoundingClientRect();
    const p = renderer.toCss(sim.miaX, sim.mia.y);
    return { x: c.left + p.x, y: c.top + p.y };
  });
  await page.mouse.click(at.x, at.y);
  await page.waitForFunction((t) => { const b = document.getElementById('bubble'); return !b.hidden && b.textContent !== t; }, { timeout: 15000 }, first);
  const box = await page.evaluate(() => {
    const r = document.getElementById('bubble').getBoundingClientRect();
    return { l: r.left, r: r.right, t: r.top, w: innerWidth };
  });
  assert(box.l >= 0 && box.r <= box.w && box.t >= 0, `облачко с репликой вылезло за экран: ${JSON.stringify(box)}`);
  equal(await screen(page), 'menu', 'касание Мии не должно запускать игру');
  // мимо Мии — тишина
  await page.evaluate(() => (document.getElementById('bubble').hidden = true));
  await page.mouse.click(at.x, at.y - 170);
  await sleep(300);
  assert(await page.evaluate(() => document.getElementById('bubble').hidden), 'касание мимо Мии не должно вызывать реплику');
  await page.click('#btnPlay');
  await waitScreen(page, 'intro');
  assert(await page.evaluate(() => document.getElementById('bubble').hidden), 'вне меню облачка быть не должно');
});

await test('записка уровня: фото на память и текст сразу, без конверта', async (track) => {
  const page = track(await game());
  await page.click('#btnPlay');
  await page.click('#btnGo');
  await waitScreen(page, 'play');
  await fastForward(page, 'win');
  await waitScreen(page, 'win');
  await page.click('#btnNote');
  await waitScreen(page, 'note');
  assert(!(await visible(page, '#envelope')), 'у обычной записки конверта нет');
  assert(await visible(page, '#letter'), 'записка видна сразу');
  assert(await visible(page, '#btnNoteNext'), 'кнопка «Дальше» видна сразу');
  await page.waitForFunction(() => { const i = document.querySelector('#notePhoto img'); return i && i.complete && i.naturalWidth > 0; }, { timeout: 15000 });
  equal(await text(page, '#notePhoto figcaption'), 'Портрет на подлокотнике', 'подпись под фото — из альбома');
  equal(await page.evaluate(() => window.__fk.renderer.fest), false, 'праздник с сердечками — только для письма');
});

await test('полёт: серия сердечек, пролёт впритирку и удар дают отклик и ничего не ломают', async (track) => {
  const page = track(await game({ expect: 'intro' }, '?dev=1&level=1'));
  await page.click('#btnGo');
  await waitScreen(page, 'play');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__fk.sim.status === 'playing', { timeout: 15000 });
  const target = await page.evaluate(() => window.__fk.renderer.hudHeart);
  assert(target && target.x > 0 && target.y < 60, `сердечки должны лететь к счётчику наверху: ${JSON.stringify(target)}`);
  await page.evaluate(() => {
    const sim = window.__fk.sim;
    sim.inv = 5;
    const x = sim.dist + sim.miaX;
    sim.emit('heart', { x, y: sim.mia.y, streak: 10 });
    sim.emit('streak', { n: 10, bonus: 2 });
    sim.emit('near', { x, y: sim.mia.y - 30, up: true });
  });
  await page.waitForFunction(() => window.__fk.renderer.particles.some((p) => p.kind === 'text' && /подряд/.test(p.text)), { timeout: 15000 });
  const kinds = await page.evaluate(() => Array.from(new Set(window.__fk.renderer.particles.map((p) => p.kind))));
  assert(kinds.includes('fly'), `собранное сердечко должно лететь к счётчику: ${kinds}`);
  await page.evaluate(() => {
    const sim = window.__fk.sim;
    sim.inv = 0;
    sim.hit('test');
  });
  await page.waitForFunction(() => window.__fk.renderer.trauma > 0, { timeout: 15000 });
  equal(await page.evaluate(() => window.__fk.sim.lives), 2, 'удар отнимает ровно одну жизнь');
  await page.waitForFunction(() => window.__fk.renderer.trauma === 0, { timeout: 30000 });
  equal(await screen(page), 'play', 'после удара игра продолжается');
});

await test('бесконечный режим: одна жизнь, счёт, рекорд', async (track) => {
  const page = track(await game({ save: { levels: { 1: { done: true, stars: 1, hearts: 5 } }, notes: [1], best: 3, plays: 2 } }));
  equal(await text(page, '#menuBest'), 'Рекорд: 3', 'рекорд в меню');
  await page.click('#btnEndless');
  await waitScreen(page, 'play');
  assert(!(await visible(page, '#hudLives')), 'в бесконечном режиме счётчик жизней не нужен');
  assert(await visible(page, '#hudScore'), 'счёт должен быть виден');
  assert(await visible(page, '#btnPause'), 'кнопка паузы на месте');
  const paused = await page.evaluate(() => document.getElementById('btnPause').getBoundingClientRect().right);
  assert(paused > 330, 'кнопка паузы должна остаться у правого края');
  const run = await page.evaluate(() => {
    const sim = window.__fk.sim;
    sim.flap();
    let i = 0;
    while (sim.status === 'playing' && i < 120 * 120) {
      sim.inv = sim.passed < 5 ? 0.5 : 0;
      if (i % 15 === 0 && sim.passed < 5) {
        const wx = sim.dist + sim.miaX;
        const g = sim.gates.find((x) => x.x + x.w > wx - 20);
        if (sim.mia.y + sim.mia.vy * 0.07 > (g ? g.gapY + 22 : 330)) sim.flap();
      }
      sim.step(1 / 120);
      i++;
    }
    while (sim.status === 'dying') sim.step(1 / 120);
    return { passed: sim.passed, hearts: sim.hearts, status: sim.status };
  });
  equal(run.status, 'lost', 'после пяти ворот Мия падает');
  assert(run.passed >= 5, 'пройдено ворот');
  await waitScreen(page, 'over');
  equal(await text(page, '#overScore'), String(run.passed), 'счёт на экране');
  assert(await visible(page, '#overNew'), 'должна быть плашка нового рекорда');
  equal((await stored(page)).best, run.passed, 'рекорд сохранён');
  equal((await stored(page)).hearts, run.hearts, 'сердечки зачислены');
});

await test('гардероб: покупка, переодевание, нехватка сердечек', async (track) => {
  const page = track(await game({ save: { hearts: 100, totalHearts: 100, plays: 5 } }));
  await page.click('#btnWardrobe');
  await waitScreen(page, 'wardrobe');
  equal(await page.evaluate(() => document.querySelectorAll('#skinList .skin').length), 6, 'обликов в гардеробе');
  const state = () => page.evaluate(() => [...document.querySelectorAll('#skinList .skin')].map((li) => `${li.querySelector('.btn').textContent.trim()}${li.querySelector('.btn').disabled ? '*' : ''}`));
  equal(await state(), ['Надето*', '40', '80', '120*', '160*', '220*'], 'кнопки при 100 сердечках');
  await page.click('#skinList .skin:nth-child(2) .btn');
  await page.waitForFunction(() => document.querySelector('#skinList .skin:nth-child(2) .btn').textContent.trim() === 'Надето');
  let d = await stored(page);
  equal([d.hearts, d.skin, d.skins], [60, 'hood', ['super', 'hood']], 'после покупки');
  equal(await page.evaluate(() => window.__fk.renderer.skin.id), 'hood', 'облик сразу надет в игре');
  equal(await state(), ['Надеть', 'Надето*', '80*', '120*', '160*', '220*'], 'кнопки после покупки');
  equal(await text(page, '.screen[data-name="wardrobe"] [data-wallet]'), '60', 'кошелёк в гардеробе');
  await page.click('#skinList .skin:nth-child(1) .btn');
  await page.waitForFunction(() => document.querySelector('#skinList .skin:nth-child(1) .btn').textContent.trim() === 'Надето');
  d = await stored(page);
  equal([d.hearts, d.skin], [60, 'super'], 'переодевание бесплатное');
  await page.reload({ waitUntil: 'networkidle0' });
  await waitScreen(page, 'menu');
  equal((await stored(page)).skins, ['super', 'hood'], 'покупка пережила перезагрузку');
});

await test('звук: кнопка в меню выключает всё, настройка запоминается', async (track) => {
  const page = track(await game());
  equal(await page.evaluate(() => document.getElementById('btnMute').getAttribute('aria-pressed')), 'false', 'по умолчанию звук включён');
  await page.click('#btnMute');
  let d = await stored(page);
  equal([d.sound, d.music], [false, false], 'после нажатия');
  equal(await page.evaluate(() => document.getElementById('btnMute').getAttribute('aria-label')), 'Включить звук', 'подпись кнопки');
  await page.reload({ waitUntil: 'networkidle0' });
  await waitScreen(page, 'menu');
  equal(await page.evaluate(() => document.getElementById('btnMute').getAttribute('aria-pressed')), 'true', 'после перезагрузки звук всё ещё выключен');
  await page.click('#btnPlay');
  await page.click('#btnGo');
  await page.mouse.click(195, 500);
  await page.keyboard.press('KeyP');
  await waitScreen(page, 'pause');
  equal(await page.evaluate(() => [document.getElementById('tglSound').getAttribute('aria-pressed'), document.getElementById('tglMusic').getAttribute('aria-pressed')]), ['false', 'false'], 'переключатели на паузе');
  await page.click('#tglMusic');
  d = await stored(page);
  equal([d.sound, d.music], [false, true], 'музыку можно включить отдельно');
});

await test('адреса: ?level=N, ?dev=1, ?reset=1', async (track) => {
  const locked = track(await game({}, '?level=4'));
  equal(await screen(locked), 'menu', 'закрытый уровень по ссылке не открывается');
  await locked.close(); // каждая открытая вкладка рисует игру — лишние закрываем сразу

  const open2 = track(await game({ save: { levels: { 1: { done: true, stars: 1, hearts: 3 } }, notes: [1], plays: 1 }, expect: 'intro' }, '?level=2'));
  equal(await text(open2, '#introName'), 'Кухня', 'открытый уровень по ссылке');
  await open2.close();

  const dev = track(await game({ expect: 'intro' }, '?dev=1&level=5'));
  equal(await text(dev, '#introName'), 'Зимняя сказка', '?dev=1 открывает любой уровень');
  await dev.close();

  const reset = track(await game({ save: { hearts: 77, totalHearts: 77, levels: { 1: { done: true, stars: 3, hearts: 9 } }, notes: [1], plays: 4 } }, '?reset=1'));
  const d = await stored(reset);
  equal([d.hearts, d.levels, d.notes], [0, {}, []], 'после сброса');
  assert(!(await reset.evaluate(() => location.search.includes('reset'))), '?reset=1 должен исчезнуть из адреса, чтобы не сработать повторно');
  await reset.close();

  const keep = track(await game({ dialog: 'dismiss', save: { hearts: 77, totalHearts: 77, plays: 4 } }, '?reset=1'));
  equal((await stored(keep)).hearts, 77, 'отказ в диалоге ничего не стирает');
});

await test('день рождения: в нужный день меню поздравляет', async (track) => {
  const { month, day, enabled, sweet } = await (async () => {
    const { CONFIG } = await import('../assets/js/config.js');
    return { ...CONFIG.birthday, sweet: CONFIG.her.sweet };
  })();
  if (!enabled) return;
  const iso = `2027-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00`;
  const page = track(await game({ date: iso }));
  assert(await visible(page, '#bday'), 'поздравление должно быть видно');
  assert((await text(page, '#bday')).includes(sweet), 'в поздравлении должно быть имя');
});

await test('игра помещается на маленьком и на лежачем экране', async (track) => {
  for (const [w, h] of [[320, 568], [844, 390], [667, 375]]) {
    const page = track(await game({ w, h, touch: true, save: { levels: { 1: { done: true, stars: 2, hearts: 9 } }, notes: [1], best: 12, plays: 3 } }));
    await settle(page); // меню появляется с анимацией — меряем, когда всё встало на место
    const off = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('.screen[data-name="menu"] .btn, .screen[data-name="menu"] .iconbtn, .logo')) {
        const r = el.getBoundingClientRect();
        if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) out.push(`${el.id || el.className} ${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)}`);
      }
      return out;
    });
    equal(off, [], `меню ${w}×${h}: элементы за краем экрана`);
    await page.tap('#btnPlay');
    await waitScreen(page, 'intro');
    const btn = await page.evaluate(() => {
      const r = document.getElementById('btnGo').getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight + 1;
    });
    assert(btn, `вступление ${w}×${h}: кнопка «Полетели!» не помещается`);
  }
});

await test('стресс: все события, темы, облики и звуки отрабатывают без ошибок', async (track) => {
  const page = track(await game({}, '?dev=1'));
  // звук: настоящий AudioContext, каждое имя звука и каждая тема музыки со всеми настроениями
  const audio = await page.evaluate(async (themes) => {
    const { sound } = window.__fk;
    const errors = [];
    sound.unlock();
    if (!sound.ctx) return { errors: ['AudioContext не создан'], state: null };
    const names = ['flap', 'heart', 'streak', 'streakEnd', 'near', 'purr', 'seal', 'envelope', 'photo', 'fish', 'power', 'powerEnd', 'pop', 'yarn', 'squeak', 'plop', 'clear', 'croak', 'shield', 'hit', 'gate', 'warn', 'wind', 'win', 'lose', 'star', 'click', 'buy', 'nope', 'meow', 'paper', 'нет-такого'];
    for (const n of names) {
      try {
        sound.play(n, { streak: 37 });
        sound.play(n);
      } catch (e) {
        errors.push(`play(${n}): ${e.message}`);
      }
    }
    for (const theme of [...themes, 'rainbow', 'letter', 'нет-такой']) {
      for (const mood of [{}, { intensity: 0.5 }, { intensity: 1, boost: true }, { intensity: 2, danger: true }, { intensity: -1 }]) {
        try {
          sound.setTheme(theme);
          sound.setMood(mood);
          sound.musicOn = true;
          sound.nextTime = 0;
          for (let i = 0; i < 6; i++) {
            sound.nextTime = sound.ctx.currentTime - 1; // заставляем расписать следующую порцию нот
            sound.schedule();
          }
        } catch (e) {
          errors.push(`музыка ${theme} ${JSON.stringify(mood)}: ${e.message}`);
        }
      }
    }
    sound.musicOn = false;
    try {
      sound.duck(0.3);
      sound.sleep();
      sound.wake();
      sound.setSound(false);
      sound.play('hit');
      sound.setSound(true);
    } catch (e) {
      errors.push('duck/sleep/wake: ' + e.message);
    }
    return { errors, state: sound.ctx.state, freq: sound.musFilter.frequency.value };
  }, LEVELS.map((l) => l.theme));
  equal(audio.errors, [], 'звук');

  // картинка: каждый уровень и бесконечный режим, каждое событие, обычный режим и «уменьшить движение»
  // По одному забегу за вызов: в браузере без видеокарты отрисовка медленная.
  const drawRun = (label, id) => page.evaluate(async (label, id) => {
    const fk = window.__fk;
    const r = fk.renderer;
    const errors = [];
    fk.freeze(true); // рисуем сами, чтобы игровой цикл не мешал
    const all = ['start', 'flap', 'heart', 'streak', 'streakEnd', 'near', 'fish', 'pop', 'power', 'powerEnd', 'shieldBreak', 'gate', 'warn', 'wind', 'hit', 'splash', 'clear', 'croak', 'theme', 'win', 'lose', 'dying', 'нет-такого'];
    const run = (label, start) => {
      for (const calm of [false, true]) {
        r.reduceMotion = calm;
        try {
          start();
          const sim = fk.sim;
          sim.flap();
          let seen = new Set();
          for (let i = 0; i < 120 * 70 && (sim.status === 'playing' || sim.status === 'dying'); i++) {
            sim.inv = Math.max(sim.inv, 0.5);
            if (i === 300) { sim.shield = true; sim.magnet = 3; sim.catnip = 3; }
            if (i % 15 === 0) {
              const wx = sim.dist + sim.miaX;
              const g = sim.gates.find((x) => x.x + x.w > wx - 20);
              if (sim.mia.y + sim.mia.vy * 0.07 > (g ? g.gapY + 22 : 330)) sim.flap();
            }
            if (label === 'бесконечный' && sim.passed >= 45) { sim.inv = 0; sim.shield = false; sim.hit('test'); }
            sim.step(1 / 120);
            for (const ev of sim.events) { seen.add(ev.type); r.handle(ev, sim); }
            sim.events.length = 0;
            if (i % 60 === 0) r.draw(sim, 0.05); // кадр раз в полсекунды игрового времени: уровней десять, а отрисовка без видеокарты медленная
          }
          // события, которые в этом забеге не встретились, — с полями и без
          for (const type of all) {
            r.handle({ type, x: sim.dist + sim.miaX, y: 200, streak: 99, n: 10, bonus: 2, up: true, lives: 1, kind: 'magnet', hue: 1, theme: sim.theme }, sim);
            r.handle({ type, kind: 'shield', lives: 0 }, sim);
          }
          r.hudHeart = { x: 80, y: 20 };
          r.handle({ type: 'heart', x: sim.dist + 100, y: 300, streak: 3 }, sim);
          r.fest = true;
          r.poke(sim);
          r.addTrauma(5);
          // отрицательный и нулевой шаг времени, большой шаг — ничего не должно падать
          for (const dt of [0.016, 0, -0.3, 0.1, 0.016, 0.5, 0.016]) r.draw(sim, dt);
          for (let i = 0; i < 40; i++) r.draw(sim, 0.25);
          r.fest = false;
          if (r.particles.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) errors.push(`${label}: у частицы нечисловые координаты`);
          if (!Number.isFinite(r.stretch) || !Number.isFinite(r.trauma)) errors.push(`${label}: stretch/trauma стали нечисловыми`);
          r.particles.length = 0;
        } catch (e) {
          errors.push(`${label}${calm ? ' (уменьшить движение)' : ''}: ${e.message}`);
        }
      }
    };
    if (id) run(label, () => { fk.startLevel(id); fk.beginPlay(); });
    else run(label, () => fk.startEndless());
    r.reduceMotion = false;
    fk.go('menu');
    fk.freeze(false);
    return errors;
  }, label, id);
  for (let id = 1; id <= TOTAL; id++) equal(await drawRun(`уровень ${id}`, id), [], `отрисовка, уровень ${id}`);
  equal(await drawRun('бесконечный', 0), [], 'отрисовка, бесконечный режим');

  // каждый облик загружается и рисуется
  const skins = await page.evaluate(async () => {
    const out = [];
    const { SKINS } = await import('./assets/js/game/levels.js');
    for (const s of SKINS) {
      const img = new Image();
      img.src = s.src;
      try {
        await img.decode();
      } catch (e) {
        out.push(`${s.id}: картинка не читается`);
        continue;
      }
      window.__fk.renderer.setSkin(s, img);
      try {
        window.__fk.renderer.draw(window.__fk.sim, 0.016);
      } catch (e) {
        out.push(`${s.id}: ${e.message}`);
      }
    }
    return out;
  });
  equal(skins, [], 'облики');
});

await test('сломанный звук не мешает играть', async (track) => {
  const page = await browser.newPage();
  track(page);
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push('ошибка скрипта: ' + e.message));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  // браузер, в котором звуковое устройство не создаётся вовсе
  await page.evaluateOnNewDocument(() => {
    localStorage.clear();
    const Broken = function () {
      throw new Error('нет звукового устройства');
    };
    window.AudioContext = Broken;
    window.webkitAudioContext = Broken;
  });
  await page.goto(ORIGIN + BASE + 'play.html', { waitUntil: 'networkidle0' });
  await waitScreen(page, 'menu');
  await page.click('#btnPlay');
  await waitScreen(page, 'intro');
  await page.click('#btnGo');
  await waitScreen(page, 'play');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__fk.sim.status === 'playing', { timeout: 15000 });
  equal(await page.evaluate(() => window.__fk.sound.ctx), null, 'звука нет');
  equal((await fastForward(page, 'win')).status, 'won', 'уровень проходится и без звука');
  await waitScreen(page, 'win');

  // звук есть, но ломается посреди игры: событие всё равно обрабатывается до конца
  const live = track(await game({ expect: 'intro' }, '?dev=1&level=1'));
  await live.click('#btnGo');
  await waitScreen(live, 'play');
  await live.keyboard.press('Space');
  await live.waitForFunction(() => window.__fk.sim.status === 'playing', { timeout: 15000 });
  await live.evaluate(() => {
    const { sound, sim } = window.__fk;
    sound.tone = () => {
      throw new Error('звук сломался');
    };
    sound.noise = sound.tone;
    sim.inv = 0;
    sim.hit('test');
  });
  await live.waitForFunction(() => window.__fk.sim.events.length === 0 && window.__fk.renderer.trauma > 0, { timeout: 15000 });
  equal(await live.evaluate(() => window.__fk.sim.lives), 2, 'удар засчитан один раз');
});

await test('конверт с письмом помещается на маленьком и на лежачем экране; «уменьшить движение» открывает его сразу', async (track) => {
  const levels = {};
  for (let i = 1; i <= TOTAL; i++) levels[i] = { done: true, stars: 3, hearts: 20 };
  const saved = { rounds: TOTAL, levels, notes: upTo(TOTAL), seenNotes: upTo(TOTAL - 1), plays: 9 };
  const toLetter = async (page) => {
    await page.evaluate((last) => {
      const fk = window.__fk;
      fk.startLevel(last);
      fk.beginPlay();
      fk.sim.flap();
      fk.sim.status = 'won';
      fk.showWin();
    }, TOTAL);
    await waitScreen(page, 'win');
    await page.evaluate(() => document.getElementById('btnNote').click());
    await waitScreen(page, 'note');
    // финал двухступенчатый: сначала записка Мии, потом конверт
    await page.evaluate(() => document.getElementById('btnNoteNext').click());
    await waitScreen(page, 'note');
  };
  for (const [w, h] of [[320, 568], [844, 390]]) {
    const page = track(await game({ w, h, touch: true, save: saved }));
    await toLetter(page);
    await settle(page);
    const box = await page.evaluate(() => {
      const r = document.getElementById('envelope').getBoundingClientRect();
      const hint = document.getElementById('envelopeHint').getBoundingClientRect();
      return { l: r.left, r: r.right, t: r.top, b: hint.bottom, w: innerWidth, h: innerHeight };
    });
    assert(box.l >= 0 && box.r <= box.w && box.t >= 0 && box.b <= box.h + 1, `конверт ${w}×${h} не помещается: ${JSON.stringify(box)}`);
    await page.close(); // письмо с сердечками на фоне — тяжёлая сцена; не держим несколько сразу
  }
  // «уменьшить движение»: без ожидания анимации — письмо сразу на экране
  const calm = track(await game({ save: saved }));
  await calm.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await calm.reload({ waitUntil: 'networkidle0' });
  await waitScreen(calm, 'menu');
  equal(await calm.evaluate(() => window.__fk.renderer.reduceMotion), true, 'игра должна заметить настройку');
  await toLetter(calm);
  await calm.click('#envelope');
  await calm.waitForFunction(() => !document.getElementById('letter').hidden, { timeout: 15000 });
  const shown = await calm.evaluate(() => getComputedStyle(document.querySelector('#noteText p:last-child')).opacity);
  equal(shown, '1', 'при «уменьшить движение» текст письма виден сразу, без поочерёдного появления');
});

// Эта проверка — последняя: после неё страницами управляет сохранённая копия сайта.
await test('без сети: после первого открытия игра запускается из сохранённой копии', async (track) => {
  const page = track(await game({}, '?sw=1'));
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 20000 });
  // ждём, пока копия наполнится
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    if (!keys.length) return false;
    const cache = await caches.open(keys[0]);
    return (await cache.keys()).length >= 30;
  }, { timeout: 30000, polling: 500 });
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitScreen(page, 'menu');
  await page.click('#btnPlay');
  await waitScreen(page, 'intro');
  await page.click('#btnGo');
  await waitScreen(page, 'play');
  assert(await page.evaluate(() => !!window.__fk.renderer.sticker), 'картинка Мии должна загрузиться из копии');
  await page.setOfflineMode(false);
  await page.evaluate(async () => {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
  });
});

/* ======================= итог ======================= */

await browser.close();
server.close();
rootServer.close();
const bad = results.filter((r) => !r.ok);
console.log(bad.length ? `\n✗ Сквозная проверка: не прошло ${bad.length} из ${results.length}.` : `\n✓ Сквозная проверка: ${results.length} из ${results.length}.`);
process.exit(bad.length ? 1 : 0);
