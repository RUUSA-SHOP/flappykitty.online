/* Flappy Kitty · главный модуль: экраны, ввод, игровой цикл. */

import { CONFIG, setSignature, isBirthday } from '../config.js';
import { save } from '../storage.js';
import { LEVELS, ROUNDS, ROUNDS_PER_LEVEL, roundsOf, SKINS, POWERUPS } from './levels.js';
import { Sim } from './sim.js';
import { Renderer } from './render.js';
import { Sound } from './audio.js';
import { THEMES } from './themes.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const STEP = 1 / 120;
const params = new URLSearchParams(location.search);
const DEV = params.has('dev'); // play.html?dev=1 — все раунды открыты (для проверки)

const stage = $('#stage');
const canvas = $('#game');
const renderer = new Renderer(canvas);
const sound = new Sound();

const LOSE_LINES = [
  'Мия прилегла отдохнуть. Но она уже готова лететь снова.',
  'Девять жизней — это в сумме. На уровень выдают три.',
  'Мия делает вид, что так и было задумано.',
  'Это была разведка. Теперь всерьёз.',
];

let sim = null;
let screen = 'loading';
let mode = 'story';
let roundId = 1;
let acc = 0;
let last = 0;
let pendingTimer = null;
let afterNote = null;
let frozen = false;
let musicStarted = false; // музыка включается с первым полётом и дальше играет везде, кроме паузы
let hitStop = 0; // «стоп-кадр» после удара: мир замирает на долю секунды, и удар ощущается весомее
let timeScale = 1; // замедление времени в момент победы
let attractT = 0;
let lineNo = 0; // какую реплику Мия скажет следующей
let bubbleTimer = null;
let envelopeTimer = null;
let wakeLock = null;
const calm = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const images = {};
const hud = {};

/* ---------- запуск ---------- */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не загрузилась картинка: ' + src));
    img.src = src;
  });
}

async function applySkin(id) {
  const skin = SKINS.find((s) => s.id === id) || SKINS[0];
  if (!images[skin.id]) images[skin.id] = await loadImage(skin.src);
  renderer.setSkin(skin, images[skin.id]);
}

async function boot() {
  // play.html?reset=1 — начать с чистого листа (удобно перед тем, как дарить)
  if (params.has('reset')) {
    if (window.confirm('Сбросить весь прогресс: раунды, сердечки, облики и записки?')) save.reset();
    params.delete('reset');
    const q = params.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : ''));
  }
  fillNames();
  const d = save.data;
  sound.setSound(d.sound);
  sound.setMusic(d.music);
  try {
    await applySkin(d.skin);
  } catch (e) {
    await applySkin('super');
  }
  if (document.fonts && document.fonts.ready) {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]);
  }
  bind();
  resize();
  attract();
  // ?round=N — номер раунда подряд, от 1 до 20; ?level=N — то же самое, старое имя (ссылки из прежней версии)
  const jump = parseInt(params.get('round') || params.get('level'), 10);
  if (jump && (DEV || save.isRoundOpen(jump)) && ROUNDS[jump - 1]) startRound(jump);
  else go('menu');
  last = performance.now();
  requestAnimationFrame(frame);
  // Мия здоровается сама — так понятно, что она живая и её можно потрогать
  setTimeout(() => {
    const lines = CONFIG.miaLines || [];
    if (screen === 'menu' && lines.length && sayLine(lines[lineNo % lines.length], { quiet: true })) lineNo++;
  }, 1300);
}

function fillNames() {
  $$('[data-her-sweet]').forEach((e) => (e.textContent = CONFIG.her.sweet));
  $$('[data-her-dative]').forEach((e) => (e.textContent = CONFIG.her.dative));
  $$('[data-cat]').forEach((e) => (e.textContent = CONFIG.cat.name));
  if (isBirthday()) $('#bday').hidden = false;
}

/* ---------- экраны ---------- */

function go(name) {
  screen = name;
  stage.dataset.screen = name;
  $$('.screen').forEach((s) => (s.hidden = s.dataset.name !== name));
  $('#hud').hidden = !(name === 'play' || name === 'pause');
  if (name !== 'play') $('#hint').hidden = true;
  if (name !== 'menu') hideBubble();
  if (name !== 'note') closeLetter();
  if (name === 'play') {
    keepAwake(true);
    aimHearts(); // счётчик только что появился на экране — запоминаем, куда лететь сердечкам
  }
  else if (name !== 'pause') keepAwake(false);
  hitStop = 0;
  timeScale = 1;
  if (name !== 'play' && name !== 'pause') sound.setMood({ intensity: name === 'win' || name === 'note' ? 0.55 : 0.2 });
  if (name === 'menu') {
    clearTimeout(pendingTimer);
    bankHearts();
    attract();
    refreshMenu();
  }
  if (name === 'levels') renderLevels();
  if (name === 'wardrobe') renderSkins();
  if (musicStarted) {
    if (name === 'pause') sound.stopMusic();
    else sound.startMusic();
  }
  // с клавиатуры удобно сразу попадать на главную кнопку экрана
  const scr = $(`.screen[data-name="${name}"]`);
  const focusable = scr && ($('.btn:not(.btn--ghost):not([hidden]):not([disabled])', scr) || $('.btn:not([hidden]):not([disabled])', scr));
  if (focusable && matchMedia('(hover: hover)').matches) focusable.focus({ preventScroll: true });
}

