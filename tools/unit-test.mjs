/* Проверки логики игры без браузера: симуляция, сохранение, настройки.
   Запуск: npm run test:unit (входит в npm test). Зависимости не нужны. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// storage.js работает с localStorage — в Node подставляем простую замену.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const { Sim } = await import('../assets/js/game/sim.js');
const { LEVELS, SKINS, POWERUPS, WORLD, endlessParams } = await import('../assets/js/game/levels.js');
const { THEMES } = await import('../assets/js/game/themes.js');
const { CONFIG, isBirthday } = await import('../assets/js/config.js');

let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failures.push(`✗ ${name}\n    ${String(e.message).split('\n').join('\n    ')}`);
  }
}

const DT = 1 / 120;
/** Автопилот: держится центра ближайшего просвета. */
function fly(sim, { maxT = 300, onStep } = {}) {
  sim.flap();
  let i = 0;
  while (sim.status !== 'won' && sim.status !== 'lost' && sim.t < maxT) {
    if (i % 15 === 0) {
      const wx = sim.dist + sim.miaX;
      const g = sim.gates.find((x) => x.x + x.w > wx - WORLD.RADIUS);
      const target = g ? g.gapY + 22 : 330;
      if (sim.mia.y + sim.mia.vy * 0.07 > target) sim.flap();
    }
    sim.step(DT);
    if (onStep) onStep(sim);
    sim.events.length = 0;
    i++;
  }
  return sim;
}

/* ---------- уровни и оформление ---------- */

test('уровни идут по порядку и ссылаются на существующие темы', () => {
  LEVELS.forEach((l, i) => {
    assert.equal(l.id, i + 1, `id уровня №${i + 1}`);
    assert.ok(THEMES[l.theme], `нет темы «${l.theme}» для уровня ${l.id}`);
    for (const key of ['sky', 'far', 'ground', 'column']) assert.equal(typeof THEMES[l.theme][key], 'function', `${l.theme}.${key}`);
    assert.ok(l.name && l.tagline && l.story, `у уровня ${l.id} нет названия или описания`);
    assert.ok(l.gates >= 5 && l.gap >= 150 && l.speed > 0 && l.spacing >= 250, `странные параметры уровня ${l.id}`);
    for (const p of l.powerups) assert.ok(POWERUPS[p], `неизвестный бонус «${p}»`);
    for (const h of l.hazards) assert.ok(['drop', 'balloon', 'cucumber', 'wind'].includes(h), `неизвестная опасность «${h}»`);
  });
});

test('бесконечный режим использует только существующие темы', () => {
  for (let n = 0; n < 200; n++) {
    const p = endlessParams(n);
    assert.ok(THEMES[p.theme], `нет темы «${p.theme}»`);
    assert.ok(p.gap >= 150, 'просвет слишком узкий');
  }
});

test('картинки обликов лежат на месте, первый облик бесплатный', () => {
  assert.equal(SKINS[0].price, 0);
  const ids = new Set();
  for (const s of SKINS) {
    assert.ok(!ids.has(s.id), `повтор id облика «${s.id}»`);
    ids.add(s.id);
    assert.ok(fs.existsSync(path.join(ROOT, s.src)), `нет файла ${s.src}`);
  }
});

