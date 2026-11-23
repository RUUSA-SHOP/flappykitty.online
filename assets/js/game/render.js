/* Flappy Kitty · отрисовка. Читает состояние Sim и рисует кадр. */

import { WORLD, POWERUPS } from './levels.js';
import { THEMES, hash, heartPath, rr } from './themes.js';

const G = WORLD.GROUND;
const TAU = Math.PI * 2;
const lerp = (a, b, f) => a + (b - a) * f;
const FONT = 'Nunito, system-ui, sans-serif';
const BALLOON_COLORS = ['#F58CA5', '#F4C97B', '#9CC7E8', '#C9A7E8'];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.time = 0;
    this.trauma = 0; // «встряска» 0…1: тряска кадра пропорциональна её квадрату и быстро гаснет
    this.stretch = 1; // растяжение Мии по вертикали: >1 вытянулась (взмах), <1 сплющилась (удар)
    this.stretchV = 0;
    this.fest = false; // праздник: снизу вверх летят сердечки (финальное письмо)
    this.festT = 0;
    this.hudHeart = null; // куда улетают собранные сердечки — координаты счётчика в мире
    this.scale = 1;
    this.flash = 0;
    this.flashColor = '255,255,255';
    this.wingT = 1;
    this.trailT = 0;
    this.viewW = 400;
    this.viewH = 720;
    this.k = 1;
    this.offY = 0;
    this.skin = null;
    this.sticker = null;
    this.finishLabel = '';
    this.reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Подгоняет холст под размер контейнера. Возвращает ширину мира в условных пикселях. */
  resize() {
    const cssW = this.canvas.clientWidth || 400;
    const cssH = this.canvas.clientHeight || 720;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(cssH / WORLD.H, cssW / 380);
    this.viewW = cssW / scale;
    this.viewH = cssH / scale;
    this.scale = scale;
    this.k = scale * dpr;
    // на высоких экранах мир сдвигается вниз: сверху остаётся место под счётчики
    this.offY = Math.max(0, Math.min(60, (this.viewH - WORLD.H) * 0.55));
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return this.viewW;
  }

  /** Точка мира → точка на экране (CSS-пиксели от левого верхнего угла холста). */
  toCss(x, y) {
    return { x: x * this.scale, y: (y + this.offY) * this.scale };
  }
  /** Точка на экране → точка мира. */
  toWorld(cx, cy) {
    return { x: cx / this.scale, y: cy / this.scale - this.offY };
  }

  addTrauma(v) {
    this.trauma = Math.min(1, this.trauma + v);
  }

  /** Мию «потрогали» в меню: она подпрыгивает и рассыпает сердечки. */
  poke(sim) {
    this.stretch = 1.22;
    this.wingT = 0;
    this.burst(sim.miaX, sim.mia.y - 10, this.reduceMotion ? 5 : 10, ['#FF5C7A', '#FFB3C6', '#FFFFFF'], 230, 'heart');
  }

  setSkin(skin, img) {
    this.skin = skin;
    this.sticker = makeSticker(img, skin.w);
  }

  /* ---------- эффекты по событиям симуляции ---------- */

  handle(ev, sim) {
    const sx = (ev.x != null ? ev.x : sim.dist + sim.miaX) - sim.dist;
    const sy = ev.y != null ? ev.y : sim.mia.y;
    const mx = sim.miaX;
    const my = sim.mia.y;
    switch (ev.type) {
      case 'flap':
        this.wingT = 0;
        this.stretch = 1.16;
        this.puff(mx - 26, my + 14, 2, 'rgba(255,255,255,.8)', 60);
        break;
      case 'heart': {
        // чем длиннее серия, тем богаче искры
        const lvl = Math.min(10, ev.streak || 1);
        this.burst(sx, sy, 5 + Math.floor(lvl / 2), ['#FF5C7A', '#FFB3C6', '#FFFFFF'], 150 + lvl * 8, 'spark');
        if (this.hudHeart && !this.reduceMotion) {
          this.particles.push({ kind: 'fly', x: sx, y: sy, x0: sx, y0: sy, tx: this.hudHeart.x, ty: this.hudHeart.y, vx: 0, vy: 0, g: 0, life: 0, max: 0.45, size: 11, color: '#FF5C7A', rot: 0, vr: 0 });
        }
        break;
      }
      case 'streak':
        this.ring(mx, my, '#FFC94A');
        this.burst(mx, my, 14, ['#FFC94A', '#FFE9A6', '#FFFFFF', '#FF5C7A'], 260, 'spark');
        this.text(mx, my - 58, `${ev.n} подряд! +${ev.bonus}`, '#FFC94A');
        break;
      case 'near':
        // искры от края ворот, мимо которого Мия прошла впритирку
        for (let i = 0; i < 7; i++) {
          this.particles.push({
            kind: 'spark', x: mx + (Math.random() - 0.5) * 30, y: sy, vx: -120 - Math.random() * 160, vy: (ev.up ? 1 : -1) * (30 + Math.random() * 120), g: 200,
            life: 0, max: 0.35 + Math.random() * 0.3, size: 2.6 + Math.random() * 2.4, color: ['#FFFFFF', '#FFE9A6'][i % 2], rot: Math.random() * 6, vr: 10,
          });
        }
        this.text(mx, my + (ev.up ? 50 : -50), 'Впритирку!', '#FFFFFF');
        break;
      case 'fish':
        this.burst(sx, sy, 10, ['#FFC94A', '#FFE9A6', '#FFFFFF'], 220, 'spark');
        this.text(sx, sy - 20, '+5', '#FFC94A');
        break;
      case 'pop':
        if (ev.kind === 'yarn') {
          // клубок разматывается: мягкие пушинки и два сердечка
          this.burst(sx, sy, 10, ['#FFFFFF', '#FFE3EC', '#F4C97B', '#C9A7E8'], 190, 'puff');
          this.burst(sx, sy, 4, ['#FF5C7A', '#FFB3C6'], 170, 'heart');
        } else this.burst(sx, sy, 16, ['#F58CA5', '#F4C97B', '#9CC7E8', '#FFFFFF', '#9CC79A'], 280, 'confetti');
        if (ev.hue !== 9) this.text(sx, sy - 24, '+2', '#FF5C7A');
        break;
      case 'clear':
        // дождь кончился
        this.flash = 0.35;
        this.flashColor = '255,244,214';
        this.text(mx, my - 58, 'Дождь кончился!', '#FFC94A');
        this.burst(mx, my, 12, ['#FF8FA8', '#FFE27A', '#9ED99A', '#8CC8F2', '#C3A6EC'], 240, 'heart');
        break;
      case 'croak':
        this.text(sx, G - 96, 'Ква!', '#3F8F45');
        break;
      case 'power':
        this.ring(sx, sy, POWERUPS[ev.kind].color);
        this.text(mx, my - 54, POWERUPS[ev.kind].name + '!', POWERUPS[ev.kind].color);
        break;
      case 'shieldBreak':
        this.ring(mx, my, '#8FD3F4');
        this.burst(mx, my, 12, ['#BFE9FF', '#FFFFFF'], 260, 'spark');
        this.text(mx, my - 54, 'Пузырь лопнул', '#8FD3F4');
        this.addTrauma(0.45);
        this.stretch = 0.84;
        break;
      case 'hit':
        this.addTrauma(ev.lives > 0 ? 0.7 : 0.95);
        this.stretch = 0.7;
        this.flash = 0.35;
        this.flashColor = '255,92,122';
        this.burst(mx, my, 12, ['#E8C08A', '#D9A066', '#FFF3E0'], 260, 'puff');
        this.text(mx, my - 54, ev.lives > 0 ? 'Ой!' : 'Кусь!', '#FF5C7A');
        break;
      case 'splash':
        this.burst(sx, G - 4, 4, ['#8FD3F4', '#D6F0FF'], 120, 'spark');
        break;
      case 'theme':
        this.flash = 0.6;
        this.flashColor = '255,255,255';
        break;
      case 'win': {
        this.flash = 0.5;
        this.flashColor = '255,255,255';
        // большое сердце на финише «лопается» кольцами и конфетти; в последнем раунде — щедрее
        const big = sim.round && sim.round.finale; // в конце каждого раунда — большое сердце с именем
        const fx = sim.finishX != null ? sim.finishX - sim.dist : mx;
        this.ring(fx, 320, '#FF5C7A');
        this.ring(fx, 320, '#FFFFFF');
        this.burst(fx, 320, big ? 40 : 22, ['#F58CA5', '#F4C97B', '#9CC7E8', '#FFFFFF', '#FF5C7A'], 420, 'confetti');
        this.addTrauma(0.3);
        this.stretch = 1.2;
        for (let i = 0; i < (big ? 80 : 46); i++) {
          this.particles.push({
            kind: 'heart', x: this.viewW * Math.random(), y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 60, vy: 120 + Math.random() * 160,
            g: 30, life: 0, max: 3.5 + Math.random() * 2, size: 7 + Math.random() * 9, color: ['#FF5C7A', '#FFB3C6', '#FFFFFF', '#FFC94A'][i % 4], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 4,
          });
        }
        this.burst(mx, my, 20, ['#FF5C7A', '#FFB3C6', '#FFFFFF'], 320, 'heart');
        break;
      }
    }
  }

  burst(x, y, n, colors, speed, kind) {
    const turn = Math.random() * TAU;
    for (let i = 0; i < n; i++) {
      // частицы расходятся ровным кругом с небольшой случайностью — без «дыр» и комков
      const a = turn + ((i + (Math.random() - 0.5) * 0.7) / n) * TAU;
      const v = speed * (0.35 + Math.random() * 0.65);
      this.particles.push({
        kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, g: kind === 'spark' ? 300 : 420, life: 0, max: 0.45 + Math.random() * 0.45,
        size: kind === 'puff' ? 5 + Math.random() * 6 : kind === 'heart' ? 6 + Math.random() * 6 : 3 + Math.random() * 3.5,
        color: colors[i % colors.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12,
      });
    }
  }
  puff(x, y, n, color, speed) {
    for (let i = 0; i < n; i++)
      this.particles.push({ kind: 'puff', x, y, vx: -speed - Math.random() * 40, vy: 30 + Math.random() * 50, g: 0, life: 0, max: 0.4, size: 4 + Math.random() * 3, color, rot: 0, vr: 0 });
  }
  ring(x, y, color) {
    this.particles.push({ kind: 'ring', x, y, vx: 0, vy: 0, g: 0, life: 0, max: 0.5, size: 20, color, rot: 0, vr: 0 });
  }
  text(x, y, text, color) {
    this.particles.push({ kind: 'text', x: Math.max(60, Math.min(this.viewW - 60, x)), y, vx: 0, vy: -46, g: 0, life: 0, max: 0.95, size: 22, color, text, rot: 0, vr: 0 });
  }

  /* ---------- кадр ---------- */

  draw(sim, dt) {
    const ctx = this.ctx;
    const W = this.viewW;
    const VH = this.viewH;
    const t = (this.time += dt);
    const theme = THEMES[sim.theme] || THEMES.living;
    const playing = sim.status === 'playing';

    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    ctx.save();
    if (this.trauma > 0.02 && !this.reduceMotion) {
      // Сила тряски — квадрат «встряски»: слабые события едва заметны, сильные ощутимы.
      // Смещение берём из плавных синусоид, а не из случайных чисел, — кадр качается, а не дрожит.
      const p = this.trauma * this.trauma;
      const ox = 15 * p * (Math.sin(t * 71) * 0.6 + Math.sin(t * 43.3 + 1.7) * 0.4);
      const oy = 15 * p * (Math.sin(t * 59 + 0.6) * 0.6 + Math.sin(t * 37.1 + 2.9) * 0.4);
      // чуть увеличиваем кадр, чтобы при тряске не оголялись края
      ctx.translate(W / 2, VH / 2);
      ctx.scale(1.05, 1.05);
      ctx.rotate(0.022 * p * Math.sin(t * 47 + 0.9));
      ctx.translate(-W / 2 + ox, -VH / 2 + oy);
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.9);

    // праздник: сердечки поднимаются снизу, пока открыто финальное письмо
    if (this.fest && dt > 0) {
      this.festT -= dt;
      if (this.festT <= 0) {
        this.festT = this.reduceMotion ? 0.7 : 0.16;
        this.particles.push({
          kind: 'heart', x: Math.random() * W, y: G + 60, vx: (Math.random() - 0.5) * 30, vy: -(70 + Math.random() * 90), g: -6, life: 0, max: 7 + Math.random() * 3,
          size: 6 + Math.random() * 11, color: ['#FF5C7A', '#FFB3C6', '#FFFFFF', '#FFC94A'][Math.floor(Math.random() * 4)], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 3,
        });
      }
    }
    ctx.translate(0, this.offY);

    // clear — насколько прояснилось после дождя (0…1); остальным темам это число не нужно
    const clear = sim.clear || 0;
    theme.sky(ctx, W, VH, t, clear);
    theme.far(ctx, W, sim.scroll, t, clear);
    this.ambient(theme.ambient, W, sim.scroll, t, clear);

    const wx = (x) => x - sim.dist;

    // финиш
    if (sim.finishX != null) {
      const fx = wx(sim.finishX);
      if (fx < W + 200) this.finish(fx, t);
    }

    // ворота
    for (const g of sim.gates) {
      const x = wx(g.x);
      if (x > W + 20 || x + g.w < -20) continue;
      const th = THEMES[g.theme] || theme;
      const top = g.gapY - g.gap / 2;
      const bot = g.gapY + g.gap / 2;
      th.column(ctx, x, -130, g.w, top + 130, 'bottom', g.idx + 0.5, t);
      th.column(ctx, x, bot, g.w, G - bot + 30, 'top', g.idx, t);
    }

    // краны на потолке и дождевые тучки
    for (const e of sim.emitters) {
      const x = wx(e.x);
      if (x < -70 || x > W + 70) continue;
      if (e.kind === 'cloud') this.cloud(x, e.y, t, clear);
      else this.tap(x);
    }

    // предметы
    for (const it of sim.items) {
      if (it.taken) continue;
      const x = wx(it.x);
      if (x < -40 || x > W + 40) continue;
      const bob = Math.sin(t * 4 + it.x * 0.02) * 3.5;
      if (it.type === 'heart') this.heart(x, it.y + bob, 12 + Math.sin(t * 6 + it.x * 0.05) * 1.2);
      else if (it.type === 'fish') this.fish(x, it.y + bob, t);
      else this.powerup(x, it.y + bob, it.type, t);
    }

    // опасности
    for (const h of sim.hazards) {
      const x = wx(h.x);
      if (x < -60 || x > W + 60) continue;
      if (h.type === 'drop') this.drop(x, h.y);
      else if (h.type === 'balloon') this.balloon(x, h.y, h.hue, t);
      else if (h.type === 'cucumber') this.cucumber(x, h.y, t);
      else if (h.type === 'yarn') this.yarn(x, h.y, h.hue, t);
      else if (h.type === 'bat') this.bat(x, h.y, t);
      else if (h.type === 'frog') this.frog(x, h, t);
      else if (h.type === 'dust') this.dustBall(x, h.y, t);
      else if (h.type === 'roomba') {
        if (h.pull > 0) this.suction(x, h.y, sim.miaX, sim.mia.y, h.pull, t);
        this.roomba(x, h.y, t);
      }
      else if (h.type === 'bubble') this.bubble(x, h.y, t);
      else if (h.type === 'bird') this.bird(x, h, t);
      else if (h.type === 'bun') this.bun(x, h.y, t);
      else if (h.type === 'soldier') this.soldier(x, h.y, t);
      else if (h.type === 'ember') this.ember(x, h, t);
      else if (h.type === 'steam') this.steam(x, h, t);
      else if (h.type === 'lightning') this.bolt(x, h, t);
    }

    // след
    if (playing && !this.reduceMotion) {
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = sim.catnip > 0 ? 0.025 : 0.07;
        const rainbow = ['#FF5C7A', '#FFB84A', '#FFE66B', '#8FD17F', '#7FB7E6', '#C9A7E8'];
        this.particles.push({
          kind: sim.catnip > 0 ? 'spark' : 'dot', x: sim.miaX - 30, y: sim.mia.y + 8 + (Math.random() - 0.5) * 16, vx: -sim.speed * 0.8, vy: (Math.random() - 0.5) * 20, g: 0,
          life: 0, max: sim.catnip > 0 ? 0.7 : 0.5, size: sim.catnip > 0 ? 5 : 3.2,
          color: sim.catnip > 0 ? rainbow[Math.floor(t * 20) % 6] : theme.dark ? 'rgba(255,240,210,.9)' : 'rgba(255,255,255,.95)', rot: 0, vr: 6,
        });
      }
    }

    this.mia(sim, t, dt);
    this.drawParticles(dt, sim, playing);

    theme.ground(ctx, W, VH, sim.scroll);

    // предупреждения
    for (const w of sim.warnings) this.warning(W, w.y, t, w.kind);
    if (sim.wind.state !== 'idle') this.wind(sim, W, t);

    ctx.restore();

    // вспышки на весь экран отключаются вместе с остальной анимацией («уменьшить движение»)
    if (this.reduceMotion) this.flash = 0;
    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(${this.flashColor},${this.flash})`;
      ctx.fillRect(0, 0, W, VH);
      this.flash *= Math.pow(0.004, dt);
    }
  }

  ambient(kind, W, scroll, t, clear = 0) {
    const ctx = this.ctx;
    if (kind === 'rain' && clear >= 1) return;
    const n = kind === 'snow' ? 46 : kind === 'rain' ? 38 : 26;
    for (let i = 0; i < n; i++) {
      const a = hash(i + 1);
      const b = hash(i + 77);
      const c = hash(i + 150);
      const span = W + 60;
      let x, y;
      const mod = (v, m) => ((v % m) + m) % m;
      switch (kind) {
        case 'dust':
          x = mod(a * span - scroll * 0.3 - t * 6, span) - 30;
          y = mod(b * G - t * (4 + c * 8), G);
          ctx.fillStyle = `rgba(255,255,255,${0.35 + c * 0.4})`;
          ctx.beginPath();
          ctx.arc(x, y, 1.5 + c * 2, 0, TAU);
          ctx.fill();
          break;
        case 'steam':
          x = mod(a * span - scroll * 0.35, span) - 30 + Math.sin(t + i) * 10;
          y = mod(b * G - t * (14 + c * 18), G);
          ctx.fillStyle = `rgba(255,255,255,${0.16 + c * 0.2})`;
          ctx.beginPath();
          ctx.arc(x, y, 8 + c * 14, 0, TAU);
          ctx.fill();
          break;
        case 'confetti': {
          x = mod(a * span - scroll * 0.4 + Math.sin(t * 2 + i) * 14, span) - 30;
          y = mod(b * G + t * (26 + c * 40), G);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(t * (1 + c * 3) + i);
          ctx.fillStyle = ['#F58CA5', '#F4C97B', '#9CC79A', '#FFFFFF', '#C9A7E8'][i % 5];
          ctx.globalAlpha = 0.75;
          ctx.fillRect(-4, -2, 8, 4 * Math.abs(Math.cos(t * 3 + i)) + 1);
          ctx.restore();
          break;
        }
        case 'fireflies': {
          x = mod(a * span - scroll * 0.3 + Math.sin(t * 0.7 + i) * 26, span) - 30;
          y = 300 + b * 320 + Math.cos(t * 0.9 + i * 2) * 18;
          const al = 0.35 + 0.5 * Math.abs(Math.sin(t * 1.5 + i));
          ctx.fillStyle = `rgba(255,224,130,${al * 0.25})`;
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, TAU);
          ctx.fill();
          ctx.fillStyle = `rgba(255,236,170,${al})`;
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, TAU);
          ctx.fill();
          break;
        }
        case 'snow':
          x = mod(a * span - scroll * (0.3 + c * 0.3) + Math.sin(t * 1.2 + i) * 16, span) - 30;
          y = mod(b * G + t * (40 + c * 60), G);
          ctx.fillStyle = `rgba(255,255,255,${0.6 + c * 0.4})`;
          ctx.beginPath();
          ctx.arc(x, y, 1.6 + c * 2.8, 0, TAU);
          ctx.fill();
          break;
        case 'rain': {
          // косые струйки; когда проясняется, они редеют и гаснут
          if (i >= n * (1 - clear)) break;
          const fall = t * (430 + c * 220);
          y = mod(b * (G + 40) + fall, G + 40) - 20;
          x = mod(a * span - scroll * 0.4 - fall * 0.22, span) - 30;
          ctx.strokeStyle = `rgba(232,240,255,${(0.3 + c * 0.35) * (1 - clear)})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 4.5, y + 20 + c * 10);
          ctx.stroke();
          break;
        }
        case 'pollen': {
          // золотая пыльца над прудом
          x = mod(a * span - scroll * 0.3 + Math.sin(t * 0.8 + i) * 22, span) - 30;
          y = mod(b * G - t * (6 + c * 10) + Math.cos(t + i * 3) * 10, G);
          const al = 0.4 + 0.45 * Math.abs(Math.sin(t * 1.3 + i));
          ctx.fillStyle = `rgba(255,236,150,${al * 0.3})`;
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, TAU);
          ctx.fill();
          ctx.fillStyle = `rgba(255,250,214,${al})`;
          ctx.beginPath();
          ctx.arc(x, y, 1.8 + c * 1.4, 0, TAU);
          ctx.fill();
          break;
        }
        case 'embers': {
          // розовые искры поднимаются от свечей
          x = mod(a * span - scroll * 0.35 + Math.sin(t * 1.1 + i) * 16, span) - 30;
          y = mod(b * G - t * (20 + c * 30), G);
          const al = 0.35 + 0.55 * Math.abs(Math.sin(t * 2 + i * 1.7));
          ctx.fillStyle = `rgba(255,120,180,${al * 0.28})`;
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, TAU);
          ctx.fill();
          ctx.fillStyle = `rgba(255,214,234,${al})`;
          ctx.beginPath();
          ctx.arc(x, y, 1.4 + c * 1.4, 0, TAU);
          ctx.fill();
          break;
        }
        case 'hearts':
          x = mod(a * span - scroll * 0.35 + Math.sin(t + i) * 12, span) - 30;
          y = mod(b * G - t * (16 + c * 22), G);
          ctx.fillStyle = `rgba(255,255,255,${0.28 + c * 0.3})`;
          heartPath(ctx, x, y, 5 + c * 6);
          ctx.fill();
          break;
      }
    }
  }

  finish(x, t) {
    const ctx = this.ctx;
    const pulse = 1 + Math.sin(t * 3) * 0.06;
    const beam = ctx.createLinearGradient(x - 70, 0, x + 70, 0);
    beam.addColorStop(0, 'rgba(255,255,255,0)');
    beam.addColorStop(0.5, 'rgba(255,255,255,.5)');
    beam.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = beam;
    ctx.fillRect(x - 70, 0, 140, G);
    ctx.save();
    ctx.translate(x, 320);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = 'rgba(255,92,122,.7)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#FF5C7A';
    heartPath(ctx, 0, 0, 62);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath();
    ctx.ellipse(-34, -28, 10, 18, 0.6, 0, TAU);
    ctx.fill();
    if (this.finishLabel) {
      ctx.font = `900 22px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(this.finishLabel, 0, -4);
    }
    ctx.restore();
    for (let i = 0; i < 6; i++) {
      const a = t * 1.2 + (i * TAU) / 6;
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      star(ctx, x + Math.cos(a) * 112, 320 + Math.sin(a) * 96, 5 + Math.sin(t * 5 + i) * 2);
    }
  }

  tap(x) {
    const ctx = this.ctx;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#B5ADA2';
    ctx.lineWidth = 2;
    rr(ctx, x - 8, -100, 16, 116, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#D9B36A';
    ctx.strokeStyle = '#8A6420';
    rr(ctx, x - 10, 14, 20, 12, 4);
    ctx.fill();
    ctx.stroke();
  }

  /** Дождевая тучка: из неё падают капли. Когда проясняется — белеет. */
  cloud(x, y, t, clear = 0) {
    const ctx = this.ctx;
    const bob = Math.sin(t * 1.4 + x * 0.01) * 2;
    ctx.save();
    ctx.translate(x, y + bob);
    const path = () => {
      ctx.beginPath();
      ctx.ellipse(0, 6, 44, 15, 0, 0, TAU);
      ctx.ellipse(-20, -5, 21, 17, 0, 0, TAU);
      ctx.ellipse(7, -12, 25, 21, 0, 0, TAU);
      ctx.ellipse(27, 0, 17, 13, 0, 0, TAU);
    };
    ctx.lineJoin = 'round';
    ctx.strokeStyle = clear > 0.5 ? '#9DB4D6' : '#3D4A70';
    ctx.lineWidth = 5;
    path();
    ctx.stroke();
    ctx.fillStyle = clear > 0.5 ? '#FFFFFF' : '#7785AE';
    path();
    ctx.fill();
    ctx.fillStyle = clear > 0.5 ? 'rgba(210,226,246,.8)' : 'rgba(255,255,255,.22)';
    ctx.beginPath();
    ctx.ellipse(-12, -12, 12, 6, -0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /** Клубок пряжи: не опасен, за него дают два сердечка. */
  yarn(x, y, hue, t) {
    const ctx = this.ctx;
    const color = BALLOON_COLORS[hue % 4];
    const edge = ['#B9506E', '#B98A2E', '#4F86B0', '#7E5DB0'][hue % 4];
    ctx.save();
    ctx.translate(x, y);
    // хвостик нитки
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(14, 14);
    ctx.bezierCurveTo(26, 26, 14 + 6 * Math.sin(t * 3 + x), 34, 28, 42);
    ctx.stroke();
    ctx.rotate(Math.sin(t * 1.6 + x * 0.01) * 0.25);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(0, i * 9, 26, 9, 0.5, Math.PI, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(i * 9, 0, 9, 26, 0.5, Math.PI * 0.5, Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, TAU);
    ctx.stroke();
    ctx.restore();
    // сердечко-подсказка: это подарок, а не опасность
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    heartPath(ctx, x, y + 1, 6.5);
    ctx.fill();
  }

  /** Лягушонок на кувшинке. Перед прыжком приседает, по воде расходятся круги. */
  frog(x, h, t) {
    const ctx = this.ctx;
    const base = G - 14; // высота, на которой он сидит (FROG_Y в sim.js)
    // кувшинка под ним — всегда на воде
    ctx.fillStyle = '#5FB24F';
    ctx.strokeStyle = '#2F7A3C';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, G + 3, 30, 8, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    if (h.state === 'warn') {
      // круги на воде: сейчас прыгнет
      const k = 1 - Math.max(0, h.timer) / 0.6;
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`;
      ctx.lineWidth = 3;
      for (const r of [k, Math.max(0, k - 0.35)]) {
        ctx.beginPath();
        ctx.ellipse(x, G + 3, 30 + r * 46, 8 + r * 12, 0, 0, TAU);
        ctx.stroke();
      }
      // и стрелка вверх — куда
      const a = 0.5 + 0.5 * Math.sin(t * 20);
      ctx.fillStyle = `rgba(255,92,122,${0.55 + a * 0.45})`;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, base - 64 - a * 6);
      ctx.lineTo(x + 12, base - 46 - a * 6);
      ctx.lineTo(x - 12, base - 46 - a * 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    const air = h.state === 'jump';
    const squash = h.state === 'warn' ? 0.78 + 0.06 * Math.sin(t * 30) : 1;
    ctx.save();
    ctx.translate(x, h.y + (h.state === 'warn' ? 4 : 0));
    ctx.scale(air ? 0.9 : 1 / Math.sqrt(squash), air ? 1.14 : squash);
    // лапки: в прыжке вытянуты
    ctx.fillStyle = '#5BAA4A';
    ctx.strokeStyle = '#2F6B2A';
    ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      if (air) ctx.ellipse(s * 10, 18, 4.5, 11, s * 0.25, 0, TAU);
      else ctx.ellipse(s * 15, 10, 8, 5, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    // тело
    ctx.fillStyle = '#7CCB5E';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 2, 17, 14, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#D6F2B8';
    ctx.beginPath();
    ctx.ellipse(0, 7, 10, 6.5, 0, 0, TAU);
    ctx.fill();
    // глаза на макушке
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#7CCB5E';
      ctx.beginPath();
      ctx.arc(s * 9, -10, 7, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(s * 9, -10, 4.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1F3F1C';
      ctx.beginPath();
      ctx.arc(s * 9, air ? -11.5 : -10, 2.2, 0, TAU);
      ctx.fill();
    }
    // улыбка и румянец
    ctx.strokeStyle = '#2F6B2A';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, -1, 7, 0.25, Math.PI - 0.25);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,140,165,.7)';
    ctx.beginPath();
    ctx.arc(-11, 1, 2.6, 0, TAU);
    ctx.arc(11, 1, 2.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /** Летучая мышь с розовым бантиком: летит справа налево широкой волной. */
  bat(x, y, t) {
    const ctx = this.ctx;
    const flap = Math.sin(t * 16 + y * 0.05);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#3A1648';
    ctx.strokeStyle = '#FFA6CF';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    for (const s of [-1, 1]) {
      const tip = -12 * flap;
      ctx.beginPath();
      ctx.moveTo(s * 6, -4);
      ctx.quadraticCurveTo(s * 18, -18 + tip, s * 32, -6 + tip);
      ctx.quadraticCurveTo(s * 27, 0 + tip * 0.6, s * 25, 8 + tip * 0.5);
      ctx.quadraticCurveTo(s * 20, 2 + tip * 0.3, s * 16, 9 + tip * 0.2);
      ctx.quadraticCurveTo(s * 12, 4, s * 6, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // ушки и тело
    ctx.beginPath();
    ctx.moveTo(-9, -8);
    ctx.lineTo(-8, -20);
    ctx.lineTo(-2, -11);
    ctx.lineTo(2, -11);
    ctx.lineTo(8, -20);
    ctx.lineTo(9, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 12, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // глаза и клычки
    ctx.fillStyle = '#FFE3EF';
    ctx.beginPath();
    ctx.arc(-4.5, -2, 2.6, 0, TAU);
    ctx.arc(4.5, -2, 2.6, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4, 4);
    ctx.lineTo(-2.5, 8);
    ctx.lineTo(-1, 4);
    ctx.moveTo(1, 4);
    ctx.lineTo(2.5, 8);
    ctx.lineTo(4, 4);
    ctx.fill();
    // бантик
    ctx.fillStyle = '#FF5C9A';
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(-7, -17);
    ctx.lineTo(-7, -9);
    ctx.closePath();
    ctx.moveTo(0, -13);
    ctx.lineTo(7, -17);
    ctx.lineTo(7, -9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* ---------- опасности второго уровня ---------- */

  dustBall(x, y, t) {
    // клубок пыли: мягкий серый шар с крупинками
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(150,128,104,.85)';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(190,170,145,.9)';
    ctx.beginPath();
    ctx.arc(-4, -4, 11, 0, TAU);
    ctx.fill();
    for (let k = 0; k < 5; k++) {
      const a = t * 1.6 + k * 1.3;
      ctx.fillStyle = 'rgba(120,100,80,.7)';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 13, Math.sin(a) * 13, 1.8, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  roomba(x, y, t) {
    // робот-пылесос: плоский диск с лампочкой и щётками
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(60,70,85,.25)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 30, 6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4A566A';
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 15, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5E6C83';
    ctx.beginPath();
    ctx.ellipse(0, -3, 26, 12, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#8FA2B2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -3, 26, 12, 0, 0, TAU);
    ctx.stroke();
    // лампочка
    const on = Math.sin(t * 6) > 0;
    ctx.fillStyle = on ? '#7FE0A8' : '#3E7A58';
    ctx.beginPath();
    ctx.arc(-12, -4, 3, 0, TAU);
    ctx.fill();
    // щётки
    ctx.strokeStyle = '#C9D3DE';
    ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      const a = t * 14 * s;
      ctx.beginPath();
      ctx.moveTo(s * 18, 2);
      ctx.lineTo(s * 18 + Math.cos(a) * 9, 2 + Math.sin(a) * 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  bubble(x, y, t) {
    // мыльный пузырь: прозрачный шар с бликом
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    const r = 15 + Math.sin(t * 4 + y) * 1.5;
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 1, 0, 0, r);
    g.addColorStop(0, 'rgba(255,255,255,.9)');
    g.addColorStop(0.45, 'rgba(210,240,255,.35)');
    g.addColorStop(1, 'rgba(160,215,245,.55)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.beginPath();
    ctx.arc(-r * 0.35, -r * 0.4, r * 0.22, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  suction(x, y, mx, my, k, t) {
    // робот тянет Мию к себе: струйки воздуха сходятся от неё к роботу
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const f = (t * 1.6 + i / 5) % 1; // 0 — у Мии, 1 — у робота
      const sx = lerp(mx, x, f) + Math.sin(i * 2.3) * 22 * (1 - f);
      const sy = lerp(my + 26, y - 14, f);
      const ex = lerp(mx, x, Math.min(1, f + 0.09)) + Math.sin(i * 2.3) * 22 * (1 - f - 0.09);
      const ey = lerp(my + 26, y - 14, Math.min(1, f + 0.09));
      ctx.strokeStyle = `rgba(120,150,180,${(0.2 + 0.5 * k) * Math.sin(f * Math.PI)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
    ctx.restore();
  }

  bird(x, h, t) {
    // голубь: сидит, а когда взлетает — машет крыльями
    const ctx = this.ctx;
    const up = h.state === 'rise';
    const flap = up ? Math.sin(t * 22) : 0;
    ctx.save();
    ctx.translate(x, h.y);
    ctx.scale(1.35, 1.35);
    if (up) ctx.rotate(-0.25);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#4B5870';
    ctx.lineWidth = 1.6;
    // хвост
    ctx.fillStyle = '#7A8AA0';
    ctx.beginPath();
    ctx.moveTo(8, -1);
    ctx.lineTo(21, 3);
    ctx.lineTo(9, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // тело
    ctx.fillStyle = '#9AA9BD';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 9, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // голова
    ctx.fillStyle = '#B4C1D2';
    ctx.beginPath();
    ctx.arc(-9, -7, 6.5, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // клюв
    ctx.fillStyle = '#F0B860';
    ctx.beginPath();
    ctx.moveTo(-15, -8);
    ctx.lineTo(-21, -5.5);
    ctx.lineTo(-15, -3.5);
    ctx.closePath();
    ctx.fill();
    // глаз
    ctx.fillStyle = '#2B3446';
    ctx.beginPath();
    ctx.arc(-10.5, -8, 1.5, 0, TAU);
    ctx.fill();
    // крыло
    ctx.fillStyle = '#7A8AA0';
    ctx.beginPath();
    ctx.moveTo(-3, -2);
    ctx.quadraticCurveTo(8, -4 - flap * 16, 15, 1 - flap * 20);
    ctx.quadraticCurveTo(7, 4, -2, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  bun(x, y, t) {
    // летящая булочка: кувыркается
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 3 + x * 0.01) * 0.5);
    ctx.fillStyle = '#D9984F';
    ctx.strokeStyle = '#9A6430';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 13, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F0C98A';
    ctx.beginPath();
    ctx.ellipse(-2, -4, 12, 7, 0, 0, TAU);
    ctx.fill();
    // кунжут
    ctx.fillStyle = '#FFF4DA';
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.ellipse(-8 + k * 5, -5 + (k % 2) * 3, 1.8, 1.1, 0.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  soldier(x, y, t) {
    // оловянный солдатик: мундир, кивер, ружьё. Летит по стойке смирно.
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y + 4);
    ctx.scale(1.55, 1.55);
    ctx.rotate(-0.12);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2B3446';
    ctx.lineWidth = 1.4;
    // ноги
    ctx.fillStyle = '#2B3446';
    ctx.fillRect(-5, 5, 4, 8);
    ctx.fillRect(1, 5, 4, 8);
    // мундир
    ctx.fillStyle = '#C8414F';
    ctx.beginPath();
    ctx.rect(-6, -6, 12, 12);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#F4C97B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-5, -5);
    ctx.lineTo(5, 5);
    ctx.stroke();
    // голова
    ctx.strokeStyle = '#2B3446';
    ctx.lineWidth = 1.4;
    ctx.fillStyle = '#F0C9A8';
    ctx.beginPath();
    ctx.arc(0, -10, 5.5, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // кивер
    ctx.fillStyle = '#2B3446';
    ctx.fillRect(-6.5, -21, 13, 9);
    ctx.fillStyle = '#F4C97B';
    ctx.fillRect(-6.5, -14.5, 13, 2);
    ctx.fillStyle = '#E8526B';
    ctx.beginPath();
    ctx.arc(0, -22.5, 2.6, 0, TAU);
    ctx.fill();
    // ружьё со штыком — смотрит вперёд, туда, откуда летит Мия
    ctx.strokeStyle = '#6B563F';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-4, 2);
    ctx.lineTo(-13, -13);
    ctx.stroke();
    ctx.strokeStyle = '#C9D3DE';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-13, -13);
    ctx.lineTo(-16, -18);
    ctx.stroke();
    ctx.restore();
  }

  ember(x, h, t) {
    // уголёк: раскалённый комок с огненным хвостом. Крупнее и ярче искр фона — его нельзя с ними спутать.
    const ctx = this.ctx;
    const y = h.y;
    const up = h.state === 'rise';
    ctx.save();
    ctx.translate(x, y);
    const a = 0.75 + 0.25 * Math.sin(t * 9 + h.phase);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
    g.addColorStop(0, `rgba(255,190,90,${0.55 * a})`);
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, TAU);
    ctx.fill();
    if (up) {
      // хвост: уголёк летит вверх, пламя тянется вниз
      ctx.fillStyle = 'rgba(255,150,60,.75)';
      ctx.beginPath();
      ctx.moveTo(-9, 2);
      ctx.quadraticCurveTo(Math.sin(t * 14) * 4, 34 + Math.sin(t * 11) * 5, 9, 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#FF7A3C';
    ctx.strokeStyle = '#B23A1E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFD27A';
    ctx.beginPath();
    ctx.arc(-1.5, -2, 6.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#FFF6DC';
    ctx.beginPath();
    ctx.arc(-2.5, -3, 3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  steam(x, h, t) {
    // струя пара от пола до потолка: клубы поднимаются вверх
    const ctx = this.ctx;
    ctx.save();
    // кастрюля на полу
    ctx.fillStyle = '#C9D3DE';
    ctx.strokeStyle = '#8FA2B2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    rr(ctx, x - 20, G - 22, 40, 22, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#8FA2B2';
    ctx.fillRect(x - 27, G - 18, 7, 4);
    ctx.fillRect(x + 20, G - 18, 7, 4);
    const strong = h.on ? 1 : 0.7;
    for (let k = 0; k < 9; k++) {
      const f = (t * 0.55 + k / 9 + h.phase) % 1; // 0 — у кастрюли, 1 — наверху
      const py = G - 26 - f * (G - 10);
      const px = x + Math.sin(f * 9 + k * 1.7) * (6 + f * 12);
      const rad = 11 + f * 15;
      ctx.fillStyle = `rgba(255,255,255,${(0.5 - f * 0.34) * strong})`;
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, TAU);
      ctx.fill();
    }
    // стрелки вверх: пар подбрасывает
    ctx.strokeStyle = `rgba(255,255,255,${0.75 * strong})`;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let k = 0; k < 2; k++) {
      const f = (t * 0.9 + k * 0.5) % 1;
      const py = G - 90 - f * 260;
      ctx.globalAlpha = Math.sin(f * Math.PI);
      ctx.beginPath();
      ctx.moveTo(x - 9, py + 9);
      ctx.lineTo(x, py);
      ctx.lineTo(x + 9, py + 9);
      ctx.stroke();
    }
    ctx.restore();
  }

  bolt(x, h, t) {
    // Молния. Сначала в небе светится точка и от верха экрана к ней тянется пунктир — туда ударит разряд.
    // Потом бьёт сам разряд: от верха до точки. Всё, что ниже точки, в безопасности.
    const ctx = this.ctx;
    const y = h.y;
    ctx.save();
    if (h.state === 'idle') {
      ctx.restore();
      return;
    }
    if (h.state === 'warn') {
      const k = 1 - h.timer / 0.8; // 0 → 1 к моменту удара
      const blink = 0.55 + 0.45 * Math.sin(t * (14 + k * 22));
      // опасная зона: полоса от верха до точки
      const zone = ctx.createLinearGradient(0, 0, 0, y);
      zone.addColorStop(0, `rgba(255,236,150,${0.05 + 0.1 * k})`);
      zone.addColorStop(1, `rgba(255,236,150,${0.16 + 0.2 * k})`);
      ctx.fillStyle = zone;
      ctx.fillRect(x - 17, 0, 34, y);
      ctx.strokeStyle = `rgba(255,240,170,${0.5 + 0.4 * blink})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 9]);
      ctx.lineDashOffset = -t * 60;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);
      // точка удара
      const gg = ctx.createRadialGradient(x, y, 1, x, y, 30);
      gg.addColorStop(0, `rgba(255,246,190,${0.9 * blink})`);
      gg.addColorStop(1, 'rgba(255,230,140,0)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#FFF2B0';
      ctx.strokeStyle = '#E8A93A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 6 + 3 * k, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }
    // разряд
    const life = Math.max(0, h.timer / 0.42);
    ctx.globalAlpha = 0.5 + 0.5 * life;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, -10);
    let yy = -10;
    let k = 0;
    while (yy < y - 22) {
      yy += 22;
      k++;
      ctx.lineTo(x + (k % 2 ? 1 : -1) * (6 + hash(k + Math.floor(t * 18)) * 8), yy);
    }
    ctx.lineTo(x, y);
    ctx.strokeStyle = 'rgba(255,228,120,.9)';
    ctx.lineWidth = 11;
    ctx.stroke();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.stroke();
    const gg = ctx.createRadialGradient(x, y, 1, x, y, 46);
    gg.addColorStop(0, 'rgba(255,255,255,.95)');
    gg.addColorStop(0.4, 'rgba(255,238,160,.6)');
    gg.addColorStop(1, 'rgba(255,230,140,0)');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(x, y, 46, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  heart(x, y, s) {
    const ctx = this.ctx;
    ctx.fillStyle = '#FF5C7A';
    ctx.strokeStyle = '#A8324F';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    heartPath(ctx, x, y, s);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.beginPath();
    ctx.ellipse(x - s * 0.5, y - s * 0.4, s * 0.2, s * 0.3, 0.6, 0, TAU);
    ctx.fill();
  }

  fish(x, y, t) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 5 + x) * 0.15);
    ctx.fillStyle = 'rgba(255,220,120,.3)';
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#FFC94A';
    ctx.strokeStyle = '#B9801A';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(-24, -10);
    ctx.lineTo(-24, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 10, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5B3A12';
    ctx.beginPath();
    ctx.arc(8, -2, 2.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath();
    ctx.ellipse(-2, -5, 6, 2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  powerup(x, y, kind, t) {
    const ctx = this.ctx;
    const color = POWERUPS[kind].color;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 7]);
    ctx.lineDashOffset = -t * 30;
    ctx.beginPath();
    ctx.arc(0, 0, 27, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    const g = ctx.createRadialGradient(-6, -8, 2, 0, 0, 21);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();
    if (kind === 'shield') {
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(-4, -5, 2.5, 4.5, 0.6, 0, TAU);
      ctx.fill();
    } else if (kind === 'magnet') {
      ctx.lineCap = 'butt';
      ctx.strokeStyle = '#E8475F';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0, -1, 8, Math.PI, TAU);
      ctx.moveTo(-8, -1);
      ctx.lineTo(-8, 6);
      ctx.moveTo(8, -1);
      ctx.lineTo(8, 6);
      ctx.stroke();
      ctx.strokeStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(-8, 6);
      ctx.lineTo(-8, 11);
      ctx.moveTo(8, 6);
      ctx.lineTo(8, 11);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#3E8E41';
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.bezierCurveTo(-14, 4, -12, -10, 0, -13);
      ctx.bezierCurveTo(12, -10, 14, 4, 0, 12);
      ctx.fill();
      ctx.strokeStyle = '#D9F5D0';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.lineTo(0, -9);
      ctx.moveTo(0, 3);
      ctx.lineTo(-6, -2);
      ctx.moveTo(0, -1);
      ctx.lineTo(6, -6);
      ctx.stroke();
    }
    ctx.restore();
  }

  drop(x, y) {
    const ctx = this.ctx;
    ctx.fillStyle = '#6EC1F0';
    ctx.strokeStyle = '#2F86C2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 17);
    ctx.bezierCurveTo(x + 4, y - 8, x + 10, y - 3, x + 10, y + 3);
    ctx.arc(x, y + 3, 10, 0, Math.PI);
    ctx.bezierCurveTo(x - 10, y - 3, x - 4, y - 8, x, y - 17);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.beginPath();
    ctx.ellipse(x - 4, y + 2, 2, 4, 0.4, 0, TAU);
    ctx.fill();
  }

  balloon(x, y, hue, t) {
    const ctx = this.ctx;
    const color = BALLOON_COLORS[hue % 4];
    ctx.strokeStyle = 'rgba(90,50,70,.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y + 25);
    ctx.quadraticCurveTo(x + 7 * Math.sin(t * 2 + x), y + 46, x, y + 64);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(90,40,60,.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(x, y, 21, 25, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 30);
    ctx.lineTo(x, y + 24);
    ctx.lineTo(x + 4, y + 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    heartPath(ctx, x, y + 1, 7.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.beginPath();
    ctx.ellipse(x - 9, y - 12, 3, 6, 0.6, 0, TAU);
    ctx.fill();
  }

  cucumber(x, y, t) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    // шлейф скорости
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(30, i * 9);
      ctx.lineTo(52 + 8 * Math.sin(t * 20 + i), i * 9);
      ctx.stroke();
    }
    ctx.rotate(Math.sin(t * 6 + y) * 0.12);
    ctx.fillStyle = '#6FB24F';
    ctx.strokeStyle = '#2F6B2A';
    ctx.lineWidth = 2.5;
    rr(ctx, -27, -12, 54, 24, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#4E9440';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(-4 + i * 8, i % 2 ? 6 : -6, 1.8, 0, TAU);
      ctx.fill();
    }
    // хмурая мордочка
    ctx.fillStyle = '#1F3F1C';
    ctx.beginPath();
    ctx.arc(-17, -1, 2.3, 0, TAU);
    ctx.arc(-9, -1, 2.3, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#1F3F1C';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-21, -7);
    ctx.lineTo(-15, -5);
    ctx.moveTo(-5, -7);
    ctx.lineTo(-11, -5);
    ctx.moveTo(-16, 6);
    ctx.quadraticCurveTo(-13, 3.5, -10, 6);
    ctx.stroke();
    ctx.restore();
  }

  warning(W, y, t, kind) {
    const ctx = this.ctx;
    const a = 0.55 + 0.45 * Math.sin(t * 22);
    ctx.save();
    ctx.globalAlpha = a;
    if (kind === 'bat') {
      // мышь летит волной — показываем, какую полосу она займёт
      ctx.fillStyle = 'rgba(255,92,154,.2)';
      rr(ctx, W - 46, y - 52, 32, 104, 16);
      ctx.fill();
    }
    ctx.fillStyle = kind === 'bat' ? '#C2337F' : '#FF5C7A';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W - 30, y, 18, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `900 24px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', W - 30, y + 1);
    ctx.restore();
  }

  wind(sim, W, t) {
    const ctx = this.ctx;
    const dir = sim.wind.dir;
    const mx = sim.miaX;
    const my = sim.mia.y;
    if (sim.wind.state === 'warn') {
      const a = 0.5 + 0.5 * Math.sin(t * 18);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < 2; i++) {
        const y = my + dir * (62 + i * 18);
        ctx.beginPath();
        ctx.moveTo(mx - 16, y - dir * 12);
        ctx.lineTo(mx, y);
        ctx.lineTo(mx + 16, y - dir * 12);
        ctx.stroke();
      }
      ctx.strokeStyle = '#3F87B5';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 2; i++) {
        const y = my + dir * (62 + i * 18);
        ctx.beginPath();
        ctx.moveTo(mx - 16, y - dir * 12);
        ctx.lineTo(mx, y);
        ctx.lineTo(mx + 16, y - dir * 12);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,.6)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let i = 0; i < 22; i++) {
        const x = hash(i + 3) * W;
        const len = 40 + hash(i + 9) * 70;
        const yy = ((((hash(i + 30) * G + dir * t * 620) % G) + G) % G);
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.lineTo(x - 6, yy - dir * len);
        ctx.stroke();
      }
    }
  }

  mia(sim, t, dt) {
    const ctx = this.ctx;
    const sk = this.skin;
    if (!sk || !this.sticker) return;
    const m = sim.mia;
    this.wingT = Math.min(1, this.wingT + dt / 0.3);
    const blink = sim.inv > 0 && sim.status === 'playing' && Math.floor(t * 14) % 2 === 0;
    const st = this.sticker;
    const w = sk.w * (sim.catnip > 0 ? 1.12 : 1);
    const h = w * st.ratio;
    const padW = w * st.pad;

    ctx.save();
    ctx.translate(sim.miaX, m.y);
    const rot = sim.status === 'dying' || sim.status === 'lost' ? m.rot : m.rot * 0.5;
    ctx.rotate(rot);
    // «сжатие и растяжение»: пружинка возвращает Мию к обычной форме
    if (dt > 0) {
      const step = Math.min(dt, 0.033);
      this.stretchV += (-(this.stretch - 1) * 420 - this.stretchV * 22) * step;
      this.stretch += this.stretchV * step;
    }
    if (!this.reduceMotion) {
      const sy = Math.max(0.6, Math.min(1.3, this.stretch));
      ctx.scale(1 / Math.pow(sy, 0.8), sy);
    }
    if (blink) ctx.globalAlpha = 0.45;

    if (sim.catnip > 0) {
      const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 70);
      g.addColorStop(0, 'rgba(180,255,150,.55)');
      g.addColorStop(1, 'rgba(180,255,150,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0, TAU);
      ctx.fill();
    }

    // крылья
    const flap = Math.sin(Math.PI * this.wingT);
    const idle = Math.sin(t * 7) * 0.1;
    const wxp = (sk.wings[0] - sk.ax) * w;
    const wyp = (sk.wings[1] - sk.ay) * h;
    const ws = Math.max(34, w * 0.4);
    wing(ctx, wxp - 6, wyp - 4, ws * 0.9, 0.5 + idle - flap * 1.15, '#F3E4E8');
    wing(ctx, wxp, wyp, ws, 0.25 + idle - flap * 1.25, '#FFFFFF');

    ctx.drawImage(st.canvas, -sk.ax * w - padW, -sk.ay * h - padW, w + padW * 2, h + padW * 2);

    if (sim.shield) {
      ctx.globalAlpha = 1;
      const r = 48 + Math.sin(t * 5) * 1.5;
      ctx.fillStyle = 'rgba(160,220,255,.22)';
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.45, -r * 0.5, 5, 11, 0.7, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawParticles(dt, sim, playing) {
    const ctx = this.ctx;
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life += dt;
      if (p.life >= p.max) {
        ps.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const f = p.life / p.max;
      ctx.globalAlpha = p.kind === 'text' ? Math.min(1, (1 - f) * 2.2) : 1 - f * f;
      switch (p.kind) {
        case 'dot':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0, p.size * (1 - f * 0.6)), 0, TAU);
          ctx.fill();
          break;
        case 'spark':
          ctx.fillStyle = p.color;
          star(ctx, p.x, p.y, p.size * (1 - f * 0.4), p.rot);
          break;
        case 'puff':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0, p.size * (0.6 + f)), 0, TAU);
          ctx.fill();
          break;
        case 'confetti':
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
          ctx.restore();
          break;
        case 'heart':
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.sin(p.rot) * 0.5);
          ctx.fillStyle = p.color;
          heartPath(ctx, 0, 0, p.size);
          ctx.fill();
          ctx.restore();
          break;
        case 'fly': {
          // сердечко летит к счётчику: сначала чуть отлетает назад, потом разгоняется
          const e = f * f * (3 - 2 * f);
          const lift = Math.sin(f * Math.PI) * 46;
          p.x = p.x0 + (p.tx - p.x0) * e;
          p.y = p.y0 + (p.ty - p.y0) * e - lift;
          ctx.globalAlpha = 0.95;
          ctx.fillStyle = p.color;
          heartPath(ctx, p.x, p.y, p.size * (1 - f * 0.45));
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.6;
          ctx.stroke();
          break;
        }
        case 'ring':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 5 * (1 - f);
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0, p.size + f * 60), 0, TAU);
          ctx.stroke();
          break;
        case 'text':
          ctx.font = `900 ${p.size}px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineJoin = 'round';
          ctx.lineWidth = 5;
          ctx.strokeStyle = 'rgba(58,29,46,.85)';
          ctx.strokeText(p.text, p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, p.x, p.y);
          ctx.fillStyle = 'rgba(255,255,255,.35)';
          ctx.fillText(p.text, p.x, p.y);
          break;
      }
    }
    ctx.globalAlpha = 1;
  }
}

function star(ctx, x, y, s, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.quadraticCurveTo(0, 0, s, 0);
  ctx.quadraticCurveTo(0, 0, 0, s);
  ctx.quadraticCurveTo(0, 0, -s, 0);
  ctx.quadraticCurveTo(0, 0, 0, -s);
  ctx.fill();
  ctx.restore();
}

function wing(ctx, x, y, s, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-s * 0.15, -s * 0.8, -s * 0.9, -s * 0.95, -s * 1.2, -s * 0.55);
  ctx.quadraticCurveTo(-s * 0.9, -s * 0.52, -s * 1.0, -s * 0.24);
  ctx.quadraticCurveTo(-s * 0.7, -s * 0.26, -s * 0.74, 0.02 * s);
  ctx.quadraticCurveTo(-s * 0.46, -s * 0.04, -s * 0.42, s * 0.2);
  ctx.quadraticCurveTo(-s * 0.16, s * 0.12, 0, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#D98AA0';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

/** Делает из фото-вырезки «наклейку» с белой обводкой — так Мию хорошо видно на любом фоне. */
function makeSticker(img, worldW) {
  const px = Math.ceil(worldW * 3);
  const ratio = img.naturalHeight / img.naturalWidth;
  const h = Math.ceil(px * ratio);
  const pad = Math.ceil(px * 0.04);
  const c = document.createElement('canvas');
  c.width = px + pad * 2;
  c.height = h + pad * 2;
  const x = c.getContext('2d');
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    x.drawImage(img, pad + Math.cos(a) * pad * 0.85, pad + Math.sin(a) * pad * 0.85, px, h);
  }
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#FFFFFF';
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'source-over';
  x.drawImage(img, pad, pad, px, h);
  return { canvas: c, ratio, pad: pad / px };
}
