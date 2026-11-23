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

// Список опасностей, которые умеет и симулировать, и рисовать игра.
// Новая опасность попадает сюда только вместе с ветками в sim.js и render.js.
const HAZARDS = [
  'drop', 'balloon', 'cucumber', 'wind', 'rain', 'frog', 'yarn', 'bat',
  'dust', 'roomba', 'bubble', 'bird', 'bun', 'soldier', 'ember', 'steam', 'lightning',
];
const { Sim } = await import('../assets/js/game/sim.js');
const { LEVELS, ROUNDS, ROUNDS_PER_LEVEL, roundsOf, SKINS, POWERUPS, WORLD, ENDLESS_THEMES, endlessParams } = await import('../assets/js/game/levels.js');
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

/* ---------- раунды и оформление ---------- */

test('раунды идут по порядку и ссылаются на существующие темы', () => {
  ROUNDS.forEach((l, i) => {
    assert.equal(l.id, i + 1, `id раунда №${i + 1}`);
    assert.ok(THEMES[l.theme], `нет темы «${l.theme}» для раунда ${l.id}`);
    for (const key of ['sky', 'far', 'ground', 'column']) assert.equal(typeof THEMES[l.theme][key], 'function', `${l.theme}.${key}`);
    assert.ok(l.name && l.tagline && l.story && l.tip, `у раунда ${l.id} нет названия, описания или подсказки`);
    assert.ok(l.gates >= 5 && l.gap >= 150 && l.speed > 0 && l.spacing >= 250, `странные параметры раунда ${l.id}`);
    for (const p of l.powerups) assert.ok(POWERUPS[p], `неизвестный бонус «${p}»`);
    for (const h of l.hazards) assert.ok(HAZARDS.includes(h), `неизвестная опасность «${h}»`);
  });
  assert.equal(ROUNDS.length, 20, 'в сюжете двадцать раундов');
  assert.equal(new Set(ROUNDS.map((l) => l.theme)).size, ROUNDS.length, 'у каждого раунда свой мир');
  // Два финала: 10-й раунд закрывает первый уровень, 20-й — второй.
  // В каждом уровне финал длиннее и теснее любого своего раунда — и заметно длиннее предыдущего.
  const finals = ROUNDS.filter((l) => l.finale).map((l) => l.id);
  assert.deepEqual(finals, [10, 20], 'финалы — десятый и двадцатый раунды');
  let start = 0;
  for (const finId of finals) {
    const block = ROUNDS.slice(start, finId);
    const fin = block[block.length - 1];
    const prev = block[block.length - 2];
    assert.ok(fin.gates / prev.gates >= 1.5, `финал № ${finId} должен быть заметно длиннее предыдущего раунда`);
    for (const l of block.slice(0, -1)) {
      assert.ok(l.gates < fin.gates, `раунд ${l.id} длиннее финала № ${finId}`);
      // финал может быть на волосок теснее любого раунда уровня, но не должен быть дырой уже него
      assert.ok(l.gap >= fin.gap - 8, `раунд ${l.id}: просвет ${l.gap} заметно шире, чем в финале ${fin.gap}`);
      assert.ok(l.speed <= fin.speed + 6, `раунд ${l.id} быстрее финала № ${finId}`);
    }
    start = finId;
  }
});

test('два уровня по десять раундов: номера, границы и последний раунд с письмом', () => {
  assert.equal(LEVELS.length, 2, 'уровней два');
  assert.equal(ROUNDS_PER_LEVEL, 10, 'в уровне десять раундов');
  assert.equal(ROUNDS.length, LEVELS.length * ROUNDS_PER_LEVEL, 'раундов — уровни × десять');
  LEVELS.forEach((lv, i) => {
    assert.equal(lv.id, i + 1, 'уровни идут по порядку');
    assert.ok(lv.name && lv.about, `у уровня ${lv.id} нет названия или описания`);
    const rounds = roundsOf(lv.id);
    assert.equal(rounds.length, ROUNDS_PER_LEVEL, `в уровне ${lv.id} должно быть десять раундов`);
    assert.deepEqual(rounds.map((r) => r.no), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], `номера раундов уровня ${lv.id}`);
    assert.deepEqual(rounds.map((r) => r.id), rounds.map((r, k) => i * ROUNDS_PER_LEVEL + k + 1), 'раунды уровня идут подряд');
    assert.deepEqual(rounds.map((r) => !!r.finale), [...Array(9).fill(false), true], `письмо — только после десятого раунда уровня ${lv.id}`);
  });
});

