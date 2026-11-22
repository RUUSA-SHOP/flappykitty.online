/* Flappy Kitty · симуляция.
   Чистая логика без DOM и canvas: её можно гонять в Node (см. tools/bot-test.mjs).
   Рендер и звук подписываются на sim.events. */

import { WORLD, LEVELS, endlessParams, POWERUPS } from './levels.js';

const { H, GROUND, GRAVITY, FLAP, MAX_FALL, RADIUS, GATE_W } = WORLD;
const FIRST_GATE = 560; // расстояние от Мии до первых ворот
const FINISH_GAP = 1.2; // финиш стоит в 1.2 шага за последними воротами
const NEAR_MISS = 9; // просвет между Мией и краем ворот, при котором пролёт считается «впритирку»
const STREAK_STEP = 10; // каждые столько сердечек подряд — премия
const STREAK_BONUS = 2;
const FROG_Y = GROUND - 14; // на этой высоте лягушонок сидит на воде
const FROG_GRAVITY = 1500;
const FROG_WARN = 0.6; // столько секунд по воде идут круги, прежде чем лягушонок прыгнет
const BAT_WAVE = 38; // размах волны, по которой летит летучая мышь

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

export class Sim {
  constructor({ mode = 'story', levelId = 1, viewW = 400, seed = Date.now() } = {}) {
    this.mode = mode;
    this.level = mode === 'story' ? LEVELS.find((l) => l.id === levelId) || LEVELS[0] : null;
    this.viewW = viewW;
    this.rand = mulberry32(seed >>> 0);

    this.t = 0;
    this.dist = 0; // прокрутка мира (ворота, предметы)
    this.scroll = 0; // прокрутка фона — идёт всегда, даже до старта
    this.status = 'ready'; // ready → playing → (dying → lost) | won

    this.miaX = clamp(viewW * 0.28, 96, 250);
    this.hoverY = 330; // высота, на которой Мия парит до старта
    this.mia = { y: 330, vy: 0, rot: 0 };

    this.maxLives = mode === 'story' ? 3 : 1;
    this.lives = this.maxLives;
    this.lostLives = 0;
    this.shield = false;
    this.inv = 0;
    this.magnet = 0;
    this.catnip = 0;

    this.gates = [];
    this.items = [];
    this.hazards = [];
    this.emitters = [];
    this.warnings = [];
    this.wind = { state: 'idle', timer: 4, dir: 1 };
    this.cucumberTimer = 3.5;
    this.batTimer = 3;
    this.clear = 0; // 0…1 — насколько «прояснилось» после дождя (только для уровней с calmFrom)
    this.cleared = false;

    this.spawned = 0;
    this.passed = 0;
    this.hearts = 0; // собрано (с бонусами)
    this.pathHearts = 0; // собрано «обычных» сердечек — для звёзд
    this.heartsTotal = 0; // сколько обычных сердечек было на уровне
    this.streak = 0; // сердечек подряд без пропуска
    this.bestStreak = 0;
    this.nearMisses = 0; // пролётов впритирку к воротам
    this.finishX = null;
    this.deadT = 0;

    const p = this.params();
    this.speed = p.speed;
    this.theme = p.theme;
    this.nextGateX = this.miaX + FIRST_GATE;
    // Длина сюжетного уровня известна заранее: ворота стоят с постоянным шагом.
    this.trackLen = mode === 'story' ? FIRST_GATE + (this.level.gates - 1) * this.level.spacing + this.level.spacing * FINISH_GAP : 0;
    this.prevAnchor = { x: this.miaX + 200, y: 330 };

    this.events = [];
    this.fill();
  }

  params(n = this.spawned) {
    return this.mode === 'story' ? this.level : endlessParams(n);
  }

  get totalGates() {
    return this.mode === 'story' ? this.level.gates : Infinity;
  }

  /** Номер ворот, с которых уровень становится спокойным (дождь кончился). Infinity — такого места нет. */
  get calmGate() {
    const l = this.level;
    return l && l.calmFrom != null ? Math.round(l.gates * l.calmFrom) : Infinity;
  }

