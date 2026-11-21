/* Темы уровней: небо, дальние планы, пол и колонны — всё рисуется кодом на canvas,
   поэтому игра весит мало и выглядит чётко на любом экране. */

import { WORLD } from './levels.js';

const G = WORLD.GROUND;
const TAU = Math.PI * 2;

export const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(Array.isArray(c) ? c[0] : i / (stops.length - 1), Array.isArray(c) ? c[1] : c));
  return g;
}
function hgrad(ctx, x0, x1, stops) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

/** Повторяющийся слой с параллаксом: вызывает draw(x, index) для каждого видимого тайла. */
function tile(W, scroll, factor, period, draw, pad = 0) {
  const off = scroll * factor;
  const first = Math.floor((off - pad) / period);
  const last = Math.floor((off + W + pad) / period);
  for (let i = first; i <= last; i++) draw(i * period - off, i);
}

export function heartPath(ctx, x, y, s) {
  // сердечко с центром в (x, y) и «радиусом» s
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.75, y - s * 1.15, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.75, y - s * 1.15, x + s * 1.5, y - s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

/* ---------- общие декорации ---------- */

function plush(ctx, x, kind, alpha = 0.6) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, G);
  if (kind === 0) {
    // зайка с длинными ушами
    ctx.fillStyle = '#F4E8DA';
    ctx.beginPath();
    ctx.ellipse(-16, -118, 11, 38, -0.25, 0, TAU);
    ctx.ellipse(18, -116, 11, 38, 0.3, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -40, 40, 42, 0, 0, TAU);
    ctx.ellipse(0, -92, 28, 26, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#F2B8C6';
    ctx.beginPath();
    ctx.moveTo(-14, -68);
    ctx.lineTo(0, -60);
    ctx.lineTo(14, -68);
    ctx.lineTo(14, -54);
    ctx.lineTo(0, -60);
    ctx.lineTo(-14, -54);
    ctx.fill();
  } else if (kind === 1) {
    // мишка
    ctx.fillStyle = '#CDB09A';
    ctx.beginPath();
    ctx.arc(-20, -104, 11, 0, TAU);
    ctx.arc(20, -104, 11, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -38, 38, 40, 0, 0, TAU);
    ctx.ellipse(0, -86, 27, 25, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#C85A6E';
    ctx.beginPath();
    ctx.ellipse(0, -62, 12, 6, 0, 0, TAU);
    ctx.fill();
  } else {
    // панда
    ctx.fillStyle = '#4A3F4A';
    ctx.beginPath();
    ctx.arc(-24, -122, 13, 0, TAU);
    ctx.arc(24, -122, 13, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(0, -100, 33, 30, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8E6FA6';
    ctx.beginPath();
    ctx.ellipse(0, -40, 44, 44, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4A3F4A';
    ctx.beginPath();
    ctx.ellipse(-12, -102, 7, 9, 0.3, 0, TAU);
    ctx.ellipse(12, -102, 7, 9, -0.3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function balloon(ctx, x, y, r, color, stringLen = 90) {
  ctx.strokeStyle = 'rgba(120,80,95,.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.quadraticCurveTo(x + 8, y + r + stringLen * 0.5, x - 2, y + r + stringLen);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.88, r, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 4, y + r + 5);
  ctx.lineTo(x, y + r - 2);
  ctx.lineTo(x + 4, y + r + 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.32, y - r * 0.38, r * 0.16, r * 0.3, 0.5, 0, TAU);
  ctx.fill();
}

function cloudHeart(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  heartPath(ctx, x, y, s);
  ctx.fill();
}

function colOutline(ctx, x, y, w, h, color, lw = 2.5) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.strokeRect(x, y, w, h);
}

/* ============================================================
   ТЕМЫ
   column(ctx, x, y, w, h, capAt, seed, t): колонна в прямоугольнике x,y,w,h;
   capAt = 'top' | 'bottom' — с какой стороны просвет (там рисуется «шапка»).
   ============================================================ */

export const THEMES = {
  /* ---------- 1. Гостиная ---------- */
  living: {
    name: 'Гостиная',
    ambient: 'dust',
    hud: '#5B2A3C',
    sky(ctx, W, VH) {
      ctx.fillStyle = vgrad(ctx, 0, G, ['#FFF4EA', '#FCE3E0', '#F9D3D6']);
      ctx.fillRect(0, -90, W, VH + 90);
    },
    far(ctx, W, scroll) {
      // окна с лёгкими шторами
      tile(W, scroll, 0.14, 520, (x) => {
        const wx = x + 120;
        ctx.fillStyle = '#FFFFFF';
        rr(ctx, wx - 8, 82, 216, 336, 14);
        ctx.fill();
        ctx.fillStyle = vgrad(ctx, 90, 410, ['#D6EEF9', '#F4FBFF']);
        rr(ctx, wx, 90, 200, 320, 8);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(wx + 96, 90, 8, 320);
        ctx.fillRect(wx, 236, 200, 7);
        ctx.fillStyle = 'rgba(246,196,208,.72)';
        ctx.beginPath();
        ctx.moveTo(wx - 34, 70);
        ctx.lineTo(wx + 52, 70);
        ctx.quadraticCurveTo(wx + 40, 250, wx - 4, 440);
        ctx.lineTo(wx - 34, 440);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(wx + 234, 70);
        ctx.lineTo(wx + 148, 70);
        ctx.quadraticCurveTo(wx + 160, 250, wx + 204, 440);
        ctx.lineTo(wx + 234, 440);
        ctx.fill();
        ctx.fillStyle = '#E7A9B8';
        rr(ctx, wx - 44, 62, 288, 10, 5);
        ctx.fill();
      }, 300);
      // плинтус
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.fillRect(0, G - 26, W, 26);
      // плюшевая компания
      tile(W, scroll, 0.42, 430, (x, i) => plush(ctx, x + 200, ((i % 3) + 3) % 3, 0.5), 120);
    },
    ground(ctx, W, VH, scroll) {
      ctx.fillStyle = '#DDB893';
      ctx.fillRect(0, G, W, VH - G);
      ctx.fillStyle = '#EBCDAC';
      ctx.fillRect(0, G, W, 7);
      ctx.strokeStyle = '#C79F78';
      ctx.lineWidth = 2;
      tile(W, scroll, 1, 96, (x, i) => {
        ctx.beginPath();
        ctx.moveTo(x, G + 7);
        ctx.lineTo(x - 30, VH);
        ctx.stroke();
        ctx.fillStyle = 'rgba(160,110,70,.18)';
        ctx.beginPath();
        ctx.ellipse(x + 40 + hash(i) * 20, G + 26 + hash(i + 3) * 14, 9, 2.5, 0, 0, TAU);
        ctx.fill();
      }, 40);
      ctx.fillStyle = '#A9805C';
      ctx.fillRect(0, G, W, 2.5);
    },
    column(ctx, x, y, w, h, capAt) {
      // когтеточка: столбик в верёвке и плюшевая площадка
      const bx = x + 11;
      const bw = w - 22;
      ctx.fillStyle = hgrad(ctx, bx, bx + bw, ['#CFAA78', '#E8CB9C', '#D3B07F']);
      ctx.fillRect(bx, y, bw, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, y, bw, h);
      ctx.clip();
      ctx.strokeStyle = 'rgba(150,110,60,.5)';
      ctx.lineWidth = 2;
      const start = Math.floor(y / 10) * 10 - 10;
      for (let yy = start; yy < y + h + 10; yy += 10) {
        ctx.beginPath();
        ctx.moveTo(bx, yy + 5);
        ctx.lineTo(bx + bw, yy);
        ctx.stroke();
      }
      ctx.restore();
      colOutline(ctx, bx, y, bw, h, '#A9825A');
      const cy = capAt === 'top' ? y : y + h - 24;
      ctx.fillStyle = '#FFF7EE';
      rr(ctx, x - 5, cy, w + 10, 24, 10);
      ctx.fill();
      ctx.strokeStyle = '#E79DB0';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#F6C3CF';
      rr(ctx, x + 3, cy + 6, w - 6, 5, 3);
      ctx.fill();
    },
  },

  /* ---------- 2. Кухня ---------- */
  kitchen: {
    name: 'Кухня',
    ambient: 'steam',
    hud: '#4A3B2A',
    sky(ctx, W, VH) {
      ctx.fillStyle = vgrad(ctx, 0, G, ['#FBF8F4', '#F3ECE4']);
      ctx.fillRect(0, -90, W, VH + 90);
    },
    far(ctx, W, scroll) {
      // мраморный фартук с золотыми прожилками
      ctx.strokeStyle = 'rgba(214,176,106,.55)';
      ctx.lineWidth = 2;
      tile(W, scroll, 0.14, 460, (x, i) => {
        ctx.beginPath();
        ctx.moveTo(x, 520);
        ctx.bezierCurveTo(x + 120, 430, x + 190, 380, x + 300, 140);
        ctx.moveTo(x + 150, 418);
        ctx.bezierCurveTo(x + 260, 400, x + 340, 330, x + 460, 300);
        ctx.moveTo(x + 60, 110);
        ctx.bezierCurveTo(x + 120, 190, x + 210, 210, x + 250, 250);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(190,180,170,.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 230, 0);
        ctx.lineTo(x + 230, G);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(214,176,106,.55)';
        ctx.lineWidth = 2;
      }, 460);
      // рифлёные верхние шкафчики и тёплая подсветка
      ctx.fillStyle = '#EEE7DE';
      ctx.fillRect(0, -90, W, 148);
      ctx.strokeStyle = 'rgba(190,178,165,.5)';
      ctx.lineWidth = 1.5;
      tile(W, scroll, 0.3, 13, (x) => {
        ctx.beginPath();
        ctx.moveTo(x, -90);
        ctx.lineTo(x, 54);
        ctx.stroke();
      });
      ctx.fillStyle = '#D9D0C5';
      ctx.fillRect(0, 54, W, 5);
      ctx.fillStyle = vgrad(ctx, 59, 150, ['rgba(255,214,140,.5)', 'rgba(255,214,140,0)']);
      ctx.fillRect(0, 59, W, 91);
      // вещи на столешнице: крафтовый пакет и чайник
      tile(W, scroll, 0.42, 520, (x, i) => {
        ctx.globalAlpha = 0.55;
        if (((i % 2) + 2) % 2 === 0) {
          ctx.fillStyle = '#C9A27A';
          ctx.beginPath();
          ctx.moveTo(x + 150, G);
          ctx.lineTo(x + 158, G - 120);
          ctx.lineTo(x + 226, G - 126);
          ctx.lineTo(x + 240, G);
          ctx.fill();
          ctx.strokeStyle = '#B08A63';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x + 192, G - 124, 20, Math.PI, TAU);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#E3DCD3';
          rr(ctx, x + 160, G - 96, 70, 96, 16);
          ctx.fill();
          ctx.fillStyle = '#D2B170';
          rr(ctx, x + 172, G - 108, 46, 14, 6);
          ctx.fill();
          ctx.strokeStyle = '#D2B170';
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.arc(x + 232, G - 52, 20, -1.2, 1.2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }, 260);
    },
    ground(ctx, W, VH, scroll) {
      ctx.fillStyle = '#FAF7F3';
      ctx.fillRect(0, G, W, VH - G);
      ctx.strokeStyle = 'rgba(214,176,106,.5)';
      ctx.lineWidth = 2;
      tile(W, scroll, 1, 210, (x, i) => {
        ctx.beginPath();
        ctx.moveTo(x, G + 14 + hash(i) * 10);
        ctx.quadraticCurveTo(x + 80, G + 40, x + 170, G + 22 + hash(i + 1) * 30);
        ctx.stroke();
      }, 210);
      // чёрное стекло плиты
      tile(W, scroll, 1, 880, (x) => {
        ctx.fillStyle = '#2B2A2E';
        rr(ctx, x + 300, G + 12, 260, VH - G, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x + 370, G + 34, 34, 9, 0, 0, TAU);
        ctx.ellipse(x + 490, G + 34, 34, 9, 0, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(214,176,106,.5)';
      }, 600);
      ctx.fillStyle = '#D9B36A';
      ctx.fillRect(0, G, W, 5);
      ctx.fillStyle = '#B48A3E';
      ctx.fillRect(0, G + 5, W, 1.5);
    },
    column(ctx, x, y, w, h, capAt) {
      // белая труба смесителя с золотым наконечником
      const bx = x + 9;
      const bw = w - 18;
      ctx.fillStyle = hgrad(ctx, bx, bx + bw, ['#E2DDD6', '#FFFFFF', '#FFFFFF', '#DAD4CC', '#C9C2B8']);
      ctx.fillRect(bx, y, bw, h);
      colOutline(ctx, bx, y, bw, h, '#B5ADA2');
      const cy = capAt === 'top' ? y : y + h - 30;
      ctx.fillStyle = hgrad(ctx, x - 3, x + w + 3, ['#B98B32', '#F5DC97', '#E3BC62', '#B98B32', '#9B7226']);
      rr(ctx, x - 3, cy, w + 6, 30, 7);
      ctx.fill();
      ctx.strokeStyle = '#8A6420';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.fillRect(x + 10, cy + 4, 6, 22);
    },
  },

  /* ---------- 3. День рождения ---------- */
  party: {
    name: 'День рождения',
    ambient: 'confetti',
    hud: '#6B2440',
    sky(ctx, W, VH) {
      ctx.fillStyle = vgrad(ctx, 0, G, ['#FFD3DF', '#FFE6E3', '#FFF3E8']);
      ctx.fillRect(0, -90, W, VH + 90);
    },
    far(ctx, W, scroll, t) {
      // боке
      tile(W, scroll, 0.06, 260, (x, i) => {
        ctx.fillStyle = `rgba(255,255,255,${0.25 + hash(i) * 0.25})`;
        ctx.beginPath();
        ctx.arc(x + hash(i + 5) * 200, 120 + hash(i + 9) * 380, 20 + hash(i + 2) * 40, 0, TAU);
        ctx.fill();
      }, 80);
      // связки шаров: розовые и серебряные, как на празднике
      const colors = ['#F6A7BA', '#DDE1E7', '#FFFFFF', '#F9C6D2', '#C9CED6'];
      tile(W, scroll, 0.16, 400, (x, i) => {
        ctx.globalAlpha = 0.8;
        const sway = Math.sin(t * 0.8 + i) * 5;
        balloon(ctx, x + 90 + sway, 210, 40, colors[(((i * 2) % 5) + 5) % 5], 200);
        balloon(ctx, x + 150 - sway, 160, 46, colors[(((i * 2 + 1) % 5) + 5) % 5], 250);
        balloon(ctx, x + 200 + sway, 240, 36, colors[(((i * 2 + 3) % 5) + 5) % 5], 170);
        ctx.globalAlpha = 1;
      }, 300);
      // гирлянда флажков
      const flags = ['#F58CA5', '#FFF7EE', '#F4C97B', '#9CC79A'];
      tile(W, scroll, 0.32, 320, (x) => {
        ctx.strokeStyle = 'rgba(120,70,90,.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 14);
        ctx.quadraticCurveTo(x + 160, 78, x + 320, 14);
        ctx.stroke();
        for (let k = 0; k < 7; k++) {
          const f = (k + 0.5) / 7;
          const fx = x + f * 320;
          const fy = 14 + 128 * f * (1 - f);
          ctx.fillStyle = flags[k % 4];
          ctx.beginPath();
          ctx.moveTo(fx - 14, fy);
          ctx.lineTo(fx + 14, fy);
          ctx.lineTo(fx, fy + 30);
          ctx.fill();
        }
      }, 320);
      tile(W, scroll, 0.42, 520, (x, i) => plush(ctx, x + 260, ((i % 2) + 2) % 2, 0.45), 120);
    },
    ground(ctx, W, VH, scroll) {
      // клавиши пианино
      ctx.fillStyle = '#3A2A30';
      ctx.fillRect(0, G, W, VH - G);
      ctx.fillStyle = '#FFFDF8';
      ctx.fillRect(0, G, W, 48);
      tile(W, scroll, 1, 28, (x, i) => {
        ctx.fillStyle = 'rgba(90,60,70,.45)';
        ctx.fillRect(x, G, 1.5, 48);
        const k = ((i % 7) + 7) % 7;
        if (k !== 2 && k !== 6) {
          ctx.fillStyle = '#3A2A30';
          rr(ctx, x + 19, G, 18, 30, 3);
          ctx.fill();
        }
      }, 40);
      ctx.fillStyle = '#C2506B';
      ctx.fillRect(0, G, W, 4);
    },
    column(ctx, x, y, w, h, capAt, seed, t) {
      // праздничная свеча в полоску
      const bx = x + 12;
      const bw = w - 24;
      ctx.fillStyle = '#FFFDFB';
      ctx.fillRect(bx, y, bw, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, y, bw, h);
      ctx.clip();
      ctx.fillStyle = '#F58CA5';
      const start = Math.floor(y / 36) * 36 - 72;
      for (let yy = start; yy < y + h + 60; yy += 36) {
        ctx.beginPath();
        ctx.moveTo(bx, yy + bw * 0.9);
        ctx.lineTo(bx + bw, yy);
        ctx.lineTo(bx + bw, yy + 17);
        ctx.lineTo(bx, yy + bw * 0.9 + 17);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fillRect(bx + 6, y, 7, h);
      ctx.restore();
      colOutline(ctx, bx, y, bw, h, '#C96A84');
      const cy = capAt === 'top' ? y : y + h - 20;
      ctx.fillStyle = hgrad(ctx, x, x + w, ['#E3B25A', '#FBE4A6', '#E9BE6B']);
      rr(ctx, x + 2, cy, w - 4, 20, 8);
      ctx.fill();
      ctx.strokeStyle = '#B88A38';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      if (capAt === 'top') {
        // огонёк (декоративный — не задевает Мию)
        const fl = 1 + Math.sin(t * 13 + seed) * 0.08;
        const fx = x + w / 2;
        ctx.strokeStyle = '#6B4A3A';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(fx, cy);
        ctx.lineTo(fx, cy - 5);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,196,60,.28)';
        ctx.beginPath();
        ctx.arc(fx, cy - 15, 17 * fl, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#FFB830';
        ctx.beginPath();
        ctx.moveTo(fx, cy - 30 * fl);
        ctx.quadraticCurveTo(fx + 9, cy - 13, fx, cy - 4);
        ctx.quadraticCurveTo(fx - 9, cy - 13, fx, cy - 30 * fl);
        ctx.fill();
        ctx.fillStyle = '#FFF4B8';
        ctx.beginPath();
        ctx.ellipse(fx, cy - 11, 3, 6, 0, 0, TAU);
        ctx.fill();
      }
    },
  },

  /* ---------- 4. Ночной город ---------- */
  night: {
    name: 'Ночной город',
    ambient: 'fireflies',
    hud: '#FFE9C7',
    dark: true,
    sky(ctx, W, VH, t) {
      ctx.fillStyle = vgrad(ctx, 0, G, ['#10112B', '#25205A', '#5B3A82', '#8A4F8F']);
      ctx.fillRect(0, -90, W, VH + 90);
      for (let i = 0; i < 70; i++) {
        const tw = 0.45 + 0.55 * Math.sin(t * (0.8 + hash(i) * 2) + i);
        ctx.fillStyle = `rgba(255,244,214,${0.25 + tw * 0.6})`;
        const s = 1 + hash(i + 40) * 1.6;
        ctx.fillRect(hash(i + 1) * W, hash(i + 20) * 430, s, s);
      }
      // луна
      const mx = W * 0.76;
      ctx.fillStyle = 'rgba(255,240,200,.12)';
      ctx.beginPath();
      ctx.arc(mx, 118, 78, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#FFF1C9';
      ctx.beginPath();
      ctx.arc(mx, 118, 44, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(226,196,150,.45)';
      ctx.beginPath();
      ctx.arc(mx - 14, 106, 8, 0, TAU);
      ctx.arc(mx + 14, 130, 11, 0, TAU);
      ctx.arc(mx + 10, 98, 5, 0, TAU);
      ctx.fill();
    },
    far(ctx, W, scroll) {
      const sky = (factor, period, color, winA, base, seedK) =>
        tile(W, scroll, factor, period, (x, i) => {
          const bw = period - 6;
          const bh = base + hash(i * seedK) * 190;
          ctx.fillStyle = color;
          ctx.fillRect(x, G - bh, bw, bh);
          if (hash(i * 3.3 + seedK) > 0.6) ctx.fillRect(x + bw * 0.4, G - bh - 26, 5, 26);
          ctx.fillStyle = `rgba(255,214,120,${winA})`;
          for (let r = 0; r < bh / 26 - 1; r++)
            for (let c = 0; c < 3; c++) if (hash(i * 17 + r * 5 + c * 3 + seedK) > 0.62) ctx.fillRect(x + 10 + c * ((bw - 20) / 3), G - bh + 14 + r * 26, (bw - 20) / 3 - 8, 12);
        }, period);
      sky(0.1, 86, '#1B1844', 0.22, 150, 1.7);
      sky(0.28, 118, '#221E50', 0.32, 70, 4.1);
    },
    ground(ctx, W, VH, scroll) {
      ctx.fillStyle = '#17153A';
      ctx.fillRect(0, G, W, VH - G);
      ctx.fillStyle = '#463D8C';
      ctx.fillRect(0, G, W, 6);
      tile(W, scroll, 1, 64, (x, i) => {
        ctx.fillStyle = i % 2 ? '#FF8FA8' : '#FFD87A';
        ctx.beginPath();
        ctx.arc(x + 20, G + 20, 3.2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = i % 2 ? 'rgba(255,143,168,.2)' : 'rgba(255,216,122,.2)';
        ctx.beginPath();
        ctx.arc(x + 20, G + 20, 9, 0, TAU);
        ctx.fill();
      }, 30);
    },
    column(ctx, x, y, w, h, capAt, seed) {
      // высотка с горящими окнами
      ctx.fillStyle = hgrad(ctx, x, x + w, ['#6A60D6', '#584FC0', '#463EA6']);
      ctx.fillRect(x, y, w, h);
      const cols = 3;
      const cw = (w - 20) / cols;
      const first = capAt === 'top' ? y + 30 : y + h - 30 - 18;
      const dir = capAt === 'top' ? 1 : -1;
      for (let r = 0; r < 40; r++) {
        const wy = first + dir * r * 28;
        if (wy < y - 20 || wy > y + h) break;
        if (wy < -30 || wy > G + 10) continue;
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = hash(seed * 7.7 + r * 3.1 + c * 1.3) > 0.42 ? '#FFE08A' : '#3A3390';
          ctx.fillRect(x + 12 + c * cw, wy, cw - 6, 18);
        }
      }
      colOutline(ctx, x, y, w, h, '#C9C2FF', 3);
      const cy = capAt === 'top' ? y : y + h - 18;
      ctx.fillStyle = '#FF8FB0';
      rr(ctx, x - 5, cy, w + 10, 18, 5);
      ctx.fill();
      ctx.strokeStyle = '#FFE3EC';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      if (capAt === 'top') {
        ctx.fillStyle = '#FFE08A';
        ctx.beginPath();
        ctx.arc(x + w - 14, cy - 5, 4, 0, TAU);
        ctx.fill();
      }
    },
  },

  /* ---------- 5. Зимняя сказка ---------- */
  winter: {
    name: 'Зимняя сказка',
    ambient: 'snow',
    hud: '#24506B',
    sky(ctx, W, VH) {
      ctx.fillStyle = vgrad(ctx, 0, G, ['#B6DDF8', '#DDF0FC', '#F5FBFF']);
      ctx.fillRect(0, -90, W, VH + 90);
    },
    far(ctx, W, scroll) {
      const hills = (factor, color, base, amp, period) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, G);
        for (let x = 0; x <= W + 20; x += 20) {
          const wx = x + scroll * factor;
          ctx.lineTo(x, G - base - Math.sin(wx / period) * amp - Math.sin(wx / (period * 0.37) + 2) * amp * 0.35);
        }
        ctx.lineTo(W, G);
        ctx.fill();
      };
      hills(0.06, '#DCEEFA', 210, 46, 210);
      const fir = (x, hgt, w, color) => {
        ctx.fillStyle = color;
        for (let k = 0; k < 3; k++) {
          const yy = G - hgt + k * hgt * 0.26;
          const ww = w * (0.5 + k * 0.25);
          ctx.beginPath();
          ctx.moveTo(x, yy);
          ctx.lineTo(x + ww, yy + hgt * 0.42);
          ctx.lineTo(x - ww, yy + hgt * 0.42);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.beginPath();
        ctx.moveTo(x, G - hgt);
        ctx.lineTo(x + w * 0.3, G - hgt + hgt * 0.2);
        ctx.lineTo(x - w * 0.3, G - hgt + hgt * 0.2);
        ctx.fill();
      };
      tile(W, scroll, 0.16, 96, (x, i) => fir(x + hash(i) * 30, 230 + hash(i + 7) * 110, 42, '#8FBFD0'), 80);
      hills(0.26, '#EEF7FD', 90, 30, 150);
      tile(W, scroll, 0.4, 190, (x, i) => fir(x + hash(i + 2) * 60, 170 + hash(i + 11) * 90, 50, '#5E9DB0'), 100);
    },
    ground(ctx, W, VH, scroll) {
      ctx.fillStyle = '#E3F1FB';
      ctx.fillRect(0, G + 8, W, VH - G);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(0, G + 30);
      tile(W, scroll, 1, 70, (x) => {
        ctx.lineTo(x, G + 6);
        ctx.quadraticCurveTo(x + 35, G - 12, x + 70, G + 6);
      }, 70);
      ctx.lineTo(W + 80, G + 30);
      ctx.fill();
      ctx.fillRect(0, G + 6, W, 26);
      tile(W, scroll, 1, 120, (x, i) => {
        ctx.fillStyle = 'rgba(140,190,225,.5)';
        ctx.beginPath();
        ctx.ellipse(x + 50 + hash(i) * 40, G + 34 + hash(i + 1) * 12, 16, 3, 0, 0, TAU);
        ctx.fill();
      }, 60);
    },
    column(ctx, x, y, w, h, capAt, seed) {
      // ледяная колонна
      ctx.fillStyle = hgrad(ctx, x, x + w, ['#9FD3F3', '#E1F5FF', '#C3E7FB', '#8CC8EE']);
      ctx.fillRect(x + 4, y, w - 8, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 4, y, w - 8, h);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      const start = Math.floor(y / 120) * 120 - 120;
      for (let yy = start; yy < y + h + 120; yy += 120) {
        ctx.beginPath();
        ctx.moveTo(x, yy + 70);
        ctx.lineTo(x + w, yy);
        ctx.lineTo(x + w, yy + 16);
        ctx.lineTo(x, yy + 86);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x, yy + 104);
        ctx.lineTo(x + w, yy + 34);
        ctx.lineTo(x + w, yy + 40);
        ctx.lineTo(x, yy + 110);
        ctx.fill();
      }
      ctx.restore();
      colOutline(ctx, x + 4, y, w - 8, h, '#63AEDD');
      if (capAt === 'top') {
        // снежная шапка
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#9CCBEA';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x - 6, y + 16);
        ctx.quadraticCurveTo(x - 8, y - 4, x + w * 0.25, y - 6);
        ctx.quadraticCurveTo(x + w * 0.5, y - 16, x + w * 0.75, y - 6);
        ctx.quadraticCurveTo(x + w + 8, y - 4, x + w + 6, y + 16);
        ctx.quadraticCurveTo(x + w * 0.8, y + 26, x + w * 0.62, y + 15);
        ctx.quadraticCurveTo(x + w * 0.45, y + 30, x + w * 0.28, y + 15);
        ctx.quadraticCurveTo(x + w * 0.1, y + 24, x - 6, y + 16);
        ctx.fill();
        ctx.stroke();
      } else {
        // сосульки
        const by = y + h;
        ctx.fillStyle = '#EAF8FF';
        ctx.strokeStyle = '#63AEDD';
        ctx.lineWidth = 2;
        rr(ctx, x - 3, by - 16, w + 6, 16, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#D5EFFD';
        for (let k = 0; k < 5; k++) {
          const ix = x + 4 + k * ((w - 8) / 5);
          const len = 8 + hash(seed + k * 2.3) * 9;
          ctx.beginPath();
          ctx.moveTo(ix, by - 1);
          ctx.lineTo(ix + (w - 8) / 5, by - 1);
          ctx.lineTo(ix + (w - 8) / 10, by + len);
          ctx.fill();
        }
      }
    },
  },

  /* ---------- 6. Дорога к Насте ---------- */
  love: {
    name: 'Дорога к Насте',
    ambient: 'hearts',
    hud: '#FFF3EA',
    dark: true,
    sky(ctx, W, VH, t) {
      ctx.fillStyle = vgrad(ctx, 0, G, ['#5D4E9E', '#A866A8', '#EE86A2', '#FFC2A0', '#FFE3B8']);
      ctx.fillRect(0, -90, W, VH + 90);
      // закатное солнце
      const sx = W * 0.68;
      const sy = G - 70;
      const g = ctx.createRadialGradient(sx, sy, 20, sx, sy, 300);
      g.addColorStop(0, 'rgba(255,240,200,.75)');
      g.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 300, sy - 300, 600, 600);
      ctx.fillStyle = '#FFF2CF';
      ctx.beginPath();
      ctx.arc(sx, sy, 92, 0, TAU);
      ctx.fill();
    },
    far(ctx, W, scroll) {
      tile(W, scroll, 0.08, 430, (x, i) => {
        cloudHeart(ctx, x + 110, 150 + hash(i) * 120, 34 + hash(i + 3) * 18, 'rgba(255,255,255,.34)');
        cloudHeart(ctx, x + 300, 300 + hash(i + 5) * 110, 20 + hash(i + 8) * 14, 'rgba(255,220,230,.4)');
      }, 200);
      const hills = (factor, color, base, amp, period) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, G);
        for (let x = 0; x <= W + 20; x += 20) {
          const wx = x + scroll * factor;
          ctx.lineTo(x, G - base - Math.sin(wx / period) * amp - Math.sin(wx / (period * 0.41) + 1) * amp * 0.3);
        }
        ctx.lineTo(W, G);
        ctx.fill();
      };
      hills(0.14, 'rgba(160,84,150,.55)', 120, 46, 190);
      hills(0.3, 'rgba(112,70,140,.6)', 56, 28, 130);
    },
    ground(ctx, W, VH, scroll) {
      ctx.fillStyle = '#5E9A68';
      ctx.fillRect(0, G, W, VH - G);
      ctx.fillStyle = '#86BD7F';
      ctx.fillRect(0, G, W, 12);
      tile(W, scroll, 1, 48, (x, i) => {
        const fx = x + hash(i) * 26;
        const fy = G + 16 + hash(i + 4) * 26;
        const rose = hash(i + 9) > 0.45;
        ctx.fillStyle = rose ? '#FFFDF6' : '#FFB3C6';
        ctx.beginPath();
        ctx.arc(fx, fy, rose ? 7 : 4.5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rose ? '#F2DDB8' : '#FFE08A';
        ctx.beginPath();
        ctx.arc(fx, fy, rose ? 2.6 : 1.8, 0, TAU);
        ctx.fill();
      }, 40);
      ctx.fillStyle = '#4B8257';
      ctx.fillRect(0, G, W, 2.5);
    },
    column(ctx, x, y, w, h, capAt, seed) {
      // мраморная колонна, увитая белыми розами
      const bx = x + 8;
      const bw = w - 16;
      ctx.fillStyle = hgrad(ctx, bx, bx + bw, ['#EBD9E0', '#FFFFFF', '#FBF2F4', '#E3CDD6']);
      ctx.fillRect(bx, y, bw, h);
      ctx.strokeStyle = 'rgba(190,150,165,.4)';
      ctx.lineWidth = 2;
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(bx + (bw * k) / 4, y);
        ctx.lineTo(bx + (bw * k) / 4, y + h);
        ctx.stroke();
      }
      colOutline(ctx, bx, y, bw, h, '#C493A8');
      // лоза
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx - 6, Math.max(y, -20), bw + 12, Math.min(h, G + 40));
      ctx.clip();
      ctx.strokeStyle = '#6FA86B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      const y0 = Math.max(y, -20);
      const y1 = Math.min(y + h, G + 20);
      for (let yy = y0; yy <= y1; yy += 8) {
        const vx = x + w / 2 + Math.sin(yy / 34 + seed) * (bw / 2 - 3);
        if (yy === y0) ctx.moveTo(vx, yy);
        else ctx.lineTo(vx, yy);
      }
      ctx.stroke();
      const first = Math.floor(y0 / 54) * 54;
      for (let yy = first; yy <= y1; yy += 54) {
        const vx = x + w / 2 + Math.sin(yy / 34 + seed) * (bw / 2 - 3);
        const pink = hash(seed + yy) > 0.6;
        ctx.fillStyle = pink ? '#FFB3C6' : '#FFFDF6';
        ctx.strokeStyle = pink ? '#E27B98' : '#D9C39A';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(vx, yy, 9, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(vx + 1, yy, 4, 0.4, 5);
        ctx.stroke();
      }
      ctx.restore();
      const cy = capAt === 'top' ? y : y + h - 22;
      ctx.fillStyle = hgrad(ctx, x, x + w, ['#F1B9A0', '#FFE7CF', '#F3B6B4']);
      rr(ctx, x - 5, cy, w + 10, 22, 8);
      ctx.fill();
      ctx.strokeStyle = '#C97F8E';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    },
  },
};