test('цвета меню и подсказок заданы для каждого мира', () => {
  for (const [id, th] of Object.entries(THEMES)) {
    assert.ok(th.name && th.ambient && /^#[0-9A-F]{6}$/i.test(th.hud), `тема «${id}»: нужны name, ambient и hud`);
  }
});

test('бесконечный режим использует только существующие темы', () => {
  for (let n = 0; n < 200; n++) {
    const p = endlessParams(n);
    assert.ok(THEMES[p.theme], `нет темы «${p.theme}»`);
    assert.ok(p.gap >= 150, 'просвет слишком узкий');
  }
  for (const th of ENDLESS_THEMES) assert.ok(THEMES[th], `нет темы «${th}»`);
  assert.deepEqual(endlessParams(0).hazards, [], 'первые ворота бесконечного режима — без опасностей');
  const met = new Set();
  for (let n = 0; n < 60; n++) for (const h of endlessParams(n).hazards) met.add(h);
  for (const h of ['balloon', 'cucumber', 'wind', 'rain', 'frog', 'yarn', 'bat']) assert.ok(met.has(h), `за первый круг по мирам не встретилось: ${h}`);
  assert.deepEqual([...ENDLESS_THEMES].sort(), ROUNDS.map((l) => l.theme).sort(), 'в бесконечном режиме — миры всех раундов');
});

test('бесконечный режим: порядок миров свой у каждого забега, начинается с гостиной', () => {
  const orders = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const sim = new Sim({ mode: 'endless', viewW: 380, seed });
    assert.equal(sim.worlds[0], 'living', 'первый мир — гостиная: в ней разминка');
    assert.deepEqual([...sim.worlds].sort(), [...ENDLESS_THEMES].sort(), 'в забеге — все миры, каждый по одному разу');
    orders.add(sim.worlds.join());
  }
  assert.ok(orders.size >= 10, 'порядок миров почти не меняется от забега к забегу');
  // одинаковое зерно — одинаковый забег (иначе бот и проверки не воспроизводятся)
  assert.deepEqual(new Sim({ mode: 'endless', seed: 5 }).worlds, new Sim({ mode: 'endless', seed: 5 }).worlds);
  // игра может сузить список: пока второй уровень закрыт, его миры в бесконечном режиме не показываются
  const first = roundsOf(1).map((r) => r.theme);
  const narrow = new Sim({ mode: 'endless', seed: 3, worlds: first });
  assert.deepEqual([...narrow.worlds].sort(), [...first].sort());
  fly(narrow, { maxT: 60, onStep: (x) => assert.ok(first.includes(x.theme), `в забег попал закрытый мир «${x.theme}»`) });
  // за средний забег (36 ворот) встречаются миры второго уровня — раньше до них не долетал почти никто
  let far = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const sim = new Sim({ mode: 'endless', seed });
    if (sim.worlds.slice(1, 6).some((t) => !first.includes(t))) far++;
  }
  assert.ok(far >= 36, `миры второго уровня попали в первые шесть только в ${far} забегах из 40`);
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
  const sim = new Sim({ roundId: 1, viewW: 380, seed: 5 });
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
  for (const l of ROUNDS) {
    const sim = new Sim({ roundId: l.id, viewW: 380, seed: 99 });
    let near = 0;
    let maxStreak = 0;
    const flown = fly(sim, {
      onStep(s) {
        near += s.events.filter((e) => e.type === 'near').length;
        maxStreak = Math.max(maxStreak, s.streak);
        s.events.length = 0;
      },
    });
    assert.equal(near, flown.nearMisses, `раунд ${l.id}: счётчик пролётов впритирку расходится с событиями`);
    assert.equal(maxStreak, flown.bestStreak);
    assert.ok(flown.bestStreak <= flown.pathHearts);
    // премии за серии — единственное, чем кошелёк отличается от собранного: рыбки и шарики считаются отдельно
    assert.ok(flown.hearts >= flown.pathHearts);
  }
  // сердечко осталось позади — серия прерывается
  const sim = new Sim({ roundId: 1, viewW: 380, seed: 3 });
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
    assert.ok(+id >= 1 && +id <= ROUNDS.length, `фото привязано к несуществующему раунду ${id}`);
    assert.ok(fs.existsSync(path.join(ROOT, `assets/img/gallery/${ph.file}-thumb.webp`)), `нет файла assets/img/gallery/${ph.file}-thumb.webp`);
    assert.ok(ph.caption && ph.alt, `фото раунда ${id}: нужны подпись и описание`);
  }
});

