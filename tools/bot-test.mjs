/* Проверка баланса: бот-«автопилот» пролетает каждый уровень много раз.
   Запуск: npm test
   Если бот стабильно проходит уровень — уровень точно проходим человеком
   (бот не видит ни капель, ни огурцов — только правило «держись центра просвета»). */

import { Sim } from '../assets/js/game/sim.js';
import { LEVELS, WORLD } from '../assets/js/game/levels.js';

const DT = 1 / 120;

function botStep(sim, skill) {
  const m = sim.mia;
  const wx = sim.dist + sim.miaX;
  const g = sim.gates.find((g) => g.x + g.w > wx - WORLD.RADIUS);
  let target = 330;
  if (g) {
    target = g.gapY + 22;
    const far = g.x - wx;
    if (far > 230) target = m.y * 0.4 + target * 0.6;
  } else if (sim.finishX) target = 330;
  // бот «слепой»: капли и огурцы он не видит — человеку проще
  target += skill.noise * Math.sin(sim.t * 7.3 + skill.phase);
  if (m.y + m.vy * 0.07 > target) sim.flap();
}

function run(opts, skill, maxT = 400) {
  const sim = new Sim(opts);
  sim.flap();
  let steps = 0;
  while (sim.status !== 'won' && sim.status !== 'lost' && sim.t < maxT) {
    // человек не жмёт чаще ~8 раз в секунду
    if (steps % 15 === 0) botStep(sim, skill);
    sim.step(DT);
    sim.events.length = 0;
    steps++;
  }
  return sim;
}

let failed = false;
const RUNS = 150;
console.log('Сюжет: бот × ' + RUNS + ' забегов на уровень (экран телефона 380 и десктоп 960)\n');
for (const viewW of [380, 960]) {
  for (const lvl of LEVELS) {
    let wins = 0, lost = 0, stars = 0, time = 0, hearts = 0, total = 0;
    for (let i = 0; i < RUNS; i++) {
      const sim = run({ mode: 'story', levelId: lvl.id, viewW, seed: 1000 + i * 7919 }, { noise: 14, phase: i });
      if (sim.status === 'won') { wins++; stars += sim.stars(); time += sim.t; }
      lost += sim.lostLives; hearts += sim.pathHearts; total += sim.heartsTotal;
    }
    const pct = Math.round((wins / RUNS) * 100);
    console.log(
      `W=${viewW}  ур.${lvl.id} ${lvl.name.padEnd(16)} побед ${String(pct).padStart(3)}%  ` +
      `жизней теряет ${(lost / RUNS).toFixed(2)}  звёзд ${(stars / Math.max(1, wins)).toFixed(2)}  ` +
      `длится ${(time / Math.max(1, wins)).toFixed(0)}с  сердечек ${Math.round((hearts / total) * 100)}%`
    );
    if (pct < 60) failed = true;
  }
}

console.log('\nБесконечный режим (одна жизнь):');
for (const viewW of [380, 960]) {
  const scores = [];
  for (let i = 0; i < RUNS; i++) scores.push(run({ mode: 'endless', viewW, seed: 5000 + i * 104729 }, { noise: 14, phase: i }, 900).passed);
  scores.sort((a, b) => a - b);
  console.log(`W=${viewW}  медиана ${scores[RUNS >> 1]}  макс ${scores[RUNS - 1]}  мин ${scores[0]}`);
  if (scores[RUNS >> 1] < 5) failed = true;
}

if (failed) { console.error('\n✗ Баланс сломан: какой-то уровень слишком сложный.'); process.exit(1); }
console.log('\n✓ Все уровни проходимы.');