function refreshMenu() {
  const d = save.data;
  $$('[data-wallet]').forEach((e) => (e.textContent = d.hearts));
  const allDone = ROUNDS.every((l) => d.levels[l.id] && d.levels[l.id].done);
  const next = save.nextRound(ROUNDS.length);
  const started = Object.keys(d.levels).length > 0;
  $('#btnPlayLabel').textContent = allDone ? 'Играть снова' : started ? roundLabel(ROUNDS[next - 1]) : 'Играть';
  $('#btnPlay').classList.toggle('btn--long', started && !allDone); // длинная подпись — шрифт мельче, без переноса
  const endlessOpen = DEV || (d.levels[1] && d.levels[1].done);
  const be = $('#btnEndless');
  be.setAttribute('aria-disabled', endlessOpen ? 'false' : 'true');
  $('use', be).setAttribute('href', endlessOpen ? '#i-infinity' : '#i-lock');
  const best = $('#menuBest');
  best.hidden = !d.best;
  best.textContent = `Рекорд: ${d.best}`;
  syncToggles();
}

/* ---------- Мия в меню: её можно потрогать ---------- */

function sayLine(text, { quiet = false } = {}) {
  const b = $('#bubble');
  if (!text || screen !== 'menu' || !sim) return false;
  b.hidden = true;
  void b.offsetWidth; // перезапускает анимацию появления
  b.textContent = text;
  // облачко стоит над головой Мии; координаты мира переводим в пиксели экрана
  const at = renderer.toCss(sim.miaX, sim.hoverY - 66);
  b.style.left = at.x + 'px';
  b.style.top = at.y + 'px';
  b.hidden = false;
  if (quiet) {
    // Приветствие без касания не должно закрывать подзаголовок: на самых маленьких экранах места над Мией нет.
    // размеры берём без учёта анимации появления (она начинается с уменьшенного облачка)
    const c = canvas.getBoundingClientRect();
    const t = $('.menu__sub').getBoundingClientRect();
    const top = c.top + at.y - b.offsetHeight;
    const left = c.left + at.x - b.offsetWidth / 2;
    if (top < t.bottom + 4 && left + b.offsetWidth > t.left && left < t.right) {
      b.hidden = true;
      return false;
    }
  }
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(hideBubble, 2400);
  return true;
}

function hideBubble() {
  clearTimeout(bubbleTimer);
  const b = $('#bubble');
  if (b) b.hidden = true;
}

function pokeMia() {
  const lines = CONFIG.miaLines || [];
  renderer.poke(sim);
  sound.play(lineNo % 3 === 2 ? 'purr' : 'meow');
  buzz(15);
  if (lines.length) sayLine(lines[lineNo++ % lines.length]);
}

/** Не даём экрану телефона погаснуть посреди полёта. Не везде поддерживается — тогда просто ничего не делаем. */
function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock && !document.hidden) {
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          wakeLock = l;
          l.addEventListener('release', () => {
            if (wakeLock === l) wakeLock = null;
          });
        })
        .catch(() => {});
    } else if (!on && wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  } catch (e) {
    /* не страшно */
  }
}

/** Где Мия парит в меню. На обычном экране — по центру, между названием и кнопками.
    На низком (телефон боком) кнопки занимают это место и закрывали её наполовину, поэтому там она
    отлетает вправо от названия. Порог тот же, что у правила «низкий экран» в game.css. */
function placeMenuMia() {
  const low = (canvas.clientHeight || 720) <= 520;
  sim.viewW = renderer.viewW;
  sim.miaX = low ? renderer.viewW - 150 : renderer.viewW / 2;
  sim.hoverY = low ? 290 : 400; // ниже счётчика сердечек: над головой ещё облачко с репликой
}

/** Фоновая сцена для меню: Мия парит по центру, мир медленно плывёт. */
function attract() {
  const next = save.nextRound(ROUNDS.length);
  sim = new Sim({ mode: 'story', roundId: next, viewW: renderer.viewW, seed: 7 });
  sim.gates = [];
  sim.items = [];
  sim.finishX = null;
  sim.attract = true;
  placeMenuMia();
  renderer.finishLabel = '';
  sound.setTheme(sim.theme);
}