test('config.js: 20 записок — по одной после каждого раунда, 2 письма — по одному в конце уровня', () => {
  assert.equal(CONFIG.notes.length, 20, 'записок должно быть двадцать');
  assert.equal(CONFIG.letters.length, 2, 'писем должно быть два');
  assert.deepEqual(CONFIG.notes.map((n) => n.round), ROUNDS.map((r) => r.id), 'записки идут по порядку раундов, по одной на раунд');
  for (const n of CONFIG.notes) {
    assert.ok(n.title && n.title.trim() && n.text && n.text.trim(), `пустая записка раунда ${n.round}`);
    assert.equal(n.level, undefined, `записка раунда ${n.round}: поле называется round, а не level`);
  }
  assert.deepEqual(CONFIG.letters.map((l) => l.level), LEVELS.map((l) => l.id), 'письма — по одному на уровень, по порядку');
  for (const letter of CONFIG.letters) {
    assert.ok(letter.title.trim() && letter.text.trim(), `пустое письмо уровня ${letter.level}`);
    assert.equal(letter.note, undefined, 'записка Мии перед письмом лежит в notes, а не внутри письма');
    const last = roundsOf(letter.level).at(-1);
    assert.ok(last.finale, `письмо уровня ${letter.level} приходит после раунда без пометки finale`);
    // записку перед письмом Мия подписывает сама
    assert.equal(CONFIG.notes.find((n) => n.round === last.id).from, CONFIG.cat.name, `записка № ${last.id} — от Мии`);
  }
  assert.ok(CONFIG.her.name && CONFIG.her.sweet && CONFIG.her.dative && CONFIG.cat.name && CONFIG.from);
  // Прощание стоит один раз — в подписи. Если оно же осталось последней строкой письма, на листке выходит повтор.
  const bye = CONFIG.from.replace(/[\u2764\u2665]\uFE0F?/g, '').trim().toLowerCase();
  for (const l of CONFIG.letters) {
    const last = l.text.trim().split('\n').pop().toLowerCase();
    assert.ok(!bye || !last.includes(bye), `письмо № ${l.level} заканчивается теми же словами, что и подпись: «${last}»`);
    assert.equal(l.text, l.text.trim(), `в письме № ${l.level} лишние пробелы или пустые строки по краям`);
  }
});

test('config.js: день рождения — настоящая дата, режим включается только в этот день', () => {
  const b = CONFIG.birthday;
  assert.ok(b.month >= 1 && b.month <= 12 && b.day >= 1 && b.day <= 31);
  assert.equal(isBirthday(new Date(2027, b.month - 1, b.day, 12)), !!b.enabled);
  assert.equal(isBirthday(new Date(2027, b.month % 12, b.day === 1 ? 2 : 1, 12)), false);
});

/* ---------- симуляция ---------- */

test('одинаковое зерно даёт одинаковый раунд', () => {
  const a = new Sim({ roundId: 3, viewW: 380, seed: 42 });
  const b = new Sim({ roundId: 3, viewW: 380, seed: 42 });
  assert.deepEqual(a.gates.map((g) => [g.x, g.baseY]), b.gates.map((g) => [g.x, g.baseY]));
});

test('просветы всегда в пределах экрана и достижимы от предыдущих', () => {
  for (const l of ROUNDS) {
    for (let seed = 1; seed <= 25; seed++) {
      const sim = new Sim({ roundId: l.id, viewW: 4000 + l.gates * l.spacing, seed });
      assert.equal(sim.gates.length, l.gates, `раунд ${l.id}: число ворот`);
      let prev = null;
      for (const g of sim.gates) {
        assert.ok(g.baseY - g.amp - g.gap / 2 >= 40, `раунд ${l.id}: просвет упирается в потолок`);
        assert.ok(g.baseY + g.amp + g.gap / 2 <= WORLD.GROUND - 40, `раунд ${l.id}: просвет упирается в пол`);
        if (prev) assert.ok(Math.abs(g.baseY - prev.baseY) <= 185.001, `раунд ${l.id}: слишком резкий перепад между воротами`);
        prev = g;
      }
    }
  }
});

test('каждый раунд проходится автопилотом, прогресс растёт от 0 до 1 без скачков', () => {
  for (const l of ROUNDS) {
    let won = 0;
    for (let seed = 1; seed <= 12; seed++) {
      let last = 0;
      const sim = fly(new Sim({ roundId: l.id, viewW: 380, seed: seed * 7919 }), {
        onStep(s) {
          const p = s.progress;
          assert.ok(p >= last - 1e-9, `раунд ${l.id}: прогресс пошёл назад`);
          assert.ok(p - last < 0.02, `раунд ${l.id}: прогресс прыгнул с ${last.toFixed(3)} до ${p.toFixed(3)}`);
          last = p;
        },
      });
      if (sim.status === 'won') {
        won++;
        assert.ok(sim.progress > 0.999, `раунд ${l.id}: на финише прогресс ${sim.progress}`);
        assert.equal(sim.passed, l.gates, `раунд ${l.id}: пройдено ворот`);
        assert.ok(sim.stars() >= 1 && sim.stars() <= 3);
        assert.ok(sim.pathHearts <= sim.heartsTotal);
      }
    }
    assert.ok(won >= 7, `раунд ${l.id}: автопилот прошёл только ${won} из 12`);
  }
});

