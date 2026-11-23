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
const { LEVELS, SKINS, POWERUPS, WORLD, ENDLESS_THEMES, endlessParams } = await import('../assets/js/game/levels.js');
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
    assert.ok(l.name && l.tagline && l.story && l.tip, `у уровня ${l.id} нет названия, описания или подсказки`);
    assert.ok(l.gates >= 5 && l.gap >= 150 && l.speed > 0 && l.spacing >= 250, `странные параметры уровня ${l.id}`);
    for (const p of l.powerups) assert.ok(POWERUPS[p], `неизвестный бонус «${p}»`);
    for (const h of l.hazards) assert.ok(HAZARDS.includes(h), `неизвестная опасность «${h}»`);
  });
  assert.equal(LEVELS.length, 20, 'в сюжете двадцать уровней');
  assert.equal(new Set(LEVELS.map((l) => l.theme)).size, LEVELS.length, 'у каждого уровня свой мир');
  // Два финала: 10-й закрывает первую главу, 20-й — вторую.
  // В каждой главе финал длиннее и теснее любого своего уровня — и примерно вдвое длиннее предыдущего.
  const finals = LEVELS.filter((l) => l.finale).map((l) => l.id);
  assert.deepEqual(finals, [10, 20], 'финалы — десятый и двадцатый уровни');
  let start = 0;
  for (const finId of finals) {
    const block = LEVELS.slice(start, finId);
    const fin = block[block.length - 1];
    const prev = block[block.length - 2];
    assert.ok(fin.gates / prev.gates >= 1.5, `финал № ${finId} должен быть заметно длиннее предыдущего уровня`);
    for (const l of block.slice(0, -1)) {
      assert.ok(l.gates < fin.gates, `уровень ${l.id} длиннее финала № ${finId}`);
      // финал может быть на волосок теснее любого уровня главы, но не должен быть дырой уже него
      assert.ok(l.gap >= fin.gap - 8, `уровень ${l.id}: просвет ${l.gap} заметно шире, чем в финале ${fin.gap}`);
      assert.ok(l.speed <= fin.speed + 6, `уровень ${l.id} быстрее финала № ${finId}`);
    }
    start = finId;
  }
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
  assert.deepEqual([...ENDLESS_THEMES].sort(), LEVELS.map((l) => l.theme).sort(), 'в бесконечном режиме — миры всех уровней');
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
  const letterLevels = new Set((CONFIG.letters || []).map((l) => l.level));
  // после каждого уровня — записка, кроме финалов: там письмо
  for (let id = 1; id <= LEVELS.length; id++) {
    if (letterLevels.has(id)) continue;
    const note = CONFIG.notes.find((n) => n.level === id);
    assert.ok(note, `нет записки для уровня ${id}`);
    assert.ok(note.title.trim() && note.text.trim(), `пустая записка уровня ${id}`);
  }
  assert.deepEqual([...letterLevels].sort((a, b) => a - b), [10, 20], 'письма открываются после 10-го и 20-го уровней');
  for (const letter of CONFIG.letters) {
    // у финала две ступени: записка от Мии, потом письмо создателя
    assert.ok(letter.note && letter.note.title.trim() && letter.note.text.trim(), `у финала ${letter.level} нет записки Мии`);
    assert.ok(letter.title.trim() && letter.text.trim(), `пустое письмо после уровня ${letter.level}`);
    assert.ok(letter.level >= 1 && letter.level <= LEVELS.length, `письмо привязано к несуществующему уровню ${letter.level}`);
  }
  // записок ровно столько, сколько нефинальных уровней: 20 уровней → 18 записок + 2 письма
  assert.equal(CONFIG.notes.length, LEVELS.length - CONFIG.letters.length, 'записок должно быть на два меньше, чем уровней');
  for (const n of CONFIG.notes) assert.ok(n.level >= 1 && n.level <= LEVELS.length, `записка привязана к несуществующему уровню ${n.level}`);
  assert.ok(!letterLevels.has(CONFIG.notes.find((n) => n.level === 10)?.level), 'для финала не должно быть записки, только письмо');
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

