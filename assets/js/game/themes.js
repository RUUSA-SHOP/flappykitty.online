/* Темы раундов: небо, дальние планы, пол и колонны — всё рисуется кодом на canvas,
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

/** Члены плюшевого совета — крупно: зайка в розовом шарфе, мишка с красным бантом, панда в полосатом свитере. */
function council(ctx, x, kind) {
  const ear = (dx, dy, rx, ry, rot, c) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(dx, dy, rx, ry, rot, 0, TAU);
    ctx.fill();
  };
  const blob = (dx, dy, rx, ry, c) => ear(dx, dy, rx, ry, 0, c);
  const face = (y, eye, nose) => {
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.arc(-17, y, 4.5, 0, TAU);
    ctx.arc(17, y, 4.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = nose;
    ctx.beginPath();
    ctx.ellipse(0, y + 13, 6, 4.5, 0, 0, TAU);
    ctx.fill();
  };
  ctx.save();
  ctx.globalAlpha = 0.82;
  ctx.translate(x, G - 18);
  if (kind === 0) {
    // зайка
    ear(-26, -252, 17, 62, -0.2, '#F7ECDF');
    ear(28, -248, 17, 62, 0.28, '#F7ECDF');
    ear(-26, -248, 8, 44, -0.2, '#F6C9D3');
    ear(28, -244, 8, 44, 0.28, '#F6C9D3');
    blob(0, -72, 72, 76, '#F7ECDF');
    blob(0, -72, 40, 46, '#FFF8F0');
    blob(0, -168, 52, 46, '#F7ECDF');
    face(-174, '#5B3A4A', '#E88AA4');
    // розовый шарф
    ctx.fillStyle = '#F29AB4';
    rr(ctx, -50, -134, 100, 22, 11);
    ctx.fill();
    rr(ctx, 16, -126, 22, 62, 9);
    ctx.fill();
  } else if (kind === 1) {
    // мишка
    blob(-40, -206, 20, 20, '#CDAE95');
    blob(40, -206, 20, 20, '#CDAE95');
    blob(-40, -206, 10, 10, '#EBD3BF');
    blob(40, -206, 10, 10, '#EBD3BF');
    blob(0, -70, 72, 74, '#CDAE95');
    blob(0, -66, 40, 44, '#EBD3BF');
    blob(0, -164, 54, 48, '#CDAE95');
    blob(0, -152, 24, 18, '#EBD3BF');
    face(-172, '#4A332B', '#4A332B');
    // красный бант
    ctx.fillStyle = '#D9485F';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, -120);
      ctx.lineTo(s * 34, -138);
      ctx.lineTo(s * 34, -102);
      ctx.closePath();
      ctx.fill();
    }
    blob(0, -120, 9, 9, '#B8364C');
  } else {
    // панда
    blob(-42, -210, 22, 22, '#4A3F4A');
    blob(42, -210, 22, 22, '#4A3F4A');
    // свитер в полоску
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -70, 74, 76, 0, 0, TAU);
    ctx.clip();
    ctx.fillStyle = '#F6B8C8';
    ctx.fillRect(-80, -150, 160, 160);
    ctx.fillStyle = '#FFF4EC';
    for (let yy = -138; yy < 10; yy += 34) ctx.fillRect(-80, yy, 160, 15);
    ctx.restore();
    blob(-66, -84, 20, 34, '#4A3F4A');
    blob(66, -84, 20, 34, '#4A3F4A');
    blob(0, -166, 58, 50, '#FFFFFF');
    ear(-20, -172, 12, 15, 0.35, '#4A3F4A');
    ear(20, -172, 12, 15, -0.35, '#4A3F4A');
    face(-172, '#FFFFFF', '#4A3F4A');
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
   sky и far получают пятым числом k — «прояснение» 0…1 (нужно только теме «Под дождём»).
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

  /* ---------- 6. Под дождём ---------- */
  // k — насколько прояснилось (0 — льёт, 1 — дождь кончился): небо светлеет, выходит радуга
  rain: {
    name: 'Под дождём',
    ambient: 'rain',
    hud: '#2F3A5C',
    sky(ctx, W, VH, t, k = 0) {
      ctx.fillStyle = vgrad(ctx, 0, G, ['#6C7CA6', '#8F9CC0', '#B9C0DA', '#D8D2E4']);
      ctx.fillRect(0, -90, W, VH + 90);
      if (k > 0) {
        ctx.save();
        ctx.globalAlpha = k;
        ctx.fillStyle = vgrad(ctx, 0, G, ['#8EC3EC', '#BFE0F6', '#FBE6DA', '#FFE7C2']);
        ctx.fillRect(0, -90, W, VH + 90);
        // радуга
        const cx = W * 0.5;
        const cy = G + 60;
        const bands = ['#FF8FA8', '#FFB86B', '#FFE27A', '#9ED99A', '#8CC8F2', '#C3A6EC'];
        ctx.globalAlpha = k * 0.55;
        ctx.lineWidth = 15;
        bands.forEach((c, i) => {
          ctx.strokeStyle = c;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(120, W * 0.62 + 150) - i * 15, Math.PI, TAU);
          ctx.stroke();
        });
        ctx.restore();
      }
    },
    far(ctx, W, scroll, t, k = 0) {
      // тучи: после дождя редеют и белеют
      tile(W, scroll, 0.05, 330, (x, i) => {
        const y = 70 + hash(i) * 90;
        ctx.fillStyle = k > 0.5 ? `rgba(255,255,255,${0.75 - k * 0.3})` : `rgba(96,108,150,${0.5 - k * 0.3})`;
        ctx.beginPath();
        ctx.ellipse(x + 90, y, 78, 26, 0, 0, TAU);
        ctx.ellipse(x + 50, y - 16, 40, 26, 0, 0, TAU);
        ctx.ellipse(x + 112, y - 22, 48, 30, 0, 0, TAU);
        ctx.fill();
      }, 200);
      // дома с тёплыми окнами
      const houses = (factor, period, color, roof, winA, base, seedK) =>
        tile(W, scroll, factor, period, (x, i) => {
          const bw = period - 10;
          const bh = base + hash(i * seedK) * 120;
          ctx.fillStyle = color;
          ctx.fillRect(x, G - bh, bw, bh);
          ctx.fillStyle = roof;
          ctx.beginPath();
          ctx.moveTo(x - 6, G - bh);
          ctx.lineTo(x + bw / 2, G - bh - 34);
          ctx.lineTo(x + bw + 6, G - bh);
          ctx.fill();
          ctx.fillStyle = `rgba(255,222,150,${winA})`;
          for (let r = 0; r < bh / 34 - 1; r++)
            for (let c = 0; c < 3; c++) if (hash(i * 13 + r * 5 + c * 3 + seedK) > 0.45) rr(ctx, x + 12 + c * ((bw - 24) / 3), G - bh + 16 + r * 34, (bw - 24) / 3 - 9, 16, 3), ctx.fill();
        }, period);
      houses(0.1, 132, '#7F8BB4', '#6C78A4', 0.5, 150, 1.9);
      houses(0.26, 170, '#6A769F', '#58648E', 0.75, 70, 3.7);
      // зонтики сохнут у дороги
      tile(W, scroll, 0.5, 410, (x, i) => {
        const ux = x + 150;
        const color = ['#F58CA5', '#F4C97B', '#9CC7E8', '#C9A7E8'][((i % 4) + 4) % 4];
        ctx.strokeStyle = 'rgba(70,60,90,.55)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ux, G - 86);
        ctx.lineTo(ux, G - 8);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(ux, G - 84, 46, Math.PI, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.beginPath();
        ctx.arc(ux, G - 84, 46, Math.PI * 1.28, Math.PI * 1.5);
        ctx.lineTo(ux, G - 84);
        ctx.fill();
      }, 120);
    },
    ground(ctx, W, VH, scroll) {
      ctx.fillStyle = '#67739A';
      ctx.fillRect(0, G, W, VH - G);
      ctx.fillStyle = '#98A4C6';
      ctx.fillRect(0, G, W, 7);
      // лужи с бликами
      tile(W, scroll, 1, 150, (x, i) => {
        const px = x + 30 + hash(i) * 50;
        ctx.fillStyle = 'rgba(214,226,246,.42)';
        ctx.beginPath();
        ctx.ellipse(px, G + 28 + hash(i + 2) * 12, 40 + hash(i + 5) * 22, 8, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.beginPath();
        ctx.ellipse(px - 10, G + 26 + hash(i + 2) * 12, 12, 2, 0, 0, TAU);
        ctx.fill();
      }, 80);
      ctx.fillStyle = '#4D587F';
      ctx.fillRect(0, G, W, 2.5);
    },
    column(ctx, x, y, w, h, capAt) {
      // водосточная труба с розовым раструбом — в цвет дождевика
      const bx = x + 13;
      const bw = w - 26;
      ctx.fillStyle = hgrad(ctx, bx, bx + bw, ['#8799AE', '#D3DEE8', '#B4C3D2', '#8A9BB0']);
      ctx.fillRect(bx, y, bw, h);
      colOutline(ctx, bx, y, bw, h, '#4F5F7D');
      // хомуты
      const dir = capAt === 'top' ? 1 : -1;
      const first = capAt === 'top' ? y + 74 : y + h - 74 - 12;
      ctx.fillStyle = '#6F8098';
      for (let r = 0; r < 14; r++) {
        const by = first + dir * r * 104;
        if (by < y || by > y + h - 12) break;
        if (by < -40 || by > G + 20) continue;
        rr(ctx, bx - 4, by, bw + 8, 12, 4);
        ctx.fill();
      }
      const cy = capAt === 'top' ? y : y + h - 26;
      ctx.fillStyle = hgrad(ctx, x, x + w, ['#F27C99', '#FFC3D0', '#F58CA5']);
      rr(ctx, x - 5, cy, w + 10, 26, 9);
      ctx.fill();
      ctx.strokeStyle = '#B9506E';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      rr(ctx, x + 4, cy + 6, w - 8, 4, 2);
      ctx.fill();
    },
  },

  /* ---------- 7. Лягушачий пруд ---------- */
  pond: {
    name: 'Лягушачий пруд',
    ambient: 'pollen',
    hud: '#245B4A',
    sky(ctx, W, VH) {
      ctx.fillStyle = vgrad(ctx, 0, G, ['#A9E0DC', '#CDEFD9', '#EEF6C9', '#FFF0B8']);
      ctx.fillRect(0, -90, W, VH + 90);
      // летнее солнце
      const sx = W * 0.74;
      const g = ctx.createRadialGradient(sx, 120, 10, sx, 120, 230);
      g.addColorStop(0, 'rgba(255,250,210,.9)');
      g.addColorStop(1, 'rgba(255,250,210,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 230, -110, 460, 460);
      ctx.fillStyle = '#FFF8D6';
      ctx.beginPath();
      ctx.arc(sx, 120, 40, 0, TAU);
      ctx.fill();
    },
    far(ctx, W, scroll, t) {
      // дальний берег и ивы
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
      hills(0.08, 'rgba(120,190,150,.5)', 150, 40, 210);
      hills(0.18, 'rgba(92,170,128,.6)', 84, 30, 150);
      // камыши
      tile(W, scroll, 0.36, 74, (x, i) => {
        const hh = 110 + hash(i) * 130;
        const lean = (hash(i + 7) - 0.5) * 26 + Math.sin(t * 0.9 + i) * 4;
        ctx.strokeStyle = 'rgba(70,140,90,.75)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 20, G);
        ctx.quadraticCurveTo(x + 20, G - hh * 0.5, x + 20 + lean, G - hh);
        ctx.stroke();
        if (hash(i + 3) > 0.4) {
          ctx.fillStyle = 'rgba(122,82,52,.8)';
          ctx.save();
          ctx.translate(x + 20 + lean, G - hh);
          ctx.rotate(lean / 90);
          rr(ctx, -4.5, -26, 9, 30, 4.5);
          ctx.fill();
          ctx.restore();
        }
      }, 60);
      // стрекозы
      tile(W, scroll, 0.22, 520, (x, i) => {
        const dx = x + 200 + Math.sin(t * 1.3 + i * 2) * 30;
        const dy = 210 + hash(i) * 190 + Math.cos(t * 1.7 + i) * 14;
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.beginPath();
        ctx.ellipse(dx - 2, dy - 5, 11, 3.5, -0.5, 0, TAU);
        ctx.ellipse(dx - 2, dy + 5, 11, 3.5, 0.5, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#3F8FB0';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(dx - 12, dy);
        ctx.lineTo(dx + 10, dy);
        ctx.stroke();
        ctx.lineCap = 'butt';
      }, 260);
    },
    ground(ctx, W, VH, scroll) {
      // вода с кувшинками
      ctx.fillStyle = vgrad(ctx, G, VH, ['#5DBDB2', '#3F9C97']);
      ctx.fillRect(0, G, W, VH - G);
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.fillRect(0, G, W, 4);
      tile(W, scroll, 1, 118, (x, i) => {
        const lx = x + 20 + hash(i) * 40;
        const ly = G + 22 + hash(i + 4) * 16;
        const lr = 24 + hash(i + 6) * 10;
        ctx.fillStyle = '#6FBF5B';
        ctx.beginPath();
        ctx.ellipse(lx, ly, lr, lr * 0.36, 0, 0.35, TAU - 0.1);
        ctx.lineTo(lx, ly);
        ctx.fill();
        ctx.strokeStyle = '#3F8F45';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (hash(i + 9) > 0.5) {
          // розовый лотос
          ctx.fillStyle = '#FFB3C6';
          for (let k = -1; k <= 1; k++) {
            ctx.beginPath();
            ctx.ellipse(lx + k * 6 - 4, ly - 6, 4, 8, k * 0.5, 0, TAU);
            ctx.fill();
          }
          ctx.fillStyle = '#FFE08A';
          ctx.beginPath();
          ctx.arc(lx - 4, ly - 4, 2.4, 0, TAU);
          ctx.fill();
        }
      }, 70);
      ctx.fillStyle = '#2F8580';
      ctx.fillRect(0, G, W, 2.5);
    },
    column(ctx, x, y, w, h, capAt, seed) {
      // толстый стебель с листьями, на конце — лотос
      const bx = x + 14;
      const bw = w - 28;
      ctx.fillStyle = hgrad(ctx, bx, bx + bw, ['#5FA653', '#A8DC8C', '#86C672', '#5C9F50']);
      ctx.fillRect(bx, y, bw, h);
      colOutline(ctx, bx, y, bw, h, '#2F7A3C');
      const dir = capAt === 'top' ? 1 : -1;
      const first = capAt === 'top' ? y + 66 : y + h - 66;
      for (let r = 0; r < 14; r++) {
        const ny = first + dir * r * 92;
        if (ny < y + 4 || ny > y + h - 4) break;
        if (ny < -40 || ny > G + 20) continue;
        // узел стебля и лист в сторону
        ctx.strokeStyle = '#2F7A3C';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx, ny);
        ctx.lineTo(bx + bw, ny);
        ctx.stroke();
        const side = hash(seed * 3.1 + r) > 0.5 ? 1 : -1;
        ctx.fillStyle = '#7CC563';
        ctx.beginPath();
        const lx = side > 0 ? bx + bw : bx;
        ctx.moveTo(lx, ny);
        ctx.quadraticCurveTo(lx + side * 18, ny - 20, lx + side * 30, ny - 6);
        ctx.quadraticCurveTo(lx + side * 16, ny + 4, lx, ny);
        ctx.fill();
        ctx.stroke();
      }
      // лотос на конце
      const cy = capAt === 'top' ? y + 4 : y + h - 4;
      const up = capAt === 'top' ? -1 : 1;
      ctx.strokeStyle = '#D9799A';
      ctx.lineWidth = 2;
      for (const [dx, rot, c] of [[-24, -0.75, '#F9A9C0'], [24, 0.75, '#F9A9C0'], [-12, -0.35, '#FFC4D4'], [12, 0.35, '#FFC4D4'], [0, 0, '#FFE1E9']]) {
        ctx.save();
        ctx.translate(x + w / 2 + dx, cy);
        ctx.rotate(rot * -up);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(0, up * -2, 11, 21, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#6FBF5B';
      ctx.strokeStyle = '#2F7A3C';
      rr(ctx, x - 3, capAt === 'top' ? y + 8 : y + h - 20, w + 6, 12, 6);
      ctx.fill();
      ctx.stroke();
    },
  },

  /* ---------- 8. Плюшевый совет ---------- */
  plush: {
    name: 'Плюшевый совет',
    ambient: 'dust',
    hud: '#6B3A2A',
    sky(ctx, W, VH) {
      ctx.fillStyle = vgrad(ctx, 0, G, ['#FFF6EA', '#FFEBD8', '#FBDCC8']);
      ctx.fillRect(0, -90, W, VH + 90);
      // тёплый свет торшера
      const g = ctx.createRadialGradient(W * 0.3, 60, 20, W * 0.3, 60, 420);
      g.addColorStop(0, 'rgba(255,238,190,.75)');
      g.addColorStop(1, 'rgba(255,238,190,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, -90, W, 560);
    },
    far(ctx, W, scroll) {
      // обои в мелкое сердечко
      tile(W, scroll, 0.06, 86, (x, i) => {
        for (let r = 0; r < 6; r++) cloudHeart(ctx, x + (r % 2 ? 43 : 0) + 20, 70 + r * 78, 5, 'rgba(240,170,170,.22)');
      }, 60);
      // полка с коробками коллекции (без лиц: это просто коробки)
      tile(W, scroll, 0.14, 380, (x, i) => {
        const sy = 250 + (((i % 2) + 2) % 2) * 60;
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        rr(ctx, x + 40, sy, 250, 10, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(214,180,160,.5)';
        ctx.fillRect(x + 40, sy + 10, 250, 4);
        for (let b = 0; b < 3; b++) {
          const bx = x + 62 + b * 74;
          const bh = 62 + hash(i * 5 + b) * 26;
          ctx.fillStyle = ['rgba(246,184,200,.8)', 'rgba(244,201,123,.8)', 'rgba(191,224,213,.85)', 'rgba(201,182,232,.8)'][Math.floor(hash(i * 3 + b + 1) * 4)];
          rr(ctx, bx, sy - bh, 54, bh, 5);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.7)';
          rr(ctx, bx + 9, sy - bh + 10, 36, bh - 30, 4);
          ctx.fill();
        }
      }, 200);
      // плинтус
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.fillRect(0, G - 22, W, 22);
      // совет в сборе: зайка, мишка и панда — большие и важные
      tile(W, scroll, 0.4, 330, (x, i) => council(ctx, x + 170, ((i % 3) + 3) % 3), 170);
    },
    ground(ctx, W, VH, scroll) {
      // белый диван, простроченный ромбами
      ctx.fillStyle = '#FFF9F3';
      ctx.fillRect(0, G, W, VH - G);
      ctx.fillStyle = '#F6C3CF';
      ctx.fillRect(0, G, W, 8);
      ctx.strokeStyle = 'rgba(214,180,160,.55)';
      ctx.lineWidth = 2;
      tile(W, scroll, 1, 72, (x) => {
        ctx.beginPath();
        ctx.moveTo(x, G + 8);
        ctx.lineTo(x + 36, G + 40);
        ctx.lineTo(x, G + 72);
        ctx.moveTo(x + 72, G + 8);
        ctx.lineTo(x + 36, G + 40);
        ctx.lineTo(x + 72, G + 72);
        ctx.stroke();
        ctx.fillStyle = 'rgba(232,160,180,.8)';
        ctx.beginPath();
        ctx.arc(x + 36, G + 40, 3.2, 0, TAU);
        ctx.fill();
      }, 40);
      ctx.fillStyle = '#E79DB0';
      ctx.fillRect(0, G, W, 2.5);
    },
    column(ctx, x, y, w, h, capAt, seed) {
      // стопка подарочных коробок, сверху — крышка с бантом
      const bx = x + 7;
      const bw = w - 14;
      const colors = [['#F6B8C8', '#E48AA4'], ['#F4D08A', '#DDA94E'], ['#BFE0D5', '#8CC0AE'], ['#CDBBEA', '#A48AD0']];
      const BOX = 68;
      const dir = capAt === 'top' ? 1 : -1;
      const start = capAt === 'top' ? y + 22 : y + h - 22;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 8, y, w + 16, h);
      ctx.clip();
      for (let r = 0; r < 16; r++) {
        const by = dir > 0 ? start + r * BOX : start - (r + 1) * BOX;
        if (dir > 0 ? by > y + h : by + BOX < y) break;
        if (by > G + 30 || by + BOX < -60) continue;
        const [fill, edge] = colors[Math.floor(hash(seed * 5.3 + r * 2.1) * 4)];
        const inset = hash(seed + r * 1.7) * 5;
        ctx.fillStyle = fill;
        rr(ctx, bx + inset, by + 1, bw - inset * 2, BOX - 2, 6);
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // лента
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.fillRect(x + w / 2 - 6, by + 2, 12, BOX - 4);
        ctx.fillRect(bx + inset + 2, by + BOX / 2 - 5, bw - inset * 2 - 4, 10);
      }
      ctx.restore();
      // крышка с бантом
      const cy = capAt === 'top' ? y : y + h - 22;
      ctx.fillStyle = '#FFF7EE';
      rr(ctx, x - 5, cy, w + 10, 22, 7);
      ctx.fill();
      ctx.strokeStyle = '#E79DB0';
      ctx.lineWidth = 3;
      ctx.stroke();
      const by = capAt === 'top' ? cy - 2 : cy + 24;
      const up = capAt === 'top' ? -1 : 1;
      ctx.fillStyle = '#F27C99';
      ctx.strokeStyle = '#B9506E';
      ctx.lineWidth = 2;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + w / 2, by);
        ctx.quadraticCurveTo(x + w / 2 + sx * 26, by + up * 24, x + w / 2 + sx * 20, by + up * 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x + w / 2, by + up * 3, 5.5, 0, TAU);
      ctx.fill();
      ctx.stroke();
    },
  },

  /* ---------- 9. Поцелуй или кусь ---------- */
  gothic: {
    name: 'Поцелуй или кусь',
    ambient: 'embers',
    hud: '#FFE3EF',
    dark: true,
    sky(ctx, W, VH, t) {
      ctx.fillStyle = vgrad(ctx, 0, G, ['#160A22', '#30103F', '#6E1B5E', '#B8337A', '#E0679A']);
      ctx.fillRect(0, -90, W, VH + 90);
      for (let i = 0; i < 46; i++) {
        const tw = 0.4 + 0.6 * Math.sin(t * (0.7 + hash(i) * 2) + i);
        ctx.fillStyle = `rgba(255,196,224,${0.2 + tw * 0.55})`;
        const s = 1 + hash(i + 40) * 1.7;
        ctx.fillRect(hash(i + 1) * W, hash(i + 20) * 380, s, s);
      }
      // розовая луна
      const mx = W * 0.7;
      const g = ctx.createRadialGradient(mx, 128, 30, mx, 128, 210);
      g.addColorStop(0, 'rgba(255,150,200,.5)');
      g.addColorStop(1, 'rgba(255,150,200,0)');
      ctx.fillStyle = g;
      ctx.fillRect(mx - 210, -90, 420, 430);
      ctx.fillStyle = '#FFB1D4';
      ctx.beginPath();
      ctx.arc(mx, 128, 60, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(226,110,165,.5)';
      for (const [dx, dy, r] of [[-20, -18, 11], [20, 18, 15], [16, -28, 7]]) {
        ctx.beginPath();
        ctx.arc(mx + dx, 128 + dy, r, 0, TAU);
        ctx.fill();
      }
    },
    far(ctx, W, scroll, t) {
      // замок с башнями
      tile(W, scroll, 0.09, 460, (x, i) => {
        ctx.fillStyle = '#2A0F38';
        const base = G - 150;
        ctx.fillRect(x + 60, base, 250, 150);
        for (const [tx, tw, th] of [[60, 46, 150], [138, 60, 220], [240, 44, 130], [286, 30, 90]]) {
          const hh = th + hash(i + tx) * 30;
          ctx.fillRect(x + tx, base - hh, tw, hh);
          ctx.beginPath();
          ctx.moveTo(x + tx - 7, base - hh);
          ctx.lineTo(x + tx + tw / 2, base - hh - tw * 1.25);
          ctx.lineTo(x + tx + tw + 7, base - hh);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,170,205,.75)';
          ctx.beginPath();
          ctx.arc(x + tx + tw / 2, base - hh + 30, 6, Math.PI, TAU);
          ctx.rect(x + tx + tw / 2 - 6, base - hh + 30, 12, 13);
          ctx.fill();
          ctx.fillStyle = '#2A0F38';
        }
      }, 320);
      // ограда и фонари
      ctx.fillStyle = '#1C0A26';
      tile(W, scroll, 0.3, 26, (x) => {
        ctx.fillRect(x + 10, G - 62, 4, 62);
        ctx.beginPath();
        ctx.moveTo(x + 6, G - 62);
        ctx.lineTo(x + 12, G - 76);
        ctx.lineTo(x + 18, G - 62);
        ctx.fill();
      }, 20);
      ctx.fillRect(0, G - 46, W, 4);
      tile(W, scroll, 0.3, 312, (x, i) => {
        const lx = x + 140;
        ctx.fillStyle = '#1C0A26';
        ctx.fillRect(lx - 3, G - 150, 6, 150);
        const fl = 0.75 + 0.25 * Math.sin(t * 5 + i);
        ctx.fillStyle = `rgba(255,150,200,${0.22 * fl})`;
        ctx.beginPath();
        ctx.arc(lx, G - 164, 40, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#1C0A26';
        rr(ctx, lx - 11, G - 182, 22, 34, 4);
        ctx.fill();
        ctx.fillStyle = `rgba(255,190,220,${0.75 + 0.25 * fl})`;
        rr(ctx, lx - 6, G - 176, 12, 22, 3);
        ctx.fill();
      }, 80);
    },
    ground(ctx, W, VH, scroll) {
      ctx.fillStyle = '#1D0B29';
      ctx.fillRect(0, G, W, VH - G);
      ctx.fillStyle = '#5B1F60';
      ctx.fillRect(0, G, W, 6);
      // розовые тыквы
      tile(W, scroll, 1, 132, (x, i) => {
        const px = x + 30 + hash(i) * 50;
        const py = G + 30 + hash(i + 3) * 10;
        const s = 0.8 + hash(i + 6) * 0.5;
        ctx.fillStyle = '#EE6FA4';
        ctx.beginPath();
        ctx.ellipse(px - 9 * s, py, 11 * s, 12 * s, 0, 0, TAU);
        ctx.ellipse(px + 9 * s, py, 11 * s, 12 * s, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#FF93BE';
        ctx.beginPath();
        ctx.ellipse(px, py, 10 * s, 13 * s, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#7BC47A';
        ctx.fillRect(px - 2, py - 18 * s, 4, 7 * s);
      }, 70);
      ctx.fillStyle = '#12061A';
      ctx.fillRect(0, G, W, 2.5);
    },
    column(ctx, x, y, w, h, capAt, seed, t = 0) {
      // готическая башенка: тёмный камень, стрельчатые окна, кружево с чёрным бантом
      ctx.fillStyle = hgrad(ctx, x, x + w, ['#3A1648', '#5E2670', '#48195A', '#33123F']);
      ctx.fillRect(x, y, w, h);
      const dir = capAt === 'top' ? 1 : -1;
      const first = capAt === 'top' ? y + 52 : y + h - 52 - 40;
      for (let r = 0; r < 20; r++) {
        const wy = first + dir * r * 86;
        if (wy < y - 10 || wy > y + h - 30) break;
        if (wy < -60 || wy > G + 10) continue;
        const lit = hash(seed * 6.1 + r * 2.3) > 0.35;
        ctx.fillStyle = lit ? '#FF9CC8' : '#240C30';
        ctx.beginPath();
        ctx.moveTo(x + w / 2 - 11, wy + 40);
        ctx.lineTo(x + w / 2 - 11, wy + 14);
        ctx.quadraticCurveTo(x + w / 2 - 11, wy, x + w / 2, wy - 4);
        ctx.quadraticCurveTo(x + w / 2 + 11, wy, x + w / 2 + 11, wy + 14);
        ctx.lineTo(x + w / 2 + 11, wy + 40);
        ctx.fill();
        if (lit) {
          ctx.strokeStyle = '#48195A';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + w / 2, wy - 2);
          ctx.lineTo(x + w / 2, wy + 40);
          ctx.moveTo(x + w / 2 - 11, wy + 22);
          ctx.lineTo(x + w / 2 + 11, wy + 22);
          ctx.stroke();
        }
      }
      colOutline(ctx, x, y, w, h, '#FFA6CF', 3);
      // кружевная кайма
      const cy = capAt === 'top' ? y : y + h - 20;
      ctx.fillStyle = '#FF8FBE';
      rr(ctx, x - 5, cy, w + 10, 20, 5);
      ctx.fill();
      ctx.strokeStyle = '#FFE3EF';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#FFE3EF';
      const ly = capAt === 'top' ? cy + 20 : cy;
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        ctx.arc(x + 2 + k * ((w - 4) / 5), ly, 6, capAt === 'top' ? 0 : Math.PI, capAt === 'top' ? Math.PI : TAU);
        ctx.fill();
      }
      // чёрный бант
      ctx.fillStyle = '#1B0A24';
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + w / 2, cy + 10);
        ctx.lineTo(x + w / 2 + sx * 17, cy + 1);
        ctx.lineTo(x + w / 2 + sx * 17, cy + 19);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#FF5C9A';
      ctx.beginPath();
      ctx.arc(x + w / 2, cy + 10, 4.5, 0, TAU);
      ctx.fill();
      if (capAt === 'top') {
        // свеча на нижней башенке
        const fl = Math.sin(t * 9 + seed * 3) * 1.6;
        ctx.fillStyle = '#FFF1F6';
        rr(ctx, x + w - 22, cy - 22, 9, 22, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,200,120,.3)';
        ctx.beginPath();
        ctx.arc(x + w - 17.5, cy - 30, 13, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#FFD27A';
        ctx.beginPath();
        ctx.ellipse(x + w - 17.5 + fl * 0.4, cy - 30, 3.6, 7.5 + fl * 0.5, 0, 0, TAU);
        ctx.fill();
      }
    },
  },

  /* ---------- 10. Дорога к Насте ---------- */
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
  /* ============================================================
     ГЛАВА 2. Десять новых миров (раунды 11–20)
     ============================================================ */

  /* ---------- 11. Чердак ---------- */
  attic: {
    name: 'Чердак',
    ambient: 'dust',
    hud: '#4A3A2A',
    sky(ctx, W, VH) {
      ctx.fillStyle = vgrad(ctx, 0, G, ['#5C4A38', '#7A6450', '#9C8368']);
      ctx.fillRect(0, -90, W, VH + 90);
      // свет из слухового окна
      const g = ctx.createRadialGradient(W * 0.5, 150, 10, W * 0.5, 150, 420);
      g.addColorStop(0, 'rgba(255,236,190,.5)');
      g.addColorStop(1, 'rgba(255,236,190,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, -90, W, VH + 90);
    },
    far(ctx, W, scroll) {
      // стропила
      tile(W, scroll, 0.1, 260, (x) => {
        ctx.strokeStyle = '#4B3B2C';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 130, G);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 260, 0);
        ctx.lineTo(x + 130, G);
        ctx.stroke();
      }, 140);
      // коробки и сундуки
      tile(W, scroll, 0.42, 240, (x, i) => {
        const bw = 60 + hash(i) * 40;
        const bh = 50 + hash(i + 4) * 55;
        const bx = x + 30;
        const by = G - bh;
        ctx.fillStyle = ['#B08A5E', '#9E7A50', '#C29A6A'][i % 3];
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = 'rgba(255,255,255,.22)';
        ctx.fillRect(bx, by, bw, 6);
        ctx.strokeStyle = 'rgba(70,50,30,.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);
        ctx.beginPath();
        ctx.moveTo(bx + bw / 2, by);
        ctx.lineTo(bx + bw / 2, by + bh);
        ctx.stroke();
      }, 120);
    },
    ground(ctx, W, VH, scroll) {
      ctx.fillStyle = '#6B563F';
      ctx.fillRect(0, G, W, VH - G);
      ctx.fillStyle = '#8A7050';
      for (let i = 0; i < 8; i++) ctx.fillRect(i * (W / 8), G, 2, VH - G);
      ctx.fillStyle = 'rgba(255,240,210,.35)';
      ctx.fillRect(0, G, W, 4);
    },
    column(ctx, x, y, w, h, capAt, seed) {
      // стопка старых книг и коробок
      ctx.fillStyle = hgrad(ctx, x, x + w, ['#8A6B47', '#B08A5E', '#7A5C3C']);
      ctx.fillRect(x + 3, y, w - 6, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 3, y, w - 6, h);
      ctx.clip();
      const start = Math.floor(y / 42) * 42 - 42;
      for (let yy = start; yy < y + h + 42; yy += 42) {
        const col = ['#C9A063', '#9E7A50', '#D8B47A', '#8C6A44'][Math.floor(hash(yy + seed) * 4)];
        ctx.fillStyle = col;
        ctx.fillRect(x + 6, yy, w - 12, 34);
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        ctx.fillRect(x + 6, yy, w - 12, 4);
        ctx.fillStyle = 'rgba(60,40,20,.35)';
        ctx.fillRect(x + 10, yy + 14, w - 20, 3);
      }
      ctx.restore();
      colOutline(ctx, x + 3, y, w - 6, h, '#5C4529');
      if (capAt === 'top') {
        ctx.fillStyle = '#6B563F';
        rr(ctx, x - 4, y + h - 14, w + 8, 14, 4);
        ctx.fill();
        colOutline(ctx, x - 4, y + h - 14, w + 8, 14, '#4B3B2C', 2);
      } else {
        ctx.fillStyle = '#C9A063';
        rr(ctx, x - 5, y - 4, w + 10, 16, 5);
        ctx.fill();
        colOutline(ctx, x - 5, y - 4, w + 10, 16, '#5C4529', 2);
      }
    },
  },

  /* ---------- 12. Робот-пылесос ---------- */
  vacuum: {
    name: 'Робот-пылесос',
    ambient: 'dust',
    hud: '#2B3A4A',
    sky(ctx, W, VH) {
      ctx.fillStyle = vgrad(ctx, 0, G, ['#DCE9F2', '#EAF3F8', '#F6FAFC']);
      ctx.fillRect(0, -90, W, VH + 90);
    },
    far(ctx, W, scroll) {
      // пол и плинтус, вид сбоку на раунде кошачьих глаз
      tile(W, scroll, 0.16, 380, (x) => {
        ctx.fillStyle = 'rgba(180,200,215,.5)';
        rr(ctx, x + 60, 200, 220, 150, 12);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        rr(ctx, x + 72, 212, 196, 126, 8);
        ctx.fill();
      }, 160);
      // ножки стула
      tile(W, scroll, 0.4, 300, (x, i) => {
        ctx.fillStyle = '#A8B6C2';
        ctx.fillRect(x + 40, G - 150, 12, 150);
        ctx.fillRect(x + 150, G - 150, 12, 150);
        ctx.fillRect(x + 40, G - 156, 122, 10);
      }, 120);
      ctx.fillStyle = 'rgba(200,215,228,.6)';
      ctx.fillRect(0, G - 24, W, 24);
    },
    ground(ctx, W, VH, scroll) {
      ctx.fillStyle = '#B8C6D2';
      ctx.fillRect(0, G, W, VH - G);
      tile(W, scroll, 1, 90, (x) => {
        ctx.strokeStyle = 'rgba(255,255,255,.55)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 6, G + 10, 70, VH - G - 20);
      }, 40);
    },
    column(ctx, x, y, w, h, capAt, seed) {
      // металлическая стойка
      ctx.fillStyle = hgrad(ctx, x, x + w, ['#8FA2B2', '#D6E2EB', '#A8B8C6', '#7E92A2']);
      ctx.fillRect(x + 5, y, w - 10, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 5, y, w - 10, h);
      ctx.clip();
      ctx.fillStyle = 'rgba(90,110,130,.18)';
      for (let yy = Math.floor(y / 26) * 26 - 26; yy < y + h + 26; yy += 26) {
        ctx.fillRect(x + 5, yy, w - 10, 3);
      }
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.fillRect(x + 12, y, 6, h);
      ctx.restore();
      colOutline(ctx, x + 5, y, w - 10, h, '#5E7385');
      if (capAt === 'top') {
        ctx.fillStyle = '#6E8496';
        rr(ctx, x - 4, y - 6, w + 8, 18, 8);
        ctx.fill();
        ctx.fillStyle = '#7FE0A8';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + 3, 3, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = '#6E8496';
        rr(ctx, x - 4, y + h - 10, w + 8, 16, 6);
        ctx.fill();
        ctx.fillStyle = '#F3B33D';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h - 2, 3, 0, TAU);
        ctx.fill();
      }
    },
  },

  /* ---------- 13. Корзинка с нитками ---------- */
  yarn: {
    name: 'Корзинка с нитками',
    ambient: 'dust',
    hud: '#5A3A2E',
    sky(ctx, W, VH) {
      ctx.fillStyle = vgrad(ctx, 0, G, ['#FFF6EC', '#FDECDC', '#F9DFC9']);
      ctx.fillRect(0, -90, W, VH + 90);
    },
    far(ctx, W, scroll) {
      // плетёная корзинка на заднем плане
      tile(W, scroll, 0.12, 420, (x, i) => {
        const bx = x + 90;
        const bw = 240;
        const bh = 130;
        ctx.fillStyle = '#D8A661';
        rr(ctx, bx, G - bh, bw, bh, 18);
        ctx.fill();
        ctx.strokeStyle = 'rgba(150,100,50,.45)';
        ctx.lineWidth = 3;
        for (let k = 1; k < 5; k++) {
          ctx.beginPath();
          ctx.moveTo(bx, G - bh + k * (bh / 5));
          ctx.lineTo(bx + bw, G - bh + k * (bh / 5));
          ctx.stroke();
        }
        for (let k = 1; k < 8; k++) {
          ctx.beginPath();
          ctx.moveTo(bx + k * (bw / 8), G - bh);
          ctx.lineTo(bx + k * (bw / 8), G);
          ctx.stroke();
        }
      }, 160);
      // клубки
      tile(W, scroll, 0.4, 200, (x, i) => {
        const cx = x + 60;
        const cy = G - 34 - hash(i) * 26;
        const r = 22 + hash(i + 5) * 12;
        ctx.fillStyle = ['#F58CA5', '#9CC79A', '#C9A7E8', '#F4C97B'][i % 4];
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.6)';
        ctx.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(cx, cy, r * (0.4 + k * 0.25), 0.6, 4.2);
          ctx.stroke();
        }
      }, 90);
    },
    ground(ctx, W, VH, scroll) {
      ctx.fillStyle = '#E8C99B';
      ctx.fillRect(0, G, W, VH - G);
      ctx.strokeStyle = 'rgba(180,130,70,.4)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const x = i * (W / 14) + (scroll % (W / 14));
        ctx.beginPath();
        ctx.moveTo(x, G);
        ctx.lineTo(x + 14, VH);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.fillRect(0, G, W, 4);
    },
    column(ctx, x, y, w, h, capAt, seed) {
      // натянутые нити
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      const cols = ['#F58CA5', '#9CC79A', '#C9A7E8', '#F4C97B', '#8FC7E8'];
      for (let k = 0; k < 9; k++) {
        ctx.strokeStyle = cols[(k + Math.floor(seed)) % cols.length];
        ctx.lineWidth = 5;
        const off = (k / 9) * w;
        ctx.beginPath();
        ctx.moveTo(x + off, y);
        ctx.lineTo(x + off + 6, y + h);
        ctx.stroke();
      }
      ctx.restore();
      colOutline(ctx, x, y, w, h, '#B0784A');
      if (capAt === 'top') {
        ctx.fillStyle = '#8FD17F';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + 6, 13, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.7)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x + w / 2, y + 6, 7, 0.4, 3.9);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#F58CA5';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h - 6, 13, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.7)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h - 6, 7, 0.4, 3.9);
        ctx.stroke();
      }
    },
  },

  /* ---------- 14. Ванная ---------- */
  bath: {
    name: 'Ванная',
    ambient: 'steam',
    hud: '#1F4E5F',
    sky(ctx, W, VH) {
      ctx.fillStyle = vgrad(ctx, 0, G, ['#D6F0F7', '#E9F8FB', '#F7FEFF']);
      ctx.fillRect(0, -90, W, VH + 90);
    },
    far(ctx, W, scroll) {
      // кафель
      tile(W, scroll, 0.12, 96, (x, i) => {
        for (let r = 0; r < 6; r++) {
          ctx.fillStyle = (r + i) % 2 ? 'rgba(255,255,255,.55)' : 'rgba(190,230,240,.55)';
          ctx.fillRect(x, 120 + r * 88, 94, 86);
        }
      }, 60);
      // кран и труба
      tile(W, scroll, 0.4, 340, (x) => {
        ctx.strokeStyle = '#9FB8C2';
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(x + 40, 0);
        ctx.lineTo(x + 40, 150);
        ctx.lineTo(x + 110, 150);
        ctx.lineTo(x + 110, 200);
        ctx.stroke();
        ctx.fillStyle = '#8AA6B2';
        rr(ctx, x + 96, 190, 28, 16, 4);
        ctx.fill();
      }, 140);
    },
    ground(ctx, W, VH, scroll) {
      ctx.fillStyle = '#C8E4EC';
      ctx.fillRect(0, G, W, VH - G);
      tile(W, scroll, 1, 80, (x) => {
        ctx.strokeStyle = 'rgba(255,255,255,.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 4, G + 8, 70, VH - G - 16);
      }, 40);
    },
    column(ctx, x, y, w, h, capAt, seed) {
      // колонна из бутылочек и стаканчиков
      ctx.fillStyle = hgrad(ctx, x, x + w, ['#B9E4F0', '#EAFBFF', '#B0DCEA']);
      ctx.fillRect(x + 6, y, w - 12, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 6, y, w - 12, h);
      ctx.clip();
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = ['#F7A8C4', '#8FD3F4', '#C9A7E8', '#F4C97B', '#9CC79A'][(k + Math.floor(seed)) % 5];
        const by = y + h - (k + 1) * (h / 5);
        rr(ctx, x + 10, by + 4, w - 20, h / 5 - 8, 6);
        ctx.fill();
      }
      ctx.restore();
      colOutline(ctx, x + 6, y, w - 12, h, '#6FA9BB');
      if (capAt === 'top') {
        ctx.fillStyle = 'rgba(255,255,255,.95)';
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(x - 2 + k * ((w + 4) / 2), y + 2, 10 + k * 2, 0, TAU);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#7FC9DE';
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y + h + 10);
        ctx.quadraticCurveTo(x + w / 2 + 10, y + h - 6, x + w / 2, y + h - 6);
        ctx.quadraticCurveTo(x + w / 2 - 10, y + h - 6, x + w / 2, y + h + 10);
        ctx.fill();
      }
    },
  },

  /* ---------- 15. Двор ---------- */
  street: {
    name: 'Двор',
    ambient: 'pollen',
    hud: '#2F4A2A',
    sky(ctx, W, VH) {
      ctx.fillStyle = vgrad(ctx, 0, G, ['#CDEBFB', '#E4F4FE', '#F6FDFF']);
      ctx.fillRect(0, -90, W, VH + 90);
    },
    far(ctx, W, scroll) {
      // дома
      tile(W, scroll, 0.09, 220, (x, i) => {
        const bh = 190 + hash(i) * 130;
        const bw = 150;
        ctx.fillStyle = ['#E7D3C4', '#D8C6D8', '#CFE0D4', '#E9DCC3'][i % 4];
        ctx.fillRect(x + 20, G - bh, bw, bh);
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        for (let r = 0; r < Math.floor(bh / 48); r++) {
          for (let c = 0; c < 3; c++) {
            ctx.fillRect(x + 36 + c * 44, G - bh + 26 + r * 48, 26, 24);
          }
        }
        ctx.fillStyle = '#B9826A';
        rr(ctx, x + 10, G - bh - 16, bw + 20, 20, 6);
        ctx.fill();
      }, 80);
      // деревья
      tile(W, scroll, 0.3, 260, (x, i) => {
        ctx.fillStyle = '#8A6A48';
        ctx.fillRect(x + 60, G - 120, 12, 120);
        ctx.fillStyle = '#7FB77E';
        ctx.beginPath();
        ctx.arc(x + 66, G - 146, 52, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 34, G - 120, 34, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 98, G - 122, 32, 0, TAU);
        ctx.fill();
      }, 110);
    },
    ground(ctx, W, VH, scroll) {
      ctx.fillStyle = '#9CB88F';
      ctx.fillRect(0, G, W, VH - G);
      ctx.fillStyle = '#B7CFA8';
      ctx.fillRect(0, G, W, 6);
      tile(W, scroll, 1, 150, (x, i) => {
        ctx.fillStyle = 'rgba(120,150,110,.4)';
        ctx.beginPath();
        ctx.ellipse(x + 60, G + 26 + hash(i) * 18, 26, 6, 0, 0, TAU);
        ctx.fill();
      }, 60);
    },
    column(ctx, x, y, w, h, capAt, seed) {
      // ствол дерева с листвой
      ctx.fillStyle = hgrad(ctx, x, x + w, ['#8A6A48', '#B08A5E', '#8A6A48']);
      ctx.fillRect(x + 8, y, w - 16, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 8, y, w - 16, h);
      ctx.clip();
      ctx.strokeStyle = 'rgba(90,60,35,.35)';
      ctx.lineWidth = 3;
      for (let k = 0; k < 14; k++) {
        const yy = y + hash(seed + k) * h;
        ctx.beginPath();
        ctx.moveTo(x + 8, yy);
        ctx.lineTo(x + w - 8, yy + 8);
        ctx.stroke();
      }
      ctx.restore();
      colOutline(ctx, x + 8, y, w - 16, h, '#5E4630');
      if (capAt === 'top') {
        ctx.fillStyle = '#7FB77E';
        ctx.beginPath();
        ctx.arc(x + w / 2, y - 4, 30, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#96C994';
        ctx.beginPath();
        ctx.arc(x + w / 2 - 12, y + 8, 20, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = '#6E5A42';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h, w / 2 + 4, 10, 0, 0, TAU);
        ctx.fill();
      }
    },
  },

  /* ---------- 16. Пекарня ---------- */
  bakery: {
    name: 'Пекарня',
    ambient: 'dust',
    hud: '#5A3A1E',
    sky(ctx, W, VH) {
      ctx.fillStyle = vgrad(ctx, 0, G, ['#FFF1DC', '#FBE3C4', '#F6D6AE']);
      ctx.fillRect(0, -90, W, VH + 90);
    },
    far(ctx, W, scroll) {
      // полки с булками
      tile(W, scroll, 0.13, 300, (x, i) => {
        for (let r = 0; r < 3; r++) {
          const sy = 190 + r * 110;
          ctx.fillStyle = '#C99B62';
          ctx.fillRect(x + 20, sy + 40, 260, 10);
          for (let k = 0; k < 6; k++) {
            ctx.fillStyle = ['#E8B96F', '#DDA95C', '#F0C98A'][(k + r) % 3];
            ctx.beginPath();
            ctx.ellipse(x + 42 + k * 42, sy + 30, 16, 11, 0, 0, TAU);
            ctx.fill();
          }
        }
      }, 120);
      ctx.fillStyle = 'rgba(210,160,100,.35)';
      ctx.fillRect(0, G - 240, W, 6);
    },
    ground(ctx, W, VH, scroll) {
      ctx.fillStyle = '#D9AE79';
      ctx.fillRect(0, G, W, VH - G);
      tile(W, scroll, 1, 70, (x) => {
        ctx.strokeStyle = 'rgba(150,100,50,.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, G + 8, 64, VH - G - 16);
      }, 35);
    },
    column(ctx, x, y, w, h, capAt, seed) {
      // слоёный пирог
      ctx.fillStyle = hgrad(ctx, x, x + w, ['#E0B074', '#F5D9A8', '#D8A45E']);
      ctx.fillRect(x + 4, y, w - 8, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 4, y, w - 8, h);
      ctx.clip();
      for (let yy = Math.floor(y / 34) * 34; yy < y + h + 34; yy += 34) {
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.fillRect(x + 4, yy, w - 8, 5);
        ctx.fillStyle = 'rgba(170,110,50,.2)';
        ctx.fillRect(x + 4, yy + 5, w - 8, 3);
      }
      ctx.restore();
      colOutline(ctx, x + 4, y, w - 8, h, '#A9702F');
      if (capAt === 'top') {
        ctx.fillStyle = '#FFF7E6';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + 2, 20, Math.PI, TAU);
        ctx.fill();
        ctx.fillStyle = '#E8B96F';
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(x + w / 2 - 10 + k * 10, y - 2, 4, 0, TAU);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#C98B3E';
        rr(ctx, x - 2, y + h - 12, w + 4, 14, 5);
        ctx.fill();
      }
    },
  },

  /* ---------- 17. Ящик с игрушками ---------- */
  toybox: {
    name: 'Ящик с игрушками',
    ambient: 'confetti',
    hud: '#3A2A5A',
    sky(ctx, W, VH) {
      ctx.fillStyle = vgrad(ctx, 0, G, ['#E4DEF7', '#EFEAFB', '#F8F5FF']);
      ctx.fillRect(0, -90, W, VH + 90);
    },
    far(ctx, W, scroll) {
      // кубики с буквами
      tile(W, scroll, 0.12, 260, (x, i) => {
        const bx = x + 40;
        const by = G - 150 - hash(i) * 60;
        ctx.fillStyle = ['#F58CA5', '#8FC7E8', '#F4C97B', '#9CC79A'][i % 4];
        rr(ctx, bx, by, 64, 64, 8);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.font = 'bold 30px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('МЯУ'[i % 3], bx + 32, by + 34);
      }, 110);
      // мячики
      tile(W, scroll, 0.35, 190, (x, i) => {
        const cy = G - 24 - hash(i + 3) * 18;
        ctx.fillStyle = ['#F58CA5', '#8FD3F4', '#C9A7E8'][i % 3];
        ctx.beginPath();
        ctx.arc(x + 50, cy, 20, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.beginPath();
        ctx.arc(x + 44, cy - 6, 6, 0, TAU);
        ctx.fill();
      }, 90);
    },
    ground(ctx, W, VH, scroll) {
      ctx.fillStyle = '#C6B8E6';
      ctx.fillRect(0, G, W, VH - G);
      tile(W, scroll, 1, 100, (x, i) => {
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.beginPath();
        ctx.arc(x + 50, G + 30, 6, 0, TAU);
        ctx.fill();
      }, 50);
    },
    column(ctx, x, y, w, h, capAt, seed) {
      // башня из кубиков
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      const size = 40;
      for (let yy = Math.floor(y / size) * size; yy < y + h + size; yy += size) {
        for (let k = 0; k < Math.ceil(w / size); k++) {
          ctx.fillStyle = ['#F58CA5', '#8FC7E8', '#F4C97B', '#9CC79A', '#C9A7E8'][Math.floor(hash(seed + yy + k * 7) * 5)];
          rr(ctx, x + k * size + 2, yy + 2, size - 4, size - 4, 5);
          ctx.fill();
        }
      }
      ctx.restore();
      colOutline(ctx, x, y, w, h, '#7A6AA5');
      if (capAt === 'top') {
        ctx.fillStyle = '#F4C97B';
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y - 16);
        ctx.lineTo(x + w / 2 + 16, y + 4);
        ctx.lineTo(x + w / 2 - 16, y + 4);
        ctx.fill();
      } else {
        ctx.fillStyle = '#8FD3F4';
        rr(ctx, x - 3, y + h - 10, w + 6, 12, 5);
        ctx.fill();
      }
    },
  },

  /* ---------- 18. Камин ---------- */
  fireplace: {
    name: 'Камин',
    ambient: 'embers',
    hud: '#FFE3C8',
    dark: true,
    sky(ctx, W, VH) {
      ctx.fillStyle = vgrad(ctx, 0, G, ['#3A241C', '#5E3226', '#8A4630']);
      ctx.fillRect(0, -90, W, VH + 90);
      // отсвет огня снизу
      const g = ctx.createRadialGradient(W * 0.5, G + 40, 20, W * 0.5, G + 40, 460);
      g.addColorStop(0, 'rgba(255,170,80,.45)');
      g.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, -90, W, VH + 90);
    },
    far(ctx, W, scroll) {
      // кирпичная кладка
      tile(W, scroll, 0.1, 120, (x, i) => {
        for (let r = 0; r < 7; r++) {
          for (let c = 0; c < 2; c++) {
            const off = r % 2 ? 30 : 0;
            ctx.fillStyle = (r + c + i) % 3 ? 'rgba(140,70,50,.55)' : 'rgba(160,85,60,.55)';
            ctx.fillRect(x + c * 60 + off, 140 + r * 62, 56, 58);
          }
        }
      }, 60);
      // языки пламени у пола
      tile(W, scroll, 0.34, 180, (x, i) => {
        const fx = x + 60;
        const fh = 60 + hash(i) * 50;
        ctx.fillStyle = 'rgba(255,150,60,.5)';
        ctx.beginPath();
        ctx.moveTo(fx - 26, G);
        ctx.quadraticCurveTo(fx - 14, G - fh * 0.6, fx, G - fh);
        ctx.quadraticCurveTo(fx + 14, G - fh * 0.6, fx + 26, G);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,220,120,.5)';
        ctx.beginPath();
        ctx.moveTo(fx - 12, G);
        ctx.quadraticCurveTo(fx - 6, G - fh * 0.5, fx, G - fh * 0.7);
        ctx.quadraticCurveTo(fx + 6, G - fh * 0.5, fx + 12, G);
        ctx.fill();
      }, 80);
    },
    ground(ctx, W, VH, scroll) {
      ctx.fillStyle = '#4A2E20';
      ctx.fillRect(0, G, W, VH - G);
      ctx.fillStyle = 'rgba(255,160,70,.35)';
      ctx.fillRect(0, G, W, 5);
    },
    column(ctx, x, y, w, h, capAt, seed) {
      // кирпичная колонна
      ctx.fillStyle = '#8A4630';
      ctx.fillRect(x + 4, y, w - 8, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 4, y, w - 8, h);
      ctx.clip();
      const bh = 34;
      for (let yy = Math.floor(y / bh) * bh; yy < y + h + bh; yy += bh) {
        const row = Math.round(yy / bh);
        const off = row % 2 ? 0 : (w - 8) / 4;
        for (let k = -1; k < 4; k++) {
          ctx.fillStyle = ['#A85A3C', '#94503000', '#B06444'][0];
          ctx.fillStyle = (k + row) % 2 ? '#A85A3C' : '#96503A';
          ctx.fillRect(x + 4 + k * ((w - 8) / 2) + off, yy + 2, (w - 8) / 2 - 4, bh - 4);
        }
      }
      ctx.restore();
      colOutline(ctx, x + 4, y, w - 8, h, '#5A2E1E');
      if (capAt === 'top') {
        ctx.fillStyle = '#5A2E1E';
        rr(ctx, x - 5, y - 6, w + 10, 16, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,170,80,.8)';
        ctx.fillRect(x - 5, y + 8, w + 10, 3);
      } else {
        ctx.fillStyle = '#5A2E1E';
        rr(ctx, x - 5, y + h - 10, w + 10, 16, 4);
        ctx.fill();
      }
    },
  },

  /* ---------- 19. Гроза ---------- */
  storm: {
    name: 'Гроза',
    ambient: 'rain',
    hud: '#E8EEF8',
    dark: true,
    sky(ctx, W, VH) {
      ctx.fillStyle = vgrad(ctx, 0, G, ['#2B3550', '#3E4A66', '#5A6485']);
      ctx.fillRect(0, -90, W, VH + 90);
      // просвет между тучами
      const g = ctx.createRadialGradient(W * 0.66, 200, 20, W * 0.66, 200, 340);
      g.addColorStop(0, 'rgba(180,200,235,.35)');
      g.addColorStop(1, 'rgba(180,200,235,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, -90, W, VH + 90);
    },
    far(ctx, W, scroll) {
      // тяжёлые тучи
      tile(W, scroll, 0.08, 300, (x, i) => {
        ctx.fillStyle = 'rgba(40,50,75,.65)';
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.arc(x + 50 + k * 62, 90 + hash(i + k) * 50, 55 + hash(i + k * 3) * 30, 0, TAU);
          ctx.fill();
        }
      }, 150);
      // силуэты домов
      tile(W, scroll, 0.22, 200, (x, i) => {
        const bh = 140 + hash(i) * 120;
        ctx.fillStyle = 'rgba(35,42,62,.8)';
        ctx.fillRect(x + 30, G - bh, 130, bh);
        ctx.fillStyle = 'rgba(255,220,140,.5)';
        for (let r = 0; r < Math.floor(bh / 50); r++) {
          if (hash(i + r * 5) > 0.45) ctx.fillRect(x + 50, G - bh + 20 + r * 50, 22, 20);
        }
      }, 90);
    },
    ground(ctx, W, VH, scroll) {
      ctx.fillStyle = '#2A3244';
      ctx.fillRect(0, G, W, VH - G);
      tile(W, scroll, 1, 120, (x, i) => {
        ctx.strokeStyle = 'rgba(180,210,255,.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x + 60, G + 28, 34, 6, 0, 0, TAU);
        ctx.stroke();
      }, 60);
    },
    column(ctx, x, y, w, h, capAt, seed) {
      // мокрый камень
      ctx.fillStyle = hgrad(ctx, x, x + w, ['#4A5570', '#6E7A96', '#47516A']);
      ctx.fillRect(x + 4, y, w - 8, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 4, y, w - 8, h);
      ctx.clip();
      for (let k = 0; k < 18; k++) {
        const yy = y + hash(seed + k * 3.1) * h;
        const ww = 10 + hash(seed + k) * 30;
        ctx.fillStyle = 'rgba(255,255,255,.12)';
        ctx.fillRect(x + 6 + hash(seed + k * 7) * (w - 20), yy, ww, 3);
      }
      ctx.restore();
      colOutline(ctx, x + 4, y, w - 8, h, '#222A3C');
      if (capAt === 'top') {
        ctx.fillStyle = '#2A3244';
        rr(ctx, x - 5, y - 8, w + 10, 18, 5);
        ctx.fill();
        ctx.fillStyle = 'rgba(200,225,255,.85)';
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y + 10);
        ctx.lineTo(x + w / 2 + 7, y + 22);
        ctx.lineTo(x + w / 2 - 4, y + 22);
        ctx.lineTo(x + w / 2 + 4, y + 34);
        ctx.lineTo(x + w / 2 - 7, y + 20);
        ctx.lineTo(x + w / 2 + 2, y + 20);
        ctx.fill();
      } else {
        ctx.fillStyle = '#2A3244';
        rr(ctx, x - 5, y + h - 10, w + 10, 18, 5);
        ctx.fill();
      }
    },
  },

  /* ---------- 20. Дорога к Насте · рассвет ---------- */
  dawn: {
    name: 'Дорога к Насте · рассвет',
    ambient: 'hearts',
    hud: '#FFF3EA',
    dark: true,
    sky(ctx, W, VH) {
      ctx.fillStyle = vgrad(ctx, 0, G, ['#3E4E7A', '#8A6FA8', '#D98BA0', '#FFB68A', '#FFE0B0']);
      ctx.fillRect(0, -90, W, VH + 90);
      // встающее солнце
      const sx = W * 0.62;
      const sy = G - 40;
      const g = ctx.createRadialGradient(sx, sy, 20, sx, sy, 360);
      g.addColorStop(0, 'rgba(255,240,200,.85)');
      g.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 360, sy - 360, 720, 720);
      ctx.fillStyle = '#FFF6DC';
      ctx.beginPath();
      ctx.arc(sx, sy, 104, 0, TAU);
      ctx.fill();
    },
    far(ctx, W, scroll) {
      tile(W, scroll, 0.07, 400, (x, i) => {
        cloudHeart(ctx, x + 120, 140 + hash(i) * 130, 40 + hash(i + 3) * 22, 'rgba(255,255,255,.4)');
        cloudHeart(ctx, x + 320, 290 + hash(i + 5) * 110, 24 + hash(i + 8) * 16, 'rgba(255,225,235,.45)');
      }, 180);
      const hills = (factor, color, base, amp, period) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, G);
        for (let x = 0; x <= W + 20; x += 20) {
          const wx = x + scroll * factor;
          ctx.lineTo(x, G - base - Math.sin(wx / period) * amp - Math.sin(wx / (period * 0.39) + 1) * amp * 0.3);
        }
        ctx.lineTo(W, G);
        ctx.fill();
      };
      hills(0.1, 'rgba(255,205,200,.5)', 150, 40, 240);
      hills(0.2, 'rgba(255,180,190,.6)', 90, 30, 170);
      // белые розы по пути
      tile(W, scroll, 0.3, 240, (x, i) => {
        const rx = x + 80;
        const ry = G - 30 - hash(i) * 40;
        ctx.fillStyle = '#FFFFFF';
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * TAU;
          ctx.beginPath();
          ctx.ellipse(rx + Math.cos(a) * 9, ry + Math.sin(a) * 9, 9, 7, a, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = '#F7C6D2';
        ctx.beginPath();
        ctx.arc(rx, ry, 6, 0, TAU);
        ctx.fill();
      }, 100);
    },
    ground(ctx, W, VH, scroll) {
      ctx.fillStyle = '#8A5A6A';
      ctx.fillRect(0, G, W, VH - G);
      ctx.fillStyle = 'rgba(255,220,200,.5)';
      ctx.fillRect(0, G, W, 6);
      tile(W, scroll, 1, 110, (x, i) => {
        ctx.fillStyle = 'rgba(255,235,230,.35)';
        ctx.beginPath();
        ctx.ellipse(x + 55, G + 26 + hash(i) * 14, 22, 5, 0, 0, TAU);
        ctx.fill();
      }, 55);
    },
    column(ctx, x, y, w, h, capAt, seed) {
      // сияющая колонна из лепестков
      ctx.fillStyle = hgrad(ctx, x, x + w, ['#FFC9D6', '#FFF0F4', '#F7A8C4', '#FFD9E2']);
      ctx.fillRect(x + 4, y, w - 8, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 4, y, w - 8, h);
      ctx.clip();
      for (let k = 0; k < 22; k++) {
        const yy = y + hash(seed + k * 2.7) * h;
        const px = x + 6 + hash(seed + k * 5.3) * (w - 20);
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        heartPath(ctx, px + 6, yy, 5 + hash(seed + k) * 4);
        ctx.fill();
      }
      ctx.restore();
      colOutline(ctx, x + 4, y, w - 8, h, '#D98BA0');
      if (capAt === 'top') {
        ctx.fillStyle = '#FFFFFF';
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(x + 6 + k * ((w - 12) / 2), y - 2, 11, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,180,200,.9)';
        heartPath(ctx, x + w / 2, y + 2, 9);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255,240,245,.95)';
        rr(ctx, x - 3, y + h - 12, w + 6, 16, 8);
        ctx.fill();
        ctx.fillStyle = '#F58CA5';
        heartPath(ctx, x + w / 2, y + h - 4, 7);
        ctx.fill();
      }
    },
  },
};