test('без взмахов Мия теряет три жизни и проигрывает', () => {
  const sim = new Sim({ roundId: 1, viewW: 380, seed: 5 });
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
  const sim = new Sim({ roundId: 1, viewW: 380, seed: 5 });
  sim.flap();
  sim.shield = true;
  sim.hit('test');
  assert.equal(sim.shield, false);
  assert.equal(sim.lives, 3);
  assert.equal(sim.lostLives, 0);
  assert.ok(sim.inv > 0, 'после пузыря должна быть короткая неуязвимость');
});

test('в бесконечном режиме одна жизнь, раунд не кончается', () => {
  const sim = new Sim({ mode: 'endless', viewW: 380, seed: 9 });
  assert.equal(sim.maxLives, 1);
  assert.equal(sim.progress, 0);
  fly(sim, { maxT: 40 });
  assert.notEqual(sim.status, 'won');
  assert.equal(sim.finishX, null);
});

test('звёзды: по одной за каждую цель — долетела, 70% сердечек, без потерь', () => {
  const sim = new Sim({ roundId: 1, viewW: 380, seed: 1 });
  sim.status = 'won';
  sim.heartsTotal = 10;
  sim.pathHearts = 6;
  assert.equal(sim.stars(), 2, 'долетела без потерь, но сердечек мало');
  sim.pathHearts = 7;
  assert.equal(sim.stars(), 3);
  sim.lostLives = 1;
  assert.equal(sim.stars(), 2, 'сердечки собраны, но жизнь потеряна');
  sim.pathHearts = 6;
  assert.equal(sim.stars(), 1, 'только долетела');
});

/* ---------- новые раунды ---------- */

/** Прогоняет раунд автопилотом и считает, что в нём встретилось. */
function watch(roundId, seed) {
  const seen = { types: new Set(), events: new Set(), maxFrogY: 0, batSpan: 0, clearAt: null, sim: null, gateX: {}, emitterX: new Set(), cloudsOnly: true };
  const sim = new Sim({ roundId, viewW: 380, seed });
  seen.sim = sim;
  sim.flap();
  let i = 0;
  let batMin = Infinity;
  let batMax = -Infinity;
  while (sim.status !== 'won' && sim.status !== 'lost' && sim.t < 300) {
    if (i % 15 === 0) {
      const wx = sim.dist + sim.miaX;
      const g = sim.gates.find((x) => x.x + x.w > wx - WORLD.RADIUS);
      if (sim.mia.y + sim.mia.vy * 0.07 > (g ? g.gapY + 22 : 330)) sim.flap();
    }
    sim.step(DT);
    for (const ev of sim.events) {
      seen.events.add(ev.type + (ev.kind ? ':' + ev.kind : ''));
      if (ev.type === 'clear') seen.clearAt = sim.passed;
    }
    for (const h of sim.hazards) {
      seen.types.add(h.type);
      if (h.type === 'frog') seen.maxFrogY = Math.max(seen.maxFrogY, WORLD.GROUND - h.y);
      if (h.type === 'bat') {
        batMin = Math.min(batMin, h.y - h.y0);
        batMax = Math.max(batMax, h.y - h.y0);
      }
    }
    for (const g of sim.gates) seen.gateX[g.idx] = g.x;
    for (const e of sim.emitters) {
      seen.emitterX.add(e.x);
      if (e.kind !== 'cloud') seen.cloudsOnly = false;
    }
    sim.events.length = 0;
    i++;
  }
  seen.batSpan = batMax - batMin;
  return seen;
}
const roundBy = (theme) => ROUNDS.find((l) => l.theme === theme);

test('под дождём: капли падают из тучек, во второй половине дождь кончается', () => {
  const l = roundBy('rain');
  const s = watch(l.id, 4242);
  assert.ok(s.emitterX.size > 2 && s.cloudsOnly, 'капли падают только из тучек, и тучек больше двух');
  assert.ok(s.types.has('drop'), 'за раунд не упало ни одной капли');
  assert.ok(s.events.has('clear'), 'дождь не кончился');
  assert.equal(s.clearAt, s.sim.calmGate, 'дождь кончается на отмеченных воротах');
  assert.ok(s.sim.calmGate > l.gates * 0.4 && s.sim.calmGate < l.gates, 'дождь кончается во второй половине раунда');
  assert.equal(s.sim.clear, 1, 'небо прояснилось полностью');
  // после нужных ворот тучек больше нет
  const calmX = s.gateX[s.sim.calmGate];
  assert.ok(calmX > 0 && [...s.emitterX].every((x) => x < calmX), 'после дождя остались тучки');
  assert.equal(new Sim({ roundId: 1, viewW: 380, seed: 1 }).calmGate, Infinity, 'в остальных раундах «прояснения» нет');
});

test('лягушачий пруд: лягушонок предупреждает «ква», прыгает и возвращается на воду', () => {
  const s = watch(roundBy('pond').id, 77);
  assert.ok(s.types.has('frog'), 'нет ни одного лягушонка');
  assert.ok(s.events.has('croak'), 'лягушонок не предупредил о прыжке');
  assert.ok(s.events.has('splash:frog'), 'лягушонок не вернулся на воду');
  assert.ok(s.maxFrogY > 180 && s.maxFrogY < 290, `высота прыжка ${Math.round(s.maxFrogY)} — должна быть ниже середины экрана`);
});