/** Экран «Уровни»: два уровня, в каждом десять раундов и письмо в конце. */
function renderLevels() {
  const d = save.data;
  const box = $('#levelList');
  box.innerHTML = '';
  const done = (id) => !!(d.levels[id] && d.levels[id].done);
  for (const lv of LEVELS) {
    const rounds = roundsOf(lv.id);
    const first = rounds[0];
    const last = rounds[rounds.length - 1];
    const open = DEV || save.isRoundOpen(first.id);
    const stars = rounds.reduce((n, r) => n + ((d.levels[r.id] && d.levels[r.id].stars) || 0), 0);
    const passed = rounds.filter((r) => done(r.id)).length;
    const sec = document.createElement('section');
    sec.className = open ? 'tier' : 'tier is-locked';
    sec.dataset.level = lv.id;
    sec.setAttribute('aria-label', `Уровень ${lv.id}. ${lv.name}`);
    sec.innerHTML = `
      <header class="tier__head">
        <p class="tier__no">Уровень ${lv.id}</p>
        <h3 class="tier__name"></h3>
        <p class="tier__stars" aria-label="Звёзд: ${stars} из ${rounds.length * 3}"><svg class="icon" aria-hidden="true"><use href="#i-star"/></svg>${stars}/${rounds.length * 3}</p>
        <p class="tier__about"></p>
      </header>
      <ol class="levels"></ol>
      <p class="tier__letter${done(last.id) ? ' is-got' : ''}"><svg class="icon" aria-hidden="true"><use href="#i-mail"/></svg><span></span></p>`;
    $('.tier__name', sec).textContent = lv.name;
    $('.tier__about', sec).textContent = open
      ? `Раундов пройдено: ${passed} из ${rounds.length}`
      : `Откроется после письма из уровня ${lv.id - 1}`;
    $('.tier__letter span', sec).textContent = done(last.id) ? 'Письмо получено' : `Письмо — после раунда ${last.no}`;
    const list = $('.levels', sec);
    for (const l of rounds) {
      const can = DEV || save.isRoundOpen(l.id);
      const st = (d.levels[l.id] && d.levels[l.id].stars) || 0;
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'level';
      b.dataset.theme = l.theme;
      b.dataset.round = l.id;
      b.disabled = !can;
      b.setAttribute('aria-label', `Уровень ${l.level}, раунд ${l.no}. ${roundName(l)}. ${can ? `Звёзд: ${st} из 3` : 'Закрыт'}`);
      b.innerHTML = `
        <span class="level__art"><span>${l.no}</span>${can ? '' : '<svg class="icon" aria-hidden="true"><use href="#i-lock"/></svg>'}</span>
        <span class="level__body">
          <span class="level__name"></span>
          <span class="level__tag"></span>
          <span class="level__stars" aria-hidden="true">${[1, 2, 3].map((n) => `<svg class="icon${st >= n ? ' on' : ''}"><use href="#i-star"/></svg>`).join('')}</span>
        </span>`;
      $('.level__name', b).textContent = roundName(l);
      $('.level__tag', b).textContent = can ? l.tagline : l.no === 1 ? `Пройди уровень ${l.level - 1}` : `Пройди раунд ${l.no - 1}`;
      b.addEventListener('click', () => {
        sound.play('click');
        startRound(l.id);
      });
      li.appendChild(b);
      list.appendChild(li);
    }
    box.appendChild(sec);
  }
  $('#starTotal').textContent = `${save.totalStars()}/${ROUNDS.length * 3}`;
}

function roundName(l) {
  // у финалов название собирается из имени Насти, чтобы смена имени не оставила «Дорога к Насте» в коде
  if (l.theme === 'love') return `Дорога к ${CONFIG.her.dative}`;
  if (l.theme === 'dawn') return `Дорога к ${CONFIG.her.dative} · рассвет`;
  return l.name;
}

/** «Уровень 2 · раунд 3» — так раунд называется на всех экранах. */
const roundLabel = (r) => `Уровень ${r.level} · раунд ${r.no}`;

/** Письмо, которое приходит после этого раунда (или null). Письмо уровня — после его последнего раунда. */
function letterFor(id) {
  const r = ROUNDS[id - 1];
  return (r && r.finale && (CONFIG.letters || []).find((l) => l.level === r.level)) || null;
}

/** Подпись кнопки «дальше» после раунда: следующий раунд, следующий уровень или меню. */
function nextLabel(id) {
  const next = ROUNDS[id];
  if (!next) return 'В меню';
  return next.level !== ROUNDS[id - 1].level ? `Дальше · уровень ${next.level}` : `Дальше · раунд ${next.no}`;
}

/** Название мира для всплывающей подписи в бесконечном режиме. */
function worldName(theme) {
  const r = ROUNDS.find((x) => x.theme === theme);
  return r ? roundName(r) : THEMES[theme].name;
}

/** Миры бесконечного режима: первый уровень — всегда, второй — когда он открыт (чтобы не показывать его заранее). */
function endlessWorlds() {
  const open = DEV || save.isRoundOpen(ROUNDS_PER_LEVEL + 1);
  return ROUNDS.filter((r) => r.level === 1 || open).map((r) => r.theme);
}

function renderSkins() {
  const d = save.data;
  $$('[data-wallet]').forEach((e) => (e.textContent = d.hearts));
  const list = $('#skinList');
  list.innerHTML = '';
  for (const s of SKINS) {
    const owned = d.skins.includes(s.id);
    const on = d.skin === s.id;
    const li = document.createElement('li');
    li.className = 'skin' + (on ? ' is-on' : '') + (owned ? '' : ' is-locked');
    const img = document.createElement('img');
    img.src = s.src;
    img.alt = '';
    img.width = 88;
    img.height = 80;
    const name = document.createElement('span');
    name.className = 'skin__name';
    name.textContent = s.name;
    const hint = document.createElement('span');
    hint.className = 'skin__hint';
    hint.textContent = s.hint;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn--small ' + (on ? 'btn--gold' : owned ? 'btn--ghost' : d.hearts >= s.price ? '' : 'btn--ghost');
    if (on) {
      b.textContent = 'Надето';
      b.disabled = true;
    } else if (owned) {
      b.textContent = 'Надеть';
      b.addEventListener('click', async () => {
        save.set({ skin: s.id });
        await applySkin(s.id);
        sound.play('meow');
        renderSkins();
      });
    } else {
      b.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-heart"/></svg>${s.price}`;
      b.setAttribute('aria-label', `Купить «${s.name}» за ${s.price} сердечек`);
      if (d.hearts < s.price) {
        b.disabled = true;
        hint.textContent = `Не хватает ${s.price - d.hearts}`;
      }
      b.addEventListener('click', async () => {
        if (!save.spendHearts(s.price)) return sound.play('nope');
        save.unlockSkin(s.id);
        save.set({ skin: s.id });
        await applySkin(s.id);
        sound.play('buy');
        renderSkins();
      });
    }
    li.append(img, name, hint, b);
    list.appendChild(li);
  }
}