test('серия сердечек: премия каждые десять подряд, пропуск и удар обнуляют серию', () => {
  const sim = new Sim({ levelId: 1, viewW: 380, seed: 5 });
  sim.flap();
  for (let i = 1; i <= 10; i++) sim.collect({ type: 'heart', x: 0, y: 0 });
  assert.equal(sim.streak, 10);
  assert.equal(sim.pathHearts, 10, 'премия не считается собранным сердечком — на звёзды она не влияет');
  assert.equal(sim.hearts, 12, 'десять сердечек подряд дают +2');
  assert.equal(sim.events.filter((e) => e.type === 'streak').length, 1);
  assert.deepEqual(sim.events.filter((e) => e.type === 'heart').map((e) => e.streak), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  sim.hit('test');
  assert.equal(sim.streak, 0, 'удар обнуляет серию');
  assert.equal(sim.bestStreak, 10);
  assert.equal(sim.events.filter((e) => e.type === 'streakEnd').length, 1);
});

test('пропущенное сердечко обнуляет серию, пролёт впритирку — только событие', () => {
  for (const l of LEVELS) {
    const sim = new Sim({ levelId: l.id, viewW: 380, seed: 99 });
    let near = 0;
    let maxStreak = 0;
    const flown = fly(sim, {
      onStep(s) {
        near += s.events.filter((e) => e.type === 'near').length;
        maxStreak = Math.max(maxStreak, s.streak);
        s.events.length = 0;
      },
    });
    assert.equal(near, flown.nearMisses, `уровень ${l.id}: счётчик пролётов впритирку расходится с событиями`);
    assert.equal(maxStreak, flown.bestStreak);
    assert.ok(flown.bestStreak <= flown.pathHearts);
    // премии за серии — единственное, чем кошелёк отличается от собранного: рыбки и шарики считаются отдельно
    assert.ok(flown.hearts >= flown.pathHearts);
  }
  // сердечко осталось позади — серия прерывается
  const sim = new Sim({ levelId: 1, viewW: 380, seed: 3 });
  sim.flap();
  sim.streak = 6;
  sim.items = [{ type: 'heart', x: sim.dist + sim.miaX - 200, y: 100 }];
  sim.step(1 / 120);
  assert.equal(sim.streak, 0);
  assert.ok(sim.events.some((e) => e.type === 'streakEnd'));
});

/* ---------- настройки ---------- */

test('config.js: реплики Мии и фото к запискам указывают на существующие файлы', () => {
  assert.ok(Array.isArray(CONFIG.miaLines), 'miaLines должен быть списком (можно пустым)');
  for (const line of CONFIG.miaLines) assert.ok(typeof line === 'string' && line.trim() && line.length <= 44, `реплика не помещается в облачко: «${line}»`);
  for (const [id, ph] of Object.entries(CONFIG.photos || {})) {
    assert.ok(+id >= 1 && +id <= LEVELS.length, `фото привязано к несуществующему уровню ${id}`);
    assert.ok(fs.existsSync(path.join(ROOT, `assets/img/gallery/${ph.file}-thumb.webp`)), `нет файла assets/img/gallery/${ph.file}-thumb.webp`);
    assert.ok(ph.caption && ph.alt, `фото уровня ${id}: нужны подпись и описание`);
  }
});

test('config.js: записка есть для каждого уровня, письмо — для последнего', () => {
  for (let id = 1; id < LEVELS.length; id++) {
    const note = CONFIG.notes.find((n) => n.level === id);
    assert.ok(note, `нет записки для уровня ${id}`);
    assert.ok(note.title.trim() && note.text.trim(), `пустая записка уровня ${id}`);
  }
  assert.equal(CONFIG.finalLetter.level, LEVELS.length, 'письмо должно открываться после последнего уровня');
  assert.ok(CONFIG.finalLetter.title.trim() && CONFIG.finalLetter.text.trim(), 'пустое письмо');
  for (const n of CONFIG.notes) assert.ok(n.level >= 1 && n.level < LEVELS.length, `записка привязана к несуществующему уровню ${n.level}`);
  assert.ok(CONFIG.her.name && CONFIG.her.sweet && CONFIG.her.dative && CONFIG.cat.name && CONFIG.from);
});

test('config.js: день рождения — настоящая дата, режим включается только в этот день', () => {
  const b = CONFIG.birthday;
  assert.ok(b.month >= 1 && b.month <= 12 && b.day >= 1 && b.day <= 31);
  assert.equal(isBirthday(new Date(2027, b.month - 1, b.day, 12)), !!b.enabled);
  assert.equal(isBirthday(new Date(2027, b.month % 12, b.day === 1 ? 2 : 1, 12)), false);
});

/* ---------- симуляция ---------- */

test('одинаковое зерно даёт одинаковый уровень', () => {
  const a = new Sim({ levelId: 3, viewW: 380, seed: 42 });
  const b = new Sim({ levelId: 3, viewW: 380, seed: 42 });
  assert.deepEqual(a.gates.map((g) => [g.x, g.baseY]), b.gates.map((g) => [g.x, g.baseY]));
});

test('просветы всегда в пределах экрана и достижимы от предыдущих', () => {
  for (const l of LEVELS) {
    for (let seed = 1; seed <= 25; seed++) {
      const sim = new Sim({ levelId: l.id, viewW: 4000 + l.gates * l.spacing, seed });
      assert.equal(sim.gates.length, l.gates, `уровень ${l.id}: число ворот`);
      let prev = null;
      for (const g of sim.gates) {
        assert.ok(g.baseY - g.amp - g.gap / 2 >= 40, `уровень ${l.id}: просвет упирается в потолок`);
        assert.ok(g.baseY + g.amp + g.gap / 2 <= WORLD.GROUND - 40, `уровень ${l.id}: просвет упирается в пол`);
        if (prev) assert.ok(Math.abs(g.baseY - prev.baseY) <= 185.001, `уровень ${l.id}: слишком резкий перепад между воротами`);
        prev = g;
      }
    }
  }
});

test('каждый уровень проходится автопилотом, прогресс растёт от 0 до 1 без скачков', () => {
  for (const l of LEVELS) {
    let won = 0;
    for (let seed = 1; seed <= 12; seed++) {
      let last = 0;
      const sim = fly(new Sim({ levelId: l.id, viewW: 380, seed: seed * 7919 }), {
        onStep(s) {
          const p = s.progress;
          assert.ok(p >= last - 1e-9, `уровень ${l.id}: прогресс пошёл назад`);
          assert.ok(p - last < 0.02, `уровень ${l.id}: прогресс прыгнул с ${last.toFixed(3)} до ${p.toFixed(3)}`);
          last = p;
        },
      });
      if (sim.status === 'won') {
        won++;
        assert.ok(sim.progress > 0.999, `уровень ${l.id}: на финише прогресс ${sim.progress}`);
        assert.equal(sim.passed, l.gates, `уровень ${l.id}: пройдено ворот`);
        assert.ok(sim.stars() >= 1 && sim.stars() <= 3);
        assert.ok(sim.pathHearts <= sim.heartsTotal);
      }
    }
    assert.ok(won >= 7, `уровень ${l.id}: автопилот прошёл только ${won} из 12`);
  }
});

test('без взмахов Мия теряет три жизни и проигрывает', () => {
  const sim = new Sim({ levelId: 1, viewW: 380, seed: 5 });
  const hits = [];
  sim.flap();
  for (let i = 0; i < 120 * 30 && sim.status !== 'lost'; i++) {
    sim.step(DT);
    for (const e of sim.events) if (e.type === 'hit') hits.push(e.lives);
    sim.events.length = 0;
  }
  assert.equal(sim.status, 'lost');
  assert.deepEqual(hits, [2, 1, 0]);
  assert.equal(sim.lives, 0);
  assert.equal(sim.stars(), 0);
});

test('пузырь спасает от одного удара и не отнимает жизнь', () => {
  const sim = new Sim({ levelId: 1, viewW: 380, seed: 5 });
  sim.flap();
  sim.shield = true;
  sim.hit('test');
  assert.equal(sim.shield, false);
  assert.equal(sim.lives, 3);
  assert.equal(sim.lostLives, 0);
  assert.ok(sim.inv > 0, 'после пузыря должна быть короткая неуязвимость');
});

test('в бесконечном режиме одна жизнь, уровень не кончается', () => {
  const sim = new Sim({ mode: 'endless', viewW: 380, seed: 9 });
  assert.equal(sim.maxLives, 1);
  assert.equal(sim.progress, 0);
  fly(sim, { maxT: 40 });
  assert.notEqual(sim.status, 'won');
  assert.equal(sim.finishX, null);
});

test('звёзды: 1 — долетела, 2 — 70% сердечек, 3 — ещё и без потерь', () => {
  const sim = new Sim({ levelId: 1, viewW: 380, seed: 1 });
  sim.status = 'won';
  sim.heartsTotal = 10;
  sim.pathHearts = 6;
  assert.equal(sim.stars(), 1);
  sim.pathHearts = 7;
  assert.equal(sim.stars(), 3);
  sim.lostLives = 1;
  assert.equal(sim.stars(), 2);
});

/* ---------- сохранение ---------- */

const { save } = await import('../assets/js/storage.js');

test('сохранение: уровни открываются по очереди', () => {
  save.reset();
  assert.equal(save.isLevelOpen(1), true);
  assert.equal(save.isLevelOpen(2), false);
  assert.equal(save.nextLevel(6), 1);
  assert.equal(save.completeLevel(1, 2, 20), true, 'первое прохождение');
  assert.equal(save.completeLevel(1, 1, 5), false, 'повторное прохождение');
  assert.equal(save.data.levels[1].stars, 2, 'лучший результат не затирается худшим');
  assert.equal(save.isLevelOpen(2), true);
  assert.equal(save.nextLevel(6), 2);
  assert.deepEqual(save.data.notes, [1]);
  assert.equal(save.totalStars(), 2);
});

test('сохранение: сердечки нельзя потратить в минус', () => {
  save.reset();
  save.addHearts(30);
  assert.equal(save.spendHearts(40), false);
  assert.equal(save.data.hearts, 30);
  assert.equal(save.spendHearts(30), true);
  assert.equal(save.data.hearts, 0);
  assert.equal(save.data.totalHearts, 30);
});

test('сохранение переживает перезагрузку страницы', () => {
  save.reset();
  save.addHearts(12);
  save.completeLevel(1, 3, 20);
  save.unlockSkin('hood');
  const raw = JSON.parse(store.get('flappykitty.save.v1'));
  assert.equal(raw.hearts, 12);
  assert.equal(raw.levels[1].stars, 3);
  assert.ok(raw.skins.includes('hood') && raw.skins.includes('super'));
});

// Свежая копия модуля читает хранилище заново — так проверяется «следующий запуск».
let copy = 0;
const freshSave = async () => (await import(`../assets/js/storage.js?copy=${++copy}`)).save;

{
  store.set('flappykitty.save.v1', '{"hearts": 12, "lev');
  const s = await freshSave();
  test('испорченное сохранение не ломает игру и перезаписывается', () => {
    assert.equal(s.data.hearts, 0);
    assert.deepEqual(s.data.skins, ['super']);
    s.addHearts(3);
    assert.equal(JSON.parse(store.get('flappykitty.save.v1')).hearts, 3);
  });
}
{
  store.set('flappykitty.save.v1', JSON.stringify({ hearts: -5, totalHearts: 'много', best: 2.9, levels: { 1: { done: 1, stars: 9 }, x: 4 }, notes: [1, 1, 'a', 2], skins: 'hood', skin: 'ghost', sound: false, future: { kart: 1 } }));
  const s = await freshSave();
  test('странные значения в сохранении приводятся к нормальным', () => {
    const d = s.data;
    assert.equal(d.hearts, 0);
    assert.equal(d.totalHearts, 0);
    assert.equal(d.best, 2);
    assert.deepEqual(d.levels, { 1: { done: true, stars: 3, hearts: 0 } });
    assert.deepEqual(d.notes, [1, 2]);
    assert.deepEqual(d.skins, ['super']);
    assert.equal(d.skin, 'super');
    assert.equal(d.sound, false);
    assert.equal(d.music, true);
    assert.deepEqual(d.future, { kart: 1 }, 'поля будущих игр не теряются');
  });
}
{
  const real = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('запрещено'); }, setItem() { throw new Error('запрещено'); } };
  const s = await freshSave();
  test('если браузер запрещает хранилище, игра работает без сохранения', () => {
    s.addHearts(5);
    assert.equal(s.data.hearts, 5);
    assert.equal(s.completeLevel(1, 3, 10), true);
    assert.equal(s.isLevelOpen(2), true);
  });
  globalThis.localStorage = real;
}

if (failures.length) {
  console.error(failures.join('\n'));
  console.error(`\n✗ Проверки логики: ${failures.length} не прошло, ${passed} прошло.`);
  process.exit(1);
}
console.log(`✓ Проверки логики: ${passed} из ${passed}.`);