test('плюшевый совет: опасностей нет, клубок даёт два сердечка', () => {
  const l = roundBy('plush');
  assert.deepEqual(l.hazards, ['yarn'], 'в передышке только клубки');
  const s = watch(l.id, 5);
  assert.ok(s.types.has('yarn'), 'нет ни одного клубка');
  assert.equal(s.sim.lostLives, 0, 'в передышке автопилот не должен терять жизни');
  // клубок: +2 сердечка и событие «pop» с пометкой
  const sim = new Sim({ roundId: l.id, viewW: 380, seed: 9 });
  sim.flap();
  sim.hazards.length = 0;
  sim.hazards.push({ type: 'yarn', x: sim.dist + sim.miaX, y: sim.mia.y, y0: sim.mia.y, r: 20, vx: 0, phase: 0, hue: 1 });
  const before = sim.hearts;
  sim.step(DT);
  assert.ok(sim.events.some((e) => e.type === 'pop' && e.kind === 'yarn'), 'нет события «клубок размотан»');
  assert.equal(sim.hearts - before, 2);
  assert.equal(sim.lives, 3, 'клубок не отнимает жизнь');
  assert.equal(sim.hazards.length, 0, 'клубок исчезает');
});

test('поцелуй или кусь: летучая мышь прилетает после предупреждения и летит волной', () => {
  const s = watch(roundBy('gothic').id, 31337);
  assert.ok(s.events.has('warn:bat'), 'нет предупреждения о летучей мыши');
  assert.ok(s.types.has('bat'), 'нет ни одной летучей мыши');
  assert.ok(s.batSpan > 50 && s.batSpan <= 77, `размах волны ${Math.round(s.batSpan)}`);
});

/* ---------- опасности второго уровня ---------- */

/** Раунд в полёте без случайных опасностей: в него подкладывается ровно одна — та, что проверяется. */
function lab(theme, hazard) {
  const sim = new Sim({ roundId: roundBy(theme).id, viewW: 380, seed: 4 });
  sim.flap();
  sim.nextGateX = 1e9; // ворота не появятся: в лаборатории только Мия и одна опасность
  sim.gates.length = 0;
  sim.hazards.length = 0;
  sim.events.length = 0;
  if (hazard) sim.hazards.push(hazard(sim));
  return sim;
}
/** Шаг симуляции, в котором Мия держится на заданной высоте (чтобы проверять опасность, а не полёт). */
function hold(sim, y, steps, each) {
  const seen = [];
  for (let i = 0; i < steps && sim.status === 'playing'; i++) {
    sim.mia.y = y;
    sim.mia.vy = 0;
    sim.step(DT);
    for (const e of sim.events.splice(0)) seen.push(e);
    if (each) each(sim);
  }
  return seen;
}

test('гроза: молния предупреждает, бьёт сверху до светящейся точки и не достаёт того, кто летит ниже', () => {
  const bolt = (sim) => ({ type: 'lightning', x: sim.dist + sim.miaX + 260, y: 300, r: 15, state: 'idle', timer: 0, phase: 0 });
  // выше точки — удар
  let sim = lab('storm', bolt);
  let seen = hold(sim, 200, 600);
  const order = seen.map((e) => (e.type === 'warn' ? `warn:${e.kind}` : e.type)).filter((t) => /warn|lightning|hit/.test(t));
  assert.deepEqual(order.slice(0, 3), ['warn:lightning', 'lightning', 'hit'], 'порядок: предупреждение → разряд → удар');
  assert.equal(seen.find((e) => e.type === 'hit').cause, 'lightning', 'причина удара — молния');
  assert.equal(sim.lives, 2);
  // между предупреждением и разрядом — не меньше 0.7 с: игрок успевает нырнуть
  sim = lab('storm', bolt);
  let warnAt = null;
  let strikeAt = null;
  hold(sim, 200, 600, (x) => {
    const h = x.hazards[0];
    if (h && h.state === 'warn' && warnAt === null) warnAt = x.t;
    if (h && h.state === 'strike' && strikeAt === null) strikeAt = x.t;
  });
  assert.ok(strikeAt - warnAt >= 0.7, `от предупреждения до разряда ${(strikeAt - warnAt).toFixed(2)} с`);
  // ниже точки — мимо
  sim = lab('storm', bolt);
  seen = hold(sim, 380, 600);
  assert.ok(seen.some((e) => e.type === 'lightning'), 'разряда не было');
  assert.equal(sim.lives, 3, 'молния достала Мию ниже светящейся точки');
  assert.equal(sim.hazards.length, 0, 'отработавшая молния исчезает');
});