/* ---------- старт игры ---------- */

/** Кладёт в кошелёк сердечки, собранные в текущем полёте и ещё не учтённые.
    Вызывается при любом выходе из полёта — победа, проигрыш, «Заново», «В меню», закрытие вкладки, —
    поэтому собранное не пропадает, и ничего не засчитывается дважды. */
function bankHearts() {
  if (!sim || sim.attract) return;
  const fresh = sim.hearts - (sim.banked || 0);
  if (fresh > 0) save.addHearts(fresh);
  sim.banked = sim.hearts;
}

function startRound(id) {
  clearTimeout(pendingTimer);
  bankHearts();
  mode = 'story';
  roundId = id;
  const l = ROUNDS[id - 1];
  sim = new Sim({ mode: 'story', roundId: id, viewW: renderer.viewW, seed: (Date.now() % 1e9) + id });
  renderer.particles.length = 0;
  renderer.finishLabel = l.finale ? CONFIG.her.name : ''; // у большого сердца в конце каждого уровня — её имя
  sound.setTheme(l.theme);
  // «Уровень 2 · раунд 10 из 10 · ворот: 44»: на узком экране строка переносится только между частями.
  // «ворот: 22» верно при любом числе, «22 ворот» — нет.
  const eyebrow = $('#introEyebrow');
  eyebrow.textContent = '';
  [`${roundLabel(l)} из ${ROUNDS_PER_LEVEL}`, `ворот: ${l.gates}`].forEach((part, i) => {
    if (i) eyebrow.append(' · ');
    const span = document.createElement('span');
    span.className = 'nowrap';
    span.textContent = part;
    eyebrow.append(span);
  });
  $('#introName').textContent = roundName(l);
  $('#introStory').textContent = l.story;
  $('#introTip').textContent = l.tip || ''; // подсказка живёт в самом раунде (levels.js), а не привязана к номеру
  resetHud();
  go('intro');
}

function startEndless() {
  clearTimeout(pendingTimer);
  bankHearts();
  mode = 'endless';
  sim = new Sim({ mode: 'endless', viewW: renderer.viewW, seed: Date.now() % 1e9, worlds: endlessWorlds() });
  renderer.particles.length = 0;
  renderer.finishLabel = '';
  sound.setTheme(sim.theme);
  resetHud();
  beginPlay();
}

function beginPlay() {
  save.set({ plays: save.data.plays + 1 });
  sound.unlock();
  musicStarted = true;
  go('play');
  $('#hint').hidden = false;
}

function restart() {
  if (mode === 'endless') startEndless();
  else {
    startRound(roundId);
    beginPlay();
  }
}

/* ---------- HUD ---------- */

function resetHud() {
  Object.keys(hud).forEach((k) => delete hud[k]);
  const lives = $('#hudLives');
  lives.innerHTML = '';
  lives.hidden = sim.maxLives <= 1;
  for (let i = 0; i < sim.maxLives; i++) lives.insertAdjacentHTML('beforeend', '<svg class="icon" aria-hidden="true"><use href="#i-heart"/></svg>');
  $('#hudTrack').hidden = mode !== 'story';
  $('#hudScore').hidden = mode !== 'endless';
  $('#hudPowers').innerHTML = '';
  updateHud();
}

/** Запоминает, где на экране счётчик сердечек: собранные сердечки летят к нему. */
function aimHearts() {
  const icon = $('.hud__hearts .icon');
  const r = icon && icon.getBoundingClientRect();
  if (!r || !r.width) return (renderer.hudHeart = null);
  const c = canvas.getBoundingClientRect();
  renderer.hudHeart = renderer.toWorld(r.left + r.width / 2 - c.left, r.top + r.height / 2 - c.top);
}

function updateHud() {
  if (!sim) return;
  if (hud.lives !== sim.lives) {
    hud.lives = sim.lives;
    $$('#hudLives .icon').forEach((el, i) => el.classList.toggle('off', i >= sim.lives));
  }
  if (hud.hearts !== sim.hearts) {
    hud.hearts = sim.hearts;
    $('#hudHearts').textContent = sim.hearts;
    const chip = $('.hud__hearts');
    chip.classList.remove('bump');
    void chip.offsetWidth;
    chip.classList.add('bump');
  }
  if (mode === 'story') {
    const p = Math.round(sim.progress * 100);
    if (hud.p !== p) {
      hud.p = p;
      $('#hudBar').style.width = p + '%';
    }
  } else if (hud.score !== sim.passed) {
    hud.score = sim.passed;
    $('#hudScore').textContent = sim.passed;
  }
  // бонусы
  const key = (sim.shield ? 's' : '') + (sim.magnet > 0 ? 'm' : '') + (sim.catnip > 0 ? 'c' : '');
  const box = $('#hudPowers');
  if (hud.pk !== key) {
    hud.pk = key;
    box.innerHTML = '';
    if (sim.shield) box.insertAdjacentHTML('beforeend', `<span class="power" style="--c:${POWERUPS.shield.color}">Пузырь<i style="width:100%"></i></span>`);
    if (sim.magnet > 0) box.insertAdjacentHTML('beforeend', `<span class="power" data-k="magnet" style="--c:${POWERUPS.magnet.color}">Магнит<i></i></span>`);
    if (sim.catnip > 0) box.insertAdjacentHTML('beforeend', `<span class="power" data-k="catnip" style="--c:${POWERUPS.catnip.color}">Мята<i></i></span>`);
  }
  for (const k of ['magnet', 'catnip']) {
    if (sim[k] > 0) {
      const el = $(`.power[data-k="${k}"] i`, box);
      if (el) el.style.width = Math.round((sim[k] / POWERUPS[k].time) * 100) + '%';
    }
  }
}

