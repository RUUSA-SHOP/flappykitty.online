/* Сохранение прогресса в localStorage. Общее для всех страниц сайта
   (игра, записки, гардероб) — и для будущих игр вселенной Мии. */

const KEY = 'flappykitty.save.v1';

const DEFAULTS = {
  v: 1,
  hearts: 0, // «кошелёк» сердечек — общая валюта вселенной
  totalHearts: 0, // сколько собрано за всё время
  best: 0, // рекорд бесконечного режима
  levels: {}, // { [id]: { stars, hearts, done } }
  notes: [], // id открытых записок (номер уровня)
  seenNotes: [], // прочитанные записки
  skins: ['super'],
  skin: 'super',
  sound: true,
  music: true,
  plays: 0,
};

let cache = null;
let memoryOnly = false;

function read() {
  if (cache) return cache;
  let data = {};
  try {
    data = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch (e) {
    memoryOnly = true; // приватный режим / запрет хранилища — играем без сохранения
  }
  cache = { ...DEFAULTS, ...data };
  cache.levels = { ...(data.levels || {}) };
  cache.notes = [...(data.notes || [])];
  cache.seenNotes = [...(data.seenNotes || [])];
  cache.skins = Array.from(new Set(['super', ...(data.skins || [])]));
  return cache;
}

function write() {
  if (memoryOnly) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch (e) {
    memoryOnly = true;
  }
}

export const save = {
  get data() {
    return read();
  },
  set(patch) {
    Object.assign(read(), patch);
    write();
  },
  addHearts(n) {
    const d = read();
    d.hearts += n;
    d.totalHearts += n;
    write();
  },
  spendHearts(n) {
    const d = read();
    if (d.hearts < n) return false;
    d.hearts -= n;
    write();
    return true;
  },
  /** Записать результат уровня. Возвращает true, если уровень пройден впервые. */
  completeLevel(id, stars, hearts) {
    const d = read();
    const prev = d.levels[id];
    const first = !prev || !prev.done;
    d.levels[id] = {
      done: true,
      stars: Math.max(stars, prev ? prev.stars || 0 : 0),
      hearts: Math.max(hearts, prev ? prev.hearts || 0 : 0),
    };
    if (!d.notes.includes(id)) d.notes.push(id);
    write();
    return first;
  },
  isLevelOpen(id) {
    if (id <= 1) return true;
    const prev = read().levels[id - 1];
    return !!(prev && prev.done);
  },
  nextLevel(total) {
    const d = read();
    for (let i = 1; i <= total; i++) if (!d.levels[i] || !d.levels[i].done) return i;
    return total;
  },
  totalStars() {
    return Object.values(read().levels).reduce((s, l) => s + (l.stars || 0), 0);
  },
  markNoteSeen(id) {
    const d = read();
    if (!d.seenNotes.includes(id)) {
      d.seenNotes.push(id);
      write();
    }
  },
  unlockSkin(id) {
    const d = read();
    if (!d.skins.includes(id)) d.skins.push(id);
    write();
  },
  reset() {
    cache = { ...DEFAULTS, levels: {}, notes: [], seenNotes: [], skins: ['super'] };
    write();
  },
};