test('робот-пылесос: тянет Мию вниз, пока она над ним, и ранит, если его коснуться', () => {
  const robot = (sim) => ({ type: 'roomba', x: sim.dist + sim.miaX + 200, mx: sim.dist + sim.miaX + 200, y: 568, r: 24, phase: 0, pull: 0 });
  // свободный полёт без взмахов: с роботом Мия опускается быстрее, чем без него
  const drop = (hazard) => {
    const sim = lab('vacuum', hazard);
    sim.mia.y = 120;
    sim.mia.vy = 0;
    let seen = false;
    for (let i = 0; i < 120 * 0.5; i++) {
      sim.step(DT);
      if (sim.events.some((e) => e.type === 'suck')) seen = true;
      sim.events.length = 0;
    }
    return { y: sim.mia.y, seen };
  };
  const near = (sim) => ({ ...robot(sim), x: sim.dist + sim.miaX + 60, mx: sim.dist + sim.miaX + 60 });
  const withRobot = drop(near);
  const without = drop(null);
  assert.ok(withRobot.seen, 'нет события «пылесос тянет»');
  assert.ok(withRobot.y > without.y + 25, `пылесос почти не тянет: ${Math.round(withRobot.y)} против ${Math.round(without.y)}`);
  // высоко над роботом — тянет, но не ранит
  let sim = lab('vacuum', robot);
  hold(sim, 250, 400);
  assert.equal(sim.lives, 3, 'пылесос ранит на расстоянии');
  // у самого пола — ранит
  sim = lab('vacuum', robot);
  const seen = hold(sim, 560, 400);
  assert.equal(sim.lives, 2, 'пылесос не ранит при касании');
  assert.equal(seen.find((e) => e.type === 'hit').cause, 'roomba');
});

test('пекарня: пар не ранит, а подбрасывает вверх', () => {
  const jet = (sim) => ({ type: 'steam', x: sim.dist + sim.miaX + 50, y: 580, r: 34, phase: 0, on: false });
  const fall = (hazard) => {
    const sim = lab('bakery', hazard);
    sim.mia.y = 150;
    sim.mia.vy = 0;
    let seen = false;
    for (let i = 0; i < 120 * 0.5 && sim.status === 'playing'; i++) {
      sim.step(DT);
      if (sim.events.some((e) => e.type === 'steam')) seen = true;
      sim.events.length = 0;
    }
    return { sim, seen };
  };
  const a = fall(jet);
  const b = fall(null);
  assert.ok(a.seen, 'нет события «пар»');
  assert.equal(a.sim.lives, 3, 'пар не должен отнимать жизнь');
  assert.ok(a.sim.mia.y < b.sim.mia.y - 20, `пар почти не подбрасывает: ${Math.round(a.sim.mia.y)} против ${Math.round(b.sim.mia.y)}`);
});

test('второй уровень: каждая опасность появляется в своём раунде, в финале бьют молнии', () => {
  const expect = { attic: 'dust', vacuum: 'roomba', bath: 'bubble', street: 'bird', bakery: 'bun', toybox: 'soldier', fireplace: 'ember', storm: 'lightning', dawn: 'lightning' };
  for (const [theme, type] of Object.entries(expect)) {
    const id = roundBy(theme).id;
    let met = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = watch(id, seed);
      if (s.types.has(type)) met++;
    }
    assert.ok(met >= 5, `«${type}» в раунде ${id} встретилась только в ${met} забегах из 6`);
  }
  // финал второго уровня больше не пустой: молнии бьют по-настоящему
  let strikes = 0;
  for (let seed = 1; seed <= 6; seed++) if (watch(roundBy('dawn').id, seed).events.has('lightning')) strikes++;
  assert.ok(strikes >= 5, `в финале второго уровня молния ударила только в ${strikes} забегах из 6`);
});

/* ---------- сохранение ---------- */

const { save, SAVE_EPOCH } = await import('../assets/js/storage.js');