function toast(text) {
  const t = $('#toast');
  t.hidden = true;
  void t.offsetWidth;
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 1900);
}

/* ---------- события симуляции ---------- */

const HIT_SOUND = { bubble: 'pop2', bun: 'crumble', soldier: 'clank', ember: 'fizz', lightning: 'thunder' };

function onEvent(ev) {
  switch (ev.type) {
    case 'start':
      $('#hint').hidden = true;
      break;
    case 'flap':
      sound.play('flap');
      break;
    case 'heart':
      sound.play('heart', { streak: ev.streak });
      break;
    case 'streak':
      sound.play('streak');
      buzz(20);
      break;
    case 'streakEnd':
      sound.play('streakEnd');
      break;
    case 'near':
      sound.play('near');
      break;
    case 'fish':
      sound.play('fish');
      break;
    case 'pop':
      sound.play(ev.kind === 'yarn' ? 'yarn' : 'pop');
      break;
    case 'croak':
      sound.play('croak');
      break;
    case 'splash':
      // капли падают часто и беззвучно; слышно только лягушонка
      if (ev.kind === 'frog') sound.play('plop');
      break;
    case 'clear':
      // дождь кончился: перелив и музыка светлеет
      sound.play('clear');
      sound.setTheme('rainbow');
      buzz(20);
      break;
    case 'power':
      sound.play('power');
      break;
    case 'powerEnd':
      sound.play('powerEnd');
      break;
    case 'shieldBreak':
      sound.play('shield');
      buzz(30);
      hitStop = 0.05;
      break;
    case 'gate':
      sound.play('gate');
      break;
    case 'warn':
      // молния сначала потрескивает, гром — когда ударит
      sound.play(ev.kind === 'bat' ? 'squeak' : ev.kind === 'lightning' ? 'fizz' : 'warn');
      break;
    case 'suck':
      // робот-пылесос включил тягу
      sound.play('buzz');
      break;
    case 'steam':
      sound.play('whistle');
      break;
    case 'coo':
      sound.play('coo');
      break;
    case 'lightning':
      sound.play('thunder');
      buzz(40);
      break;
    case 'windWarn':
      // ветер предупреждает заранее: короткий свист, пока игра ещё управляема
      sound.play('windwarn');
      break;
    case 'wind':
      sound.play('wind');
      break;
    case 'hit':
      sound.play('hit');
      // у опасностей второго уровня — свой призвук поверх общего удара
      if (HIT_SOUND[ev.cause]) sound.play(HIT_SOUND[ev.cause]);
      buzz(ev.lives > 0 ? 60 : [80, 40, 120]);
      hitStop = ev.lives > 0 ? 0.08 : 0.13;
      break;
    case 'theme':
      sound.setTheme(ev.theme);
      toast(worldName(ev.theme));
      break;
    case 'win':
      sound.play('win');
      buzz([30, 40, 30, 40, 80]);
      if (!calm) timeScale = 0.3; // миг победы тянется чуть дольше
      pendingTimer = setTimeout(showWin, 1500);
      break;
    case 'lose':
      sound.play('lose');
      pendingTimer = setTimeout(mode === 'endless' ? showOver : showLose, 350);
      break;
  }
}

function buzz(pattern) {
  if (navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      /* не страшно */
    }
  }
}

/* ---------- итоги ---------- */

function showWin() {
  const stars = sim.stars();
  const l = ROUNDS[roundId - 1];
  const bonus = stars * 5;
  const earned = sim.hearts + bonus;
  save.completeRound(roundId, stars, sim.pathHearts);
  bankHearts();
  save.addHearts(bonus);

  $('#winEyebrow').textContent = l.finale ? `Уровень ${l.level} пройден · ${roundName(l)}` : `${roundLabel(l)} · ${roundName(l)}`;
  const icons = $$('#winStars .icon');
  icons.forEach((el) => el.classList.remove('on'));
  // порядок появления: левая, правая, центральная
  [0, 2, 1].slice(0, stars).forEach((idx, i) => {
    setTimeout(() => {
      if (screen !== 'win') return;
      icons[idx].classList.add('on');
      sound.play('star');
    }, 250 + i * 320);
  });
  const ratio = sim.heartsTotal ? Math.round((sim.pathHearts / sim.heartsTotal) * 100) : 100;
  const goals = [
    [true, 'Долетела до финиша'],
    [ratio >= 70, `Собрала ${ratio}% сердечек (нужно 70%)`],
    [sim.lostLives === 0, sim.lostLives === 0 ? 'Не потеряла ни одной жизни' : `Потеряно жизней: ${sim.lostLives}`],
  ];
  $('#winGoals').innerHTML = goals.map(([ok, text]) => `<li class="${ok ? 'done' : ''}"><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>${text}</li>`).join('');
  $('#winHearts').textContent = `+${earned}`;
  $('#winStars').setAttribute('aria-label', `Звёзд: ${stars} из 3`);

  // Первое прохождение ведёт к записке (а после последнего раунда уровня — ещё и к письму).
  // Если всё уже прочитано — можно сразу лететь дальше.
  const letter = letterFor(roundId);
  const hasNote = CONFIG.notes.some((n) => n.round === roundId);
  const seen = save.data.seenNotes.includes(roundId);
  const btnNote = $('#btnNote');
  const btnNext = $('#btnWinNext');
  btnNote.hidden = !hasNote && !letter;
  btnNote.className = seen ? 'btn btn--ghost btn--small' : 'btn';
  $('#btnNoteLabel').textContent = `${seen ? 'Перечитать' : 'Открыть'} ${letter ? 'записку и письмо' : 'записку'}`;
  btnNext.hidden = (hasNote || !!letter) && !seen;
  btnNext.textContent = nextLabel(roundId);
  $('#btnWinRetry').hidden = stars >= 3;
  go('win');
}