  /** Насколько пройден сюжетный уровень, 0..1. В бесконечном режиме всегда 0. */
  get progress() {
    return this.trackLen ? clamp(this.dist / this.trackLen, 0, 1) : 0;
  }

  emit(type, data) {
    this.events.push(data ? { type, ...data } : { type });
  }

  flap() {
    if (this.status === 'ready') {
      this.status = 'playing';
      this.emit('start');
    }
    if (this.status !== 'playing') return;
    this.mia.vy = FLAP;
    this.emit('flap');
  }

  /* ---------- генерация мира ---------- */

  fill() {
    while (this.spawned < this.totalGates && this.nextGateX - this.dist < this.viewW + 260) this.spawnGate();
    if (this.mode === 'story' && this.spawned >= this.totalGates && this.finishX == null) {
      const last = this.gates[this.gates.length - 1];
      this.finishX = last.x + this.level.spacing * FINISH_GAP;
      // дорожка сердечек к финишу
      for (let i = 1; i <= 3; i++) {
        this.addItem('heart', lerp(last.x + GATE_W, this.finishX, i / 4), lerp(last.baseY, 330, smooth(i / 4)));
      }
    }
  }

  addItem(type, x, y, extra) {
    const it = { type, x, y, taken: false, born: this.t, ...extra };
    if (type === 'heart') this.heartsTotal++;
    this.items.push(it);
    return it;
  }

  spawnGate() {
    const p = this.params();
    const r = this.rand;
    const idx = this.spawned;
    const gap = p.gap;
    const amp = p.move ? p.move * (0.6 + 0.4 * r()) : 0;
    const margin = 64 + amp;
    const lo = gap / 2 + margin;
    const hi = GROUND - gap / 2 - margin;
    const prevY = this.prevAnchor.y;
    // следующий просвет — не дальше 185 px по вертикали, чтобы всегда можно было долететь
    let baseY = clamp(prevY + (r() * 2 - 1) * 185, lo, hi);
    if (idx === 0) baseY = clamp(330 + (r() * 2 - 1) * 60, lo, hi);

    const x = this.nextGateX;
    const gate = {
      idx,
      x,
      w: GATE_W,
      gap,
      baseY,
      gapY: baseY,
      amp,
      freq: 1.1 + r() * 0.7,
      phase: r() * Math.PI * 2,
      passed: false,
      theme: p.theme,
    };
    this.gates.push(gate);

    // сердечко в просвете (едет вместе с воротами)
    this.addItem('heart', x + GATE_W / 2, baseY, { gate });

    // дорожка между воротами; в спокойной части уровня (после дождя) сердечек на ней вдвое больше
    const ax = this.prevAnchor.x;
    const span = x - ax;
    const pathY = (f) => lerp(prevY, baseY, smooth(f));
    const calm = idx >= this.calmGate;
    const trail = calm && idx > 0 ? [1 / 5, 2 / 5, 3 / 5, 4 / 5] : [1 / 3, 2 / 3];
    for (const f of trail) this.addItem('heart', ax + span * f, pathY(f));

    let midBusy = false;
    const midX = ax + span / 2;

    // бонус раз в несколько ворот
    if (p.powerups.length && idx > 0 && idx % 5 === 2) {
      const kind = p.powerups[Math.floor(r() * p.powerups.length)];
      this.addItem(kind, midX, pathY(0.5));
      midBusy = true;
    }

    const hz = idx > 0 && !calm ? p.hazards : [];
    if (hz.includes('drop') && r() < 0.6) {
      this.emitters.push({ x: midX, period: 1.7, timer: r() * 1.7 });
      midBusy = true;
    }
    // тучка: те же капли, но падают с неба и реже
    if (hz.includes('rain') && r() < 0.55) {
      this.emitters.push({ x: midX, period: 2, timer: r() * 2, kind: 'cloud', y: 74 });
      midBusy = true;
    }
    if (hz.includes('balloon') && !midBusy && r() < 0.55) {
      const side = r() < 0.5 ? -1 : 1;
      const by = clamp(pathY(0.5) + side * (78 + r() * 30), 60, GROUND - 70);
      this.hazards.push({ type: 'balloon', x: midX, y: by, y0: by, r: 22, vx: 0, phase: r() * 6.28, hue: Math.floor(r() * 4) });
      midBusy = true;
    }
    // клубок — те же два сердечка, что в шарике, только лежит ближе к пути
    if (hz.includes('yarn') && !midBusy && r() < 0.6) {
      const side = r() < 0.5 ? -1 : 1;
      const by = clamp(pathY(0.5) + side * (58 + r() * 24), 60, GROUND - 70);
      this.hazards.push({ type: 'yarn', x: midX, y: by, y0: by, r: 20, vx: 0, phase: r() * 6.28, hue: Math.floor(r() * 4) });
      midBusy = true;
    }
    // лягушонок сидит на воде и время от времени прыгает; чем выше летишь, тем безопаснее
    if (hz.includes('frog') && !midBusy && r() < 0.5) {
      // jump — скорость толчка (высота прыжка 180–260), at — в какой доле прыжка он окажется, когда Мия пролетит над ним
      this.hazards.push({ type: 'frog', x: midX, y: FROG_Y, r: 15, vx: 0, vy: 0, state: 'sit', timer: 0, jump: 735 + r() * 150, at: 0.2 + r() * 0.55 });
      midBusy = true;
    }
    // золотая рыбка — в стороне от безопасной траектории
    if (!midBusy && idx > 0 && r() < 0.2) {
      const side = pathY(0.5) > 330 ? -1 : 1;
      this.addItem('fish', midX, clamp(pathY(0.5) + side * 105, 70, GROUND - 70));
    }

    this.prevAnchor = { x: x + GATE_W, y: baseY };
    this.nextGateX = x + p.spacing;
    this.spawned++;
  }