test('сохранение: раунды открываются по очереди', () => {
  save.reset();
  assert.equal(save.isRoundOpen(1), true);
  assert.equal(save.isRoundOpen(2), false);
  assert.equal(save.nextRound(ROUNDS.length), 1);
  assert.equal(save.completeRound(1, 2, 20), true, 'первое прохождение');
  assert.equal(save.completeRound(1, 1, 5), false, 'повторное прохождение');
  assert.equal(save.data.levels[1].stars, 2, 'лучший результат не затирается худшим');
  assert.equal(save.isRoundOpen(2), true);
  assert.equal(save.nextRound(ROUNDS.length), 2);
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
  save.completeRound(1, 3, 20);
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
  store.set('flappykitty.save.v1', JSON.stringify({ epoch: SAVE_EPOCH, hearts: -5, totalHearts: 'много', best: 2.9, levels: { 1: { done: 1, stars: 9 }, x: 4 }, notes: [1, 1, 'a', 2], skins: 'hood', skin: 'ghost', sound: false, future: { kart: 1 } }));
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
  // Общий сброс: запись, сделанная до него (без номера сброса), заменяется чистой при первом же чтении.
  const done = {};
  for (let i = 1; i <= 20; i++) done[i] = { done: true, stars: 3, hearts: 20 + i };
  const before = { v: 1, rounds: 10, hearts: 300, totalHearts: 450, best: 17, levels: done, notes: [1, 2, 3, 10, 20], seenNotes: [1, 2, 10], skins: ['super', 'hood'], skin: 'hood', sound: false, music: false, plays: 12, future: { kart: 1 } };
  store.set('flappykitty.save.v1', JSON.stringify(before));
  const s = await freshSave();
  test('общий сброс: запись, сделанная до сброса, обнуляется целиком при первом открытии', () => {
    const d = s.data;
    assert.equal(d.epoch, SAVE_EPOCH);
    assert.deepEqual(d.levels, {}, 'пройденных раундов нет');
    assert.deepEqual([d.hearts, d.totalHearts, d.best, d.plays], [0, 0, 0, 0], 'сердечки, рекорд и счётчик запусков обнулены');
    assert.deepEqual([d.notes, d.seenNotes], [[], []], 'записки и письма снова закрыты');
    assert.deepEqual([d.skins, d.skin], [['super'], 'super'], 'облики сброшены');
    assert.deepEqual([d.sound, d.music], [true, true], 'звук и музыка включены, как у нового игрока');
    assert.equal(d.future, undefined, 'незнакомые поля старой записи тоже стёрты');
    assert.equal(s.nextRound(ROUNDS.length), 1);
    assert.equal(s.isRoundOpen(2), false);
    assert.equal(s.totalStars(), 0);
    // чистая запись уже лежит в хранилище — её увидят страницы сайта, которые ничего не пишут
    const raw = JSON.parse(store.get('flappykitty.save.v1'));
    assert.equal(raw.epoch, SAVE_EPOCH);
    assert.deepEqual(raw.levels, {});
    assert.equal(raw.hearts, 0);
    // после сброса прогресс копится как обычно
    s.completeRound(1, 3, 30);
    s.addHearts(30);
    s.set({ superMia: { stage: 2 } });
  });
  const again = await freshSave();
  test('общий сброс делается один раз: то, что пройдено после него, остаётся', () => {
    assert.deepEqual(again.data.levels, { 1: { done: true, stars: 3, hearts: 30 } });
    assert.equal(again.data.hearts, 30);
    assert.deepEqual(again.data.notes, [1]);
    assert.deepEqual(again.data.superMia, { stage: 2 }, 'поля будущих игр после сброса живут как раньше');
    assert.equal(again.isRoundOpen(2), true);
  });
  // запись с прежним номером сброса не трогается, с бо́льшим (из более новой версии) — тоже
  store.set('flappykitty.save.v1', JSON.stringify({ epoch: SAVE_EPOCH + 1, hearts: 7, levels: { 1: { done: true, stars: 2, hearts: 9 } } }));
  const newer = await freshSave();
  test('общий сброс не трогает запись, сделанную после него', () => {
    assert.equal(newer.data.hearts, 7);
    assert.equal(newer.data.levels[1].stars, 2);
    newer.addHearts(1);
    assert.equal(JSON.parse(store.get('flappykitty.save.v1')).epoch, SAVE_EPOCH + 1, 'номер сброса из более новой версии не понижается');
  });
  test('общий сброс: номер — целое число не меньше единицы, в чистой записи он есть', () => {
    assert.ok(Number.isInteger(SAVE_EPOCH) && SAVE_EPOCH >= 1);
    newer.reset();
    assert.ok(JSON.parse(store.get('flappykitty.save.v1')).epoch >= SAVE_EPOCH);
  });
}
{
  const real = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('запрещено'); }, setItem() { throw new Error('запрещено'); } };
  const s = await freshSave();
  test('если браузер запрещает хранилище, игра работает без сохранения', () => {
    s.addHearts(5);
    assert.equal(s.data.hearts, 5);
    assert.equal(s.completeRound(1, 3, 10), true);
    assert.equal(s.isRoundOpen(2), true);
  });
  globalThis.localStorage = real;
}

/* ---------- звук и музыка ---------- */