/** Тема музыки для открытого письма: у каждого письма своя. */
function letterTheme(id) {
  const r = ROUNDS[id - 1];
  return r && r.level > 1 ? 'email' : 'letter'; // имена тем — из audio.js (ROOTS/STYLE), а не выдуманные
}

/** Наполняет листок записки или письма. Строки появляются одна за другой. */
function fillSheet({ no, title, text, sign, slow, photoId }) {
  $('#noteNo').textContent = no;
  $('#noteTitle').textContent = title;
  const box = $('#noteText');
  box.innerHTML = '';
  text.split(/\n\s*\n/).forEach((par) => {
    const p = document.createElement('p');
    p.textContent = par.trim();
    box.appendChild(p);
  });
  setSignature($('#noteSign'), sign);
  fillPhoto(photoId);
  const sheet = $('#letter');
  sheet.style.setProperty('--gap', slow ? '0.55s' : '0.16s');
  $$('#noteNo, #noteTitle, #noteText p, #notePhoto, #noteSign').forEach((el, i) => el.style.setProperty('--i', i));
}

/**
 * Экран записки. После каждого раунда — записка от Мии.
 * После последнего раунда уровня ступеней две: сначала записка, потом запечатанный конверт с письмом.
 * Письмо не открывается само: его нужно распечатать, как настоящий конверт.
 */
function showNote(stage = 'note') {
  const letter = letterFor(roundId);
  const note = CONFIG.notes.find((n) => n.round === roundId);
  const envelope = $('#envelope');
  const sheet = $('#letter');
  const actions = $('#noteActions');

  if (stage === 'letter' || !note) {
    if (!letter) return nextAfterWin();
    // Конверт: письмо откроется по нажатию.
    const letters = CONFIG.letters || [];
    fillSheet({
      no: letters.length > 1 ? `Письмо № ${letters.indexOf(letter) + 1} из ${letters.length}` : 'Письмо',
      title: letter.title,
      text: letter.text,
      sign: CONFIG.from,
      slow: true,
      photoId: roundId, // к письму приклеено то же фото, что и к записке этого раунда
    });
    $('#btnNoteNext').textContent = nextLabel(roundId);
    afterNote = nextAfterWin;
    go('note');
    envelope.classList.remove('is-open');
    envelope.hidden = false;
    envelope.disabled = false;
    $('#envelopeHint').hidden = false;
    sheet.hidden = true;
    actions.hidden = true;
    renderer.fest = true;
    if (matchMedia('(hover: hover)').matches) envelope.focus({ preventScroll: true });
    return;
  }

  // Записка раунда.
  fillSheet({
    no: `Записка № ${roundId} из ${CONFIG.notes.length}`,
    title: note.title,
    text: note.text,
    sign: `— ${note.from || CONFIG.cat.name}`,
    slow: false,
    photoId: roundId,
  });
  envelope.hidden = true;
  $('#envelopeHint').hidden = true;
  sheet.hidden = false;
  actions.hidden = false;
  renderer.fest = false;
  if (letter) {
    // последний раунд уровня: записка — только первая ступень, «прочитано» ставится, когда вскрыт конверт
    $('#btnNoteNext').textContent = 'Распечатать письмо';
    afterNote = () => showNote('letter');
  } else {
    $('#btnNoteNext').textContent = nextLabel(roundId);
    afterNote = nextAfterWin;
    save.markNoteSeen(roundId);
  }
  go('note');
  sound.play('paper');
  revealLetter();
}

function fillPhoto(id) {
  const fig = $('#notePhoto');
  const ph = (CONFIG.photos || {})[id];
  fig.hidden = !ph;
  fig.textContent = '';
  if (!ph) return;
  const img = document.createElement('img');
  img.src = `assets/img/gallery/${ph.file}-thumb.webp`;
  img.alt = ph.alt || '';
  img.width = 640;
  img.height = 853;
  img.decoding = 'async';
  if (ph.pos) img.style.objectPosition = ph.pos; // какую часть снимка показать в рамке
  const cap = document.createElement('figcaption');
  cap.textContent = ph.caption || '';
  fig.append(img, cap);
}

function revealLetter() {
  const letter = $('#letter');
  $('#envelope').hidden = true;
  $('#envelopeHint').hidden = true;
  letter.hidden = false;
  letter.classList.remove('letter--reveal');
  void letter.offsetWidth;
  letter.classList.add('letter--reveal');
  $('#noteActions').hidden = false;
  // читать начинают сверху. Не scrollIntoView: в первый миг анимации листок сдвинут, и прокрутка промахивается
  letter.parentElement.scrollTop = 0;
}