  /* ---------- шаг симуляции ---------- */

  step(dt) {
    this.t += dt;
    const m = this.mia;

    if (this.status === 'ready') {
      this.scroll += this.speed * 0.5 * dt;
      m.y = this.hoverY + Math.sin(this.t * 3) * 9;
      m.vy = 0;
      m.rot = lerp(m.rot, 0, 0.1);
      return;
    }

    if (this.status === 'won') {
      // плавно доезжаем до центра
      this.scroll += this.speed * 0.5 * dt;
      m.y = lerp(m.y, 300, 1 - Math.pow(0.02, dt));
      m.rot = lerp(m.rot, -0.1, 0.1);
      return;
    }

    if (this.status === 'lost') return;

    if (this.status === 'dying') {
      this.deadT += dt;
      m.vy = Math.min(m.vy + GRAVITY * dt, MAX_FALL * 1.3);
      m.y += m.vy * dt;
      m.rot += 9 * dt;
      if (m.y > GROUND - RADIUS) {
        m.y = GROUND - RADIUS;
        if (m.vy > 120) m.vy = -m.vy * 0.35;
        else m.vy = 0;
      }
      if (this.deadT > 1.15) {
        this.status = 'lost';
        this.emit('lose');
      }
      return;
    }

    // --- playing ---
    const p = this.params(this.passed);
    this.speed = lerp(this.speed, p.speed, 1 - Math.pow(0.3, dt));
    if (this.theme !== p.theme) {
      this.theme = p.theme;
      this.emit('theme', { theme: p.theme });
    }
    const hazardsOn = p.hazards;

    // дождь кончился: небо светлеет (на логику не влияет, это для картинки и звука)
    if (this.passed >= this.calmGate) {
      if (!this.cleared) {
        this.cleared = true;
        this.emit('clear');
      }
      this.clear = Math.min(1, this.clear + dt / 2.5);
    }

    this.dist += this.speed * dt;
    this.scroll += this.speed * dt;
    this.fill();

    // ветер
    let windA = 0;
    if (hazardsOn.includes('wind')) {
      const w = this.wind;
      w.timer -= dt;
      if (w.state === 'idle' && w.timer <= 0) {
        w.state = 'warn';
        w.timer = 0.9;
        w.dir = this.rand() < 0.5 ? -1 : 1;
        this.emit('windWarn', { dir: w.dir });
      } else if (w.state === 'warn' && w.timer <= 0) {
        w.state = 'blow';
        w.timer = 1.4;
        this.emit('wind', { dir: w.dir });
      } else if (w.state === 'blow' && w.timer <= 0) {
        w.state = 'idle';
        w.timer = 3.4 + this.rand() * 2.2;
      }
      if (w.state === 'blow') windA = w.dir * 520;
    } else if (this.wind.state !== 'idle') {
      this.wind.state = 'idle';
    }

    // полёт
    m.vy = clamp(m.vy + (GRAVITY + windA) * dt, -700, MAX_FALL);
    m.y += m.vy * dt;
    const targetRot = clamp((m.vy / MAX_FALL) * 1.05, -0.42, 1.05);
    m.rot = lerp(m.rot, targetRot, 1 - Math.pow(0.0005, dt));

    // таймеры
    if (this.inv > 0) this.inv = Math.max(0, this.inv - dt);
    for (const k of ['magnet', 'catnip']) {
      if (this[k] > 0) {
        this[k] -= dt;
        if (this[k] <= 0) {
          this[k] = 0;
          this.emit('powerEnd', { kind: k });
        }
      }
    }

    const wx = this.dist + this.miaX; // позиция Мии в мире
    const ghost = this.inv > 0 || this.catnip > 0;

    // потолок и пол
    if (m.y < RADIUS) {
      m.y = RADIUS;
      if (m.vy < 0) m.vy = 0;
    }
    if (m.y > GROUND - RADIUS) {
      m.y = GROUND - RADIUS;
      if (!ghost) this.hit('ground');
      if (this.status === 'playing') m.vy = -430;
    }

    // ворота
    for (const g of this.gates) {
      if (g.amp) g.gapY = g.baseY + Math.sin(g.phase + this.t * g.freq) * g.amp;
      if (!g.passed && g.x + g.w < wx - RADIUS) {
        g.passed = true;
        this.passed++;
        this.emit('gate', { n: this.passed });
        // Пролёт впритирку: только для красоты, на счёт и сложность не влияет.
        if (!g.bumped && g.minClear != null && g.minClear < NEAR_MISS && this.status === 'playing') {
          this.nearMisses++;
          this.emit('near', { x: g.x + g.w, y: g.nearY, up: g.nearUp });
        }
      }
      if (this.status !== 'playing') continue;
      if (wx + RADIUS < g.x || wx - RADIUS > g.x + g.w) continue;
      const top = g.gapY - g.gap / 2;
      const bot = g.gapY + g.gap / 2;
      if (wx > g.x && wx < g.x + g.w) {
        const up = m.y - RADIUS - top;
        const down = bot - (m.y + RADIUS);
        const clear = Math.min(up, down);
        if (g.minClear == null || clear < g.minClear) {
          g.minClear = clear;
          g.nearUp = up < down;
          g.nearY = up < down ? top : bot;
        }
      }
      if (circleRect(wx, m.y, RADIUS, g.x, -2000, g.w, top + 2000) || circleRect(wx, m.y, RADIUS, g.x, bot, g.w, GROUND - bot + 400)) {
        g.bumped = true;
        if (ghost) {
          // не даём неуязвимости закончиться внутри препятствия
          if (this.inv > 0) this.inv = Math.max(this.inv, 0.15);
          if (this.catnip > 0 && this.catnip < 0.15) this.inv = Math.max(this.inv, 0.2);
        } else this.hit('gate');
      }
    }

    // капли из кранов
    for (const e of this.emitters) {
      const sx = e.x - this.dist;
      if (sx < -40 || sx > this.viewW + 60) continue;
      e.timer -= dt;
      if (e.timer <= 0) {
        e.timer += e.period;
        this.hazards.push({ type: 'drop', x: e.x, y: e.kind === 'cloud' ? e.y + 20 : 26, vx: 0, vy: 150, r: 9 });
      }
    }

    // огурцы
    if (hazardsOn.includes('cucumber')) {
      this.cucumberTimer -= dt;
      if (this.cucumberTimer <= 0) {
        this.cucumberTimer = 3.4 + this.rand() * 2.4;
        const y = clamp(m.y + (this.rand() * 2 - 1) * 70, 70, GROUND - 70);
        this.warnings.push({ y, timer: 0.95 });
        this.emit('warn', { y });
      }
    }
    // летучие мыши: как огурцы, но летят широкой волной вокруг отмеченной высоты
    if (hazardsOn.includes('bat')) {
      this.batTimer -= dt;
      if (this.batTimer <= 0) {
        this.batTimer = 3.3 + this.rand() * 2.3;
        const y = clamp(m.y + (this.rand() * 2 - 1) * 60, 110, GROUND - 110);
        this.warnings.push({ y, timer: 0.95, kind: 'bat' });
        this.emit('warn', { y, kind: 'bat' });
      }
    }
    for (const w of this.warnings) {
      w.timer -= dt;
      if (w.timer <= 0) {
        const x = this.dist + this.viewW + 40;
        if (w.kind === 'bat') this.hazards.push({ type: 'bat', x, y: w.y, y0: w.y, vx: -100, r: 14, amp: BAT_WAVE, phase: this.rand() * 6.28 });
        else this.hazards.push({ type: 'cucumber', x, y: w.y, y0: w.y, vx: -115, r: 15, phase: this.rand() * 6.28 });
        w.done = true;
      }
    }
    if (this.warnings.length) this.warnings = this.warnings.filter((w) => !w.done);

    // опасности
    for (const h of this.hazards) {
      if (h.type === 'drop') {
        h.vy = Math.min(h.vy + 500 * dt, 330);
        h.y += h.vy * dt;
        if (h.y > GROUND - 6) {
          h.dead = true;
          this.emit('splash', { x: h.x, y: GROUND });
        }
      } else if (h.type === 'balloon' || h.type === 'yarn') {
        h.y = h.y0 + Math.sin(h.phase + this.t * 1.6) * 10;
      } else if (h.type === 'cucumber') {
        h.x += h.vx * dt;
        h.y = h.y0 + Math.sin(h.phase + this.t * 5) * 8;
      } else if (h.type === 'bat') {
        h.x += h.vx * dt;
        h.y = h.y0 + Math.sin(h.phase + this.t * 3.2) * h.amp;
      } else if (h.type === 'frog') {
        const sx = h.x - this.dist;
        if (h.state === 'sit') {
          // Прыгает один раз — так, чтобы оказаться в воздухе, когда Мия будет над ним.
          // Круги по воде начинаются, только когда лягушонок уже виден: предупреждение нельзя пропустить.
          const air = (2 * h.jump) / FROG_GRAVITY;
          const lead = Math.min(this.speed * (FROG_WARN + h.at * air), this.viewW - this.miaX - 24);
          if (!h.done && sx - this.miaX <= lead && sx > this.miaX) {
            h.done = true;
            h.state = 'warn';
            h.timer = FROG_WARN;
            this.emit('croak', { x: h.x, y: GROUND });
          }
        } else if (h.state === 'warn') {
          h.timer -= dt;
          if (h.timer <= 0) {
            h.state = 'jump';
            h.vy = -h.jump;
          }
        } else {
          h.vy += FROG_GRAVITY * dt;
          h.y += h.vy * dt;
          if (h.y >= FROG_Y) {
            h.y = FROG_Y;
            h.vy = 0;
            h.state = 'sit';
            this.emit('splash', { x: h.x, y: GROUND });
          }
        }
      }
      if (h.dead || this.status !== 'playing') continue;
      const dx = h.x - wx;
      const dy = h.y - m.y;
      const rr = h.r + RADIUS - 3;
      if (dx * dx + dy * dy < rr * rr) {
        if (h.type === 'balloon' || h.type === 'yarn') {
          h.dead = true;
          this.hearts += 2;
          this.emit('pop', { x: h.x, y: h.y, hue: h.hue, kind: h.type });
        } else if (!ghost) {
          h.dead = true;
          this.hit(h.type);
        } else if (this.catnip > 0) {
          h.dead = true;
          this.emit('pop', { x: h.x, y: h.y, hue: 9 });
        }
      }
    }

    // предметы
    const pull = this.magnet > 0 || this.catnip > 0;
    for (const it of this.items) {
      if (it.taken) continue;
      if (it.type === 'heart' && !it.missed && it.x < wx - 70) {
        // сердечко осталось позади — серия прерывается
        it.missed = true;
        this.breakStreak();
      }
      if (it.gate && !it.pulled) it.y = it.gate.gapY;
      let dx = wx - it.x;
      let dy = m.y - it.y;
      let d2 = dx * dx + dy * dy;
      if (pull && it.type !== 'shield' && it.type !== 'magnet' && it.type !== 'catnip' && d2 < 190 * 190 && it.x - this.dist < this.viewW) {
        const d = Math.sqrt(d2) || 1;
        const v = 560 * dt;
        it.pulled = true;
        it.x += (dx / d) * Math.min(v, d) + this.speed * dt * 0.9;
        it.y += (dy / d) * Math.min(v, d);
        dx = wx - it.x;
        dy = m.y - it.y;
        d2 = dx * dx + dy * dy;
      }
      const rr = RADIUS + 20;
      if (this.status === 'playing' && d2 < rr * rr) {
        it.taken = true;
        this.collect(it);
      }
    }

    // чистка ушедшего за экран
    const cut = this.dist - 160;
    if (this.gates.length && this.gates[0].x < cut) this.gates = this.gates.filter((g) => g.x >= cut);
    if (this.items.length > 40 || (this.items[0] && this.items[0].x < cut)) this.items = this.items.filter((i) => !i.taken && i.x >= cut);
    this.hazards = this.hazards.filter((h) => !h.dead && h.x >= cut);
    this.emitters = this.emitters.filter((e) => e.x >= cut);

    // финиш
    if (this.status === 'playing' && this.finishX != null && wx >= this.finishX) {
      this.status = 'won';
      this.emit('win');
    }
  }