{
  // Ошибки, которые видно только в браузере: тема музыки, названная не так, как в audio.js,
  // молча играла «по умолчанию» — второе письмо из-за этого осталось без своей мелодии.
  const { Sound, unknownThemes } = await import('../assets/js/game/audio.js');
  test('каждая тема игры есть в таблице музыки', () => {
    const s = new Sound();
    for (const k of Object.keys(THEMES)) s.setTheme(k);
    s.setTheme('letter');
    s.setTheme('email'); // музыка второго письма
    assert.deepEqual([...unknownThemes], [], `незнакомые темы музыки: ${[...unknownThemes].join(', ')}`);
  });
  test('все звуки, которые зовёт игра, есть в audio.js', () => {
    const src = fs.readFileSync(path.join(ROOT, 'assets/js/game/audio.js'), 'utf8');
    const defined = new Set([...src.matchAll(/case '([a-z0-9]+)':/g)].map((m) => m[1]));
    const called = new Set();
    for (const f of ['assets/js/game/main.js', 'assets/js/love.js', 'assets/js/site.js']) {
      for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/\.play\('([a-z0-9]+)'/g)) called.add(m[1]);
    }
    const missing = [...called].filter((c) => !defined.has(c));
    assert.deepEqual(missing, [], `звуки без ветки в audio.js: ${missing.join(', ')}`);
  });
}

/* ---------- события симуляции ---------- */

{
  const { Sim } = await import('../assets/js/game/sim.js');
  test('каждое событие симуляции кто-то обрабатывает', () => {
    const simSrc = fs.readFileSync(path.join(ROOT, 'assets/js/game/sim.js'), 'utf8');
    const mainSrc = fs.readFileSync(path.join(ROOT, 'assets/js/game/main.js'), 'utf8');
    const emitted = new Set([...simSrc.matchAll(/this\.emit\('([A-Za-z0-9]+)'/g)].map((m) => m[1]));
    const handled = new Set([...mainSrc.matchAll(/case '([A-Za-z0-9]+)':/g)].map((m) => m[1]));
    // 'dying' — сигнал для отрисовки (пауза кадра), а не для экранов
    const missing = [...emitted].filter((e) => !handled.has(e) && e !== 'dying');
    assert.deepEqual(missing, [], `события без обработки в main.js: ${missing.join(', ')}`);
  });
  test('у каждого письма своя тема музыки, и она существует', () => {
    const mainSrc = fs.readFileSync(path.join(ROOT, 'assets/js/game/main.js'), 'utf8');
    const audioSrc = fs.readFileSync(path.join(ROOT, 'assets/js/game/audio.js'), 'utf8');
    const roots = audioSrc.slice(audioSrc.indexOf('const ROOTS'), audioSrc.indexOf('};', audioSrc.indexOf('const ROOTS')));
    const known = new Set([...roots.matchAll(/([a-z]+):\s*-?\d/g)].map((m) => m[1]));
    // Проверяем не только объявление letterTheme, но и место вызова: сломать можно и там.
    // следующий function после openEnvelope — чтобы нарезка не зависела от порядка функций в файле
    const start = mainSrc.indexOf('function openEnvelope');
    assert.ok(start > 0, 'нет функции openEnvelope');
    const after = mainSrc.slice(start + 10);
    const next = after.search(/\n\s*(async )?function /);
    const openEnv = next > 0 ? after.slice(0, next) : after;
    const call = openEnv.match(/sound\.setTheme\(([^;]+)\)/);
    assert.ok(call, 'конверт должен задавать тему музыки письма');
    assert.match(call[1], /letterTheme\(/, 'тему письма выбирает letterTheme(), а не строка на месте');
    const fn = mainSrc.slice(mainSrc.indexOf('function letterTheme'), mainSrc.indexOf('/** Наполняет листок'));
    const names = [...fn.matchAll(/'([a-z0-9]+)'/g)].map((m) => m[1]);
    assert.ok(names.length >= 2, 'в letterTheme должно быть по теме на каждое письмо');
    for (const n of names) assert.ok(known.has(n), `тема письма «${n}» не описана в audio.js`);
    // и у каждого письма тема своя, иначе у второго письма музыки не будет вовсе
    assert.equal(new Set(names).size, names.length, 'у писем должны быть разные темы музыки');
    assert.equal((CONFIG.letters || []).length, 2, 'писем должно быть два');
  });
  test('раунд с ветром предупреждает о нём до порыва', () => {
    const windy = ROUNDS.find((l) => (l.hazards || []).includes('wind'));
    assert.ok(windy, 'нет раунда с ветром');
    const sim = new Sim({ mode: 'story', roundId: windy.id, seed: 3 });
    sim.status = 'playing';
    const seen = new Set();
    for (let i = 0; i < 120 * 40; i++) {
      sim.flap();
      sim.step(1 / 120);
      for (const e of sim.events.splice(0)) {
        seen.add(e.type);
        if (e.type === 'wind') assert.ok(seen.has('windWarn'), 'порыв случился без предупреждения');
      }
    }
    assert.ok(seen.has('windWarn'), 'ветер ни разу не предупредил о себе');
  });
}

if (failures.length) {
  console.error(failures.join('\n'));
  console.error(`\n✗ Проверки логики: ${failures.length} не прошло, ${passed} прошло.`);
  process.exit(1);
}
console.log(`✓ Проверки логики: ${passed} из ${passed}.`);