function openEnvelope() {
  const env = $('#envelope');
  if (env.hidden || env.disabled) return;
  env.disabled = true;
  save.markNoteSeen(roundId); // конверт вскрыт — записка и письмо этого раунда прочитаны
  $('#envelopeHint').hidden = true;
  sound.unlock();
  sound.play('seal');
  sound.play('envelope');
  buzz([20, 60, 20]);
  // музыка письма — тихая и медленная; играет, пока письмо открыто
  if (musicStarted) sound.setTheme(letterTheme(roundId));
  env.classList.add('is-open');
  clearTimeout(envelopeTimer);
  envelopeTimer = setTimeout(
    () => {
      if (screen !== 'note') return;
      sound.play('paper');
      revealLetter();
      const b = $('#btnNoteNext');
      if (matchMedia('(hover: hover)').matches) b.focus({ preventScroll: true });
    },
    calm ? 0 : 1250
  );
}

/** Уходим с экрана записки: гасим праздник и возвращаем музыку раунда. */
function closeLetter() {
  clearTimeout(envelopeTimer);
  if (renderer.fest) {
    renderer.fest = false;
    if (sim) sound.setTheme(sim.theme);
  }
}

function nextAfterWin() {
  if (roundId < ROUNDS.length) startRound(roundId + 1);
  else go('menu');
}

function showLose() {
  const l = ROUNDS[roundId - 1];
  bankHearts();
  $('#loseEyebrow').textContent = `${roundLabel(l)} · ${roundName(l)}`;
  $('#loseText').textContent = LOSE_LINES[Math.floor(Math.random() * LOSE_LINES.length)];
  const p = Math.round(sim.progress * 100);
  $('#loseBar').style.width = '0%';
  $('#loseProgress').textContent = `Пройдено ${p}%`;
  $('#loseHearts').textContent = `+${sim.hearts}`;
  go('lose');
  requestAnimationFrame(() => ($('#loseBar').style.width = p + '%'));
}

function showOver() {
  const d = save.data;
  const isNew = sim.passed > d.best;
  if (isNew) save.set({ best: sim.passed });
  bankHearts();
  $('#overScore').textContent = sim.passed;
  $('#overBest').textContent = save.data.best;
  $('#overNew').hidden = !isNew || sim.passed === 0;
  $('#overHearts').textContent = `+${sim.hearts}`;
  go('over');
}

/* ---------- пауза ---------- */

function pause() {
  if (screen !== 'play' || !sim || sim.status === 'won' || sim.status === 'lost' || sim.status === 'dying') return;
  syncToggles();
  go('pause');
}
function resume() {
  if (screen !== 'pause') return;
  sound.unlock();
  go('play');
  $('#hint').hidden = sim.status !== 'ready';
  last = performance.now();
}
function syncToggles() {
  const d = save.data;
  $('#tglSound').setAttribute('aria-pressed', String(d.sound));
  $('#tglMusic').setAttribute('aria-pressed', String(d.music));
  // кнопка в меню выключает и включает всё сразу
  const anyOn = d.sound || d.music;
  const mute = $('#btnMute');
  mute.setAttribute('aria-pressed', String(!anyOn));
  mute.setAttribute('aria-label', anyOn ? 'Выключить звук' : 'Включить звук');
  $('use', mute).setAttribute('href', anyOn ? '#i-sound' : '#i-mute');
}

/* ---------- ввод ---------- */

function flap() {
  if (screen !== 'play' || !sim) return;
  sound.unlock();
  sim.flap();
}