  collect(it) {
    switch (it.type) {
      case 'heart':
        this.hearts++;
        this.pathHearts++;
        this.streak++;
        if (this.streak > this.bestStreak) this.bestStreak = this.streak;
        this.emit('heart', { x: it.x, y: it.y, streak: this.streak });
        // каждые десять подряд — маленькая премия; на звёзды она не влияет
        if (this.streak % STREAK_STEP === 0) {
          this.hearts += STREAK_BONUS;
          this.emit('streak', { n: this.streak, bonus: STREAK_BONUS });
        }
        break;
      case 'fish':
        this.hearts += 5;
        this.emit('fish', { x: it.x, y: it.y });
        break;
      case 'shield':
        this.shield = true;
        this.emit('power', { kind: 'shield', x: it.x, y: it.y });
        break;
      case 'magnet':
      case 'catnip':
        this[it.type] = POWERUPS[it.type].time;
        this.emit('power', { kind: it.type, x: it.x, y: it.y });
        break;
    }
  }

  breakStreak() {
    if (this.streak >= 5) this.emit('streakEnd', { n: this.streak });
    this.streak = 0;
  }

  hit(cause) {
    if (this.status !== 'playing') return;
    const m = this.mia;
    this.breakStreak();
    if (this.shield) {
      this.shield = false;
      this.inv = 1.3;
      m.vy = -300;
      this.emit('shieldBreak', { cause });
      return;
    }
    this.lives--;
    this.lostLives++;
    if (this.lives > 0) {
      this.inv = 2;
      m.vy = -340;
      this.emit('hit', { cause, lives: this.lives });
    } else {
      this.status = 'dying';
      this.deadT = 0;
      m.vy = -360;
      this.emit('hit', { cause, lives: 0 });
      this.emit('dying');
    }
  }

  /** Звёзды за уровень — по одной за каждую цель: долетела, собрала 70% сердечек, не потеряла ни одной жизни.
      Сколько галочек на экране победы, столько и звёзд. */
  stars() {
    if (this.status !== 'won') return 0;
    const ratio = this.heartsTotal ? this.pathHearts / this.heartsTotal : 1;
    return 1 + (ratio >= 0.7 ? 1 : 0) + (this.lostLives === 0 ? 1 : 0);
  }
}

function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export { H, GROUND, RADIUS };