test('звёзды: по одной за каждую цель — долетела, 70% сердечек, без потерь', () => {
  const sim = new Sim({ levelId: 1, viewW: 380, seed: 1 });
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

/** Прогоняет уровень автопилотом и считает, что в нём встретилось. */
function watch(levelId, seed) {
  const seen = { types: new Set(), events: new Set(), maxFrogY: 0, batSpan: 0, clearAt: null, sim: null, gateX: {}, emitterX: new Set(), cloudsOnly: true };
  const sim = new Sim({ levelId, viewW: 380, seed });
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
const levelBy = (theme) => LEVELS.find((l) => l.theme === theme);

test('под дождём: капли падают из тучек, во второй половине дождь кончается', () => {
  const l = levelBy('rain');
  const s = watch(l.id, 4242);
  assert.ok(s.emitterX.size > 2 && s.cloudsOnly, 'капли падают только из тучек, и тучек больше двух');
  assert.ok(s.types.has('drop'), 'за уровень не упало ни одной капли');
  assert.ok(s.events.has('clear'), 'дождь не кончился');
  assert.equal(s.clearAt, s.sim.calmGate, 'дождь кончается на отмеченных воротах');
  assert.ok(s.sim.calmGate > l.gates * 0.4 && s.sim.calmGate < l.gates, 'дождь кончается во второй половине уровня');
  assert.equal(s.sim.clear, 1, 'небо прояснилось полностью');
  // после нужных ворот тучек больше нет
  const calmX = s.gateX[s.sim.calmGate];
  assert.ok(calmX > 0 && [...s.emitterX].every((x) => x < calmX), 'после дождя остались тучки');
  assert.equal(new Sim({ levelId: 1, viewW: 380, seed: 1 }).calmGate, Infinity, 'в остальных уровнях «прояснения» нет');
});

test('лягушачий пруд: лягушонок предупреждает «ква», прыгает и возвращается на воду', () => {
  const s = watch(levelBy('pond').id, 77);
  assert.ok(s.types.has('frog'), 'нет ни одного лягушонка');
  assert.ok(s.events.has('croak'), 'лягушонок не предупредил о прыжке');
  assert.ok(s.events.has('splash:frog'), 'лягушонок не вернулся на воду');
  assert.ok(s.maxFrogY > 180 && s.maxFrogY < 290, `высота прыжка ${Math.round(s.maxFrogY)} — должна быть ниже середины экрана`);
});

test('плюшевый совет: опасностей нет, клубок даёт два сердечка', () => {
  const l = levelBy('plush');
  assert.deepEqual(l.hazards, ['yarn'], 'в передышке только клубки');
  const s = watch(l.id, 5);
  assert.ok(s.types.has('yarn'), 'нет ни одного клубка');
  assert.equal(s.sim.lostLives, 0, 'в передышке автопилот не должен терять жизни');
  // клубок: +2 сердечка и событие «pop» с пометкой
  const sim = new Sim({ levelId: l.id, viewW: 380, seed: 9 });
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
  const s = watch(levelBy('gothic').id, 31337);
  assert.ok(s.events.has('warn:bat'), 'нет предупреждения о летучей мыши');
  assert.ok(s.types.has('bat'), 'нет ни одной летучей мыши');
  assert.ok(s.batSpan > 50 && s.batSpan <= 77, `размах волны ${Math.round(s.batSpan)}`);
});

/* ---------- сохранение ---------- */

const { save } = await import('../assets/js/storage.js');

test('сохранение: уровни открываются по очереди', () => {
  save.reset();
  assert.equal(save.isLevelOpen(1), true);
  assert.equal(save.isLevelOpen(2), false);
  assert.equal(save.nextLevel(LEVELS.length), 1);
  assert.equal(save.completeLevel(1, 2, 20), true, 'первое прохождение');
  assert.equal(save.completeLevel(1, 1, 5), false, 'повторное прохождение');
  assert.equal(save.data.levels[1].stars, 2, 'лучший результат не затирается худшим');
  assert.equal(save.isLevelOpen(2), true);
  assert.equal(save.nextLevel(LEVELS.length), 2);
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
  // Запись от версии с шестью уровнями: шестым был финал с письмом. Теперь финал — десятый.
  const old = {};
  for (let i = 1; i <= 6; i++) old[i] = { done: true, stars: i === 6 ? 2 : 3, hearts: 20 + i };
  store.set('flappykitty.save.v1', JSON.stringify({ v: 1, hearts: 300, totalHearts: 450, best: 17, levels: old, notes: [1, 2, 3, 4, 5, 6], seenNotes: [1, 2, 6], skins: ['super', 'hood'], skin: 'hood', plays: 12 }));
  const s = await freshSave();
  test('старое сохранение (6 уровней): финал и письмо переезжают на № 10, раунды 6–9 ждут своей очереди', () => {
    const d = s.data;
    assert.deepEqual(d.levels[10], { done: true, stars: 2, hearts: 26 }, 'результат финала перенесён');
    assert.equal(d.levels[6], undefined, 'новый шестой раунд ещё не пройден');
    for (let i = 1; i <= 5; i++) assert.deepEqual(d.levels[i], { done: true, stars: 3, hearts: 20 + i }, `раунд ${i} не тронут`);
    assert.deepEqual(d.notes, [1, 2, 3, 4, 5, 10], 'письмо осталось открытым');
    assert.deepEqual(d.seenNotes, [1, 2, 10]);
    assert.equal(d.hearts, 300);
    assert.equal(d.best, 17);
    assert.equal(d.skin, 'hood');
    assert.equal(s.totalStars(), 17);
    assert.equal(s.nextLevel(LEVELS.length), 6, 'следующий раунд — шестой');
    assert.equal(s.isLevelOpen(6), true);
    assert.equal(s.isLevelOpen(7), false, 'раунды открываются по очереди');
    assert.equal(s.isLevelOpen(10), true, 'уже пройденный финал можно переиграть');
    // перенос делается один раз: после записи новый шестой раунд остаётся шестым
    s.completeLevel(6, 3, 30);
    const raw = JSON.parse(store.get('flappykitty.save.v1'));
    assert.equal(raw.rounds, 10);
    assert.equal(raw.levels[6].stars, 3);
  });
  const again = await freshSave();
  test('перенос старого сохранения не повторяется при следующем запуске', () => {
    assert.deepEqual(again.data.levels[6], { done: true, stars: 3, hearts: 30 });
    assert.deepEqual(again.data.levels[10], { done: true, stars: 2, hearts: 26 });
    assert.deepEqual(again.data.notes, [1, 2, 3, 4, 5, 10, 6]);
    assert.equal(again.isLevelOpen(7), true);
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