function bind() {
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  stage.addEventListener('pointerdown', (e) => {
    sound.unlock();
    if (screen === 'menu' && sim && sim.attract && !e.target.closest('button, a')) {
      // тап по Мии в меню: она отзывается
      const c = canvas.getBoundingClientRect();
      const p = renderer.toWorld(e.clientX - c.left, e.clientY - c.top);
      if (Math.hypot(p.x - sim.miaX, p.y - sim.mia.y) < 78) pokeMia();
      return;
    }
    if (screen !== 'play') return;
    if (e.target.closest('button, a')) return;
    e.preventDefault();
    flap();
  });
  // не даём странице прокручиваться и масштабироваться во время игры
  stage.addEventListener('touchmove', (e) => { if (screen === 'play') e.preventDefault(); }, { passive: false });
  stage.addEventListener('contextmenu', (e) => e.preventDefault());
  // iOS: щипок двумя пальцами не должен увеличивать игру
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  // Браузеры включают звук только из «настоящего» жеста (отпускание пальца, клик, клавиша).
  // После сворачивания вкладки звук засыпает — будим его при первом же касании.
  for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
    window.addEventListener(type, () => sound.unlock(), { capture: true, passive: true });
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const flapKey = e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW';
    if (screen === 'play') {
      if (flapKey) {
        e.preventDefault();
        flap();
      } else if (e.code === 'Escape' || e.code === 'KeyP') pause();
    } else if (screen === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) resume();
    else if (screen === 'intro' && flapKey && !e.target.closest('button, a')) {
      e.preventDefault();
      sound.play('click');
      beginPlay();
    }
  });

  // вкладку закрыли посреди полёта — собранные сердечки всё равно остаются
  window.addEventListener('pagehide', bankHearts);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (screen === 'play') pause();
      bankHearts();
      sound.stopMusic();
      sound.sleep();
      keepAwake(false);
    } else {
      sound.wake();
      if (screen === 'play') keepAwake(true);
      if (musicStarted && screen !== 'pause') sound.startMusic();
      last = performance.now();
    }
  });

  $$('[data-go]').forEach((b) =>
    b.addEventListener('click', () => {
      sound.play('click');
      go(b.dataset.go);
    })
  );
  $('#btnPlay').addEventListener('click', () => {
    sound.unlock();
    sound.play('click');
    const allDone = ROUNDS.every((l) => save.data.levels[l.id] && save.data.levels[l.id].done);
    if (allDone) go('levels');
    else startRound(save.nextRound(ROUNDS.length));
  });
  $('#btnLevels').addEventListener('click', () => { sound.unlock(); sound.play('click'); go('levels'); });
  $('#btnWardrobe').addEventListener('click', () => { sound.unlock(); sound.play('click'); go('wardrobe'); });
  $('#btnEndless').addEventListener('click', () => {
    sound.unlock();
    if ($('#btnEndless').getAttribute('aria-disabled') === 'true') {
      sound.play('nope');
      return toast('Сначала уровень 1');
    }
    sound.play('click');
    startEndless();
  });
  $('#btnGo').addEventListener('click', () => { sound.unlock(); sound.play('click'); beginPlay(); });
  $('#btnPause').addEventListener('click', pause);
  $('#btnResume').addEventListener('click', () => { sound.play('click'); resume(); });
  $('#btnRestart').addEventListener('click', () => { sound.play('click'); restart(); });
  $('#btnRetry').addEventListener('click', () => { sound.play('click'); restart(); });
  $('#btnWinRetry').addEventListener('click', () => { sound.play('click'); restart(); });
  $('#btnAgain').addEventListener('click', () => { sound.play('click'); restart(); });
  // не передавать showNote напрямую: первым аргументом придёт Event и сломает выбор ступени финала
  $('#btnNote').addEventListener('click', () => showNote());
  $('#envelope').addEventListener('click', openEnvelope);
  $('#btnWinNext').addEventListener('click', () => { sound.play('click'); nextAfterWin(); });
  $('#btnMute').addEventListener('click', () => {
    const on = !(save.data.sound || save.data.music);
    save.set({ sound: on, music: on });
    sound.setSound(on);
    sound.setMusic(on);
    if (on && musicStarted) sound.startMusic();
    syncToggles();
    sound.play('click');
  });
  $('#btnNoteNext').addEventListener('click', () => { sound.play('click'); (afterNote || nextAfterWin)(); });
  $('#tglSound').addEventListener('click', () => {
    const on = !save.data.sound;
    save.set({ sound: on });
    sound.setSound(on);
    syncToggles();
    sound.play('click');
  });
  $('#tglMusic').addEventListener('click', () => {
    const on = !save.data.music;
    save.set({ music: on });
    sound.setMusic(on);
    syncToggles();
    sound.play('click');
  });
}

function resize() {
  const w = renderer.resize();
  hideBubble();
  if (screen === 'play' || screen === 'pause') aimHearts();
  if (!sim) return;
  if (sim.attract) {
    placeMenuMia();
  } else if (sim.status === 'ready') {
    // до старта можно безболезненно пересоздать уровень под новый размер
    const keep = { mode: sim.mode, roundId: sim.round ? sim.round.id : 1 };
    sim = new Sim({ ...keep, viewW: w, seed: Date.now() % 1e9 });
  } else sim.viewW = w;
}

/* ---------- цикл ---------- */

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (frozen) return;
  if (dt > 0.1) dt = 0.1; // вкладка была в фоне — не «прыгаем»
  // Метка времени кадра бывает чуть раньше, чем момент снятия с паузы: время назад не идёт.
  if (dt < 0) dt = 0;
  if (!sim) return;

  const running = screen !== 'pause';
  let viewDt = dt;
  if (running) {
    if (hitStop > 0) {
      // стоп-кадр: мир стоит, а вспышка и тряска продолжаются
      hitStop -= dt;
    } else {
      acc += dt * timeScale;
      viewDt = dt * timeScale;
    }
    if (timeScale < 1) timeScale = Math.min(1, timeScale + dt * 0.9);
    if (sim.attract) {
      // в меню Мия время от времени взмахивает крыльями
      attractT -= dt;
      if (attractT <= 0) {
        attractT = 0.85 + Math.random() * 0.5;
        renderer.wingT = 0;
      }
    } else if (screen === 'play') {
      // музыка «раскрывается» к финишу и с длинной серией сердечек
      const base = mode === 'story' ? sim.progress * 0.8 : Math.min(0.8, sim.passed / 40);
      sound.setMood({ intensity: base + Math.min(0.3, sim.streak * 0.02), danger: mode === 'story' && sim.lives === 1 && sim.status === 'playing', boost: sim.catnip > 0 });
    }
    while (acc >= STEP) {
      sim.step(STEP);
      acc -= STEP;
      if (sim.events.length) {
        for (const ev of sim.events) {
          renderer.handle(ev, sim);
          onEvent(ev);
        }
        sim.events.length = 0;
      }
    }
    if (screen === 'play') updateHud();
  }
  renderer.draw(sim, running ? viewDt : 0);
}

// крючки для отладки и автотестов
window.__fk = {
  get sim() { return sim; },
  get screen() { return screen; },
  go, startRound, startEndless, beginPlay, showWin, showNote, save, renderer, sound,
  freeze(v = true) { frozen = v; },
};

// Игра по сети не ходит, но после первого открытия должна запускаться и без связи (метро, самолёт).
// На компьютере разработчика включается адресом play.html?sw=1.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || params.has('sw'))) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

boot().catch((e) => {
  console.error(e);
  const p = $('.loading');
  if (p) p.textContent = 'Не получилось загрузить игру. Обнови страницу.';
});
