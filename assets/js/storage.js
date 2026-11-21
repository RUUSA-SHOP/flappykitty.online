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
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    memoryOnly = true; // приватный режим или запрет хранилища — играем без сохранения
  }
  let data = {};
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed;
    } catch (e) {
      // запись испорчена — начинаем с чистого листа, следующая запись её заменит
    }
  }
  // Каждое поле проверяем: сохранение могли поправить руками или оно осталось от старой версии.
  const count = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  const ids = (v) => (Array.isArray(v) ? Array.from(new Set(v.filter((x) => Number.isInteger(x) && x > 0))) : []);
  const levels = {};
  if (data.levels && typeof data.levels === 'object') {
    for (const [id, l] of Object.entries(data.levels)) {
      if (!l || typeof l !== 'object' || !Number.isInteger(+id)) continue;
      levels[id] = { done: !!l.done, stars: Math.min(3, count(l.stars)), hearts: count(l.hearts) };
    }
  }
  const skins = Array.isArray(data.skins) ? data.skins.filter((x) => typeof x === 'string') : [];
  cache = {
    ...data, // незнакомые поля сохраняем: их могут добавить будущие игры
    ...DEFAULTS,
    hearts: count(data.hearts),
    totalHearts: count(data.totalHearts),
    best: count(data.best),
    levels,
    notes: ids(data.notes),
    seenNotes: ids(data.seenNotes),
    skins: Array.from(new Set(['super', ...skins])),
    skin: typeof data.skin === 'string' ? data.skin : 'super',
    sound: data.sound !== false,
    music: data.music !== false,
    plays: count(data.plays),
  };
  if (!cache.skins.includes(cache.skin)) cache.skin = 'super';
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

// Сайт открыт в двух вкладках: если в другой что-то изменилось, перечитываем при следующем обращении.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) cache = null;
  });
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
