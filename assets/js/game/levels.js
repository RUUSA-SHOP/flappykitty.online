/* Уровни сюжетного режима и облики Мии.
   Чтобы добавить уровень — допиши объект в LEVELS и тему в themes.js.
   Последний уровень в списке — финал: после него открывается письмо (см. config.js).
   Опасности (hazards): drop — капли из кранов, balloon — шарики с сердечками, cucumber — огурцы,
   wind — ветер, rain — капли с туч, frog — прыгающие лягушата, yarn — клубки с сердечками,
   bat — летучие мыши. */

export const WORLD = {
  H: 720, // высота игрового мира в условных пикселях
  GROUND: 660, // линия пола
  GRAVITY: 1300,
  FLAP: -390,
  MAX_FALL: 560,
  RADIUS: 20, // радиус «хитбокса» Мии — честный и чуть меньше картинки
  GATE_W: 78,
};

export const LEVELS = [
  {
    id: 1,
    theme: 'living',
    name: 'Гостиная',
    tagline: 'Первый полёт',
    story: 'Мия обнаружила, что умеет летать. Когтеточки в шоке.',
    tip: 'Тап, клик или пробел — взмах крыльев. У Мии три жизни на уровень.',
    gates: 10,
    speed: 165,
    gap: 218,
    spacing: 315,
    move: 0,
    hazards: [],
    powerups: ['shield'],
  },
  {
    id: 2,
    theme: 'kitchen',
    name: 'Кухня',
    tagline: 'Операция «Кран»',
    story: 'Вода из-под крана — лучшая вода. Но капли лучше облетать.',
    tip: 'Из кранов на потолке падают капли. Мия не любит мокнуть.',
    gates: 13,
    speed: 175,
    gap: 208,
    spacing: 310,
    move: 0,
    hazards: ['drop'],
    powerups: ['shield', 'magnet'],
  },
  {
    id: 3,
    theme: 'party',
    name: 'День рождения',
    tagline: 'Торт, свечи, шарики',
    story: 'Свечи качаются, шарики лопаются — и из них сыплются сердечки.',
    tip: 'Свечи двигаются. Лопай шарики — в каждом два сердечка.',
    gates: 15,
    speed: 185,
    gap: 204,
    spacing: 305,
    move: 34,
    hazards: ['balloon'],
    powerups: ['magnet', 'catnip'],
  },
  {
    id: 4,
    theme: 'night',
    name: 'Ночной город',
    tagline: 'Ночной дозор',
    story: 'Город спит, Мия дежурит. Осторожно: в небе замечены огурцы.',
    tip: 'Красный «!» справа — оттуда летит огурец. Уходи с его линии.',
    gates: 17,
    speed: 198,
    gap: 198,
    spacing: 300,
    move: 0,
    hazards: ['cucumber'],
    powerups: ['shield', 'magnet', 'catnip'],
  },
  {
    id: 5,
    theme: 'winter',
    name: 'Зимняя сказка',
    tagline: 'Против ветра',
    story: 'Льдинки, снег и порывы ветра. Следи за стрелками.',
    tip: 'Стрелки показывают, куда подует ветер. Дует вверх — маши реже, вниз — чаще.',
    gates: 19,
    speed: 205,
    gap: 200,
    spacing: 305,
    move: 44,
    hazards: ['wind'],
    powerups: ['shield', 'magnet', 'catnip'],
  },
  {
    id: 6,
    theme: 'rain',
    name: 'Под дождём',
    tagline: 'Дождевик пригодился',
    story: 'Дождевик надет не зря: дождь всё-таки пошёл. Капли облетаем, радугу ловим.',
    tip: 'С туч падают капли. Потом дождь кончится — и на пути станет вдвое больше сердечек.',
    gates: 18,
    speed: 200,
    gap: 204,
    spacing: 305,
    move: 0,
    hazards: ['rain'],
    calmFrom: 0.6, // после 60% пути дождь кончается: опасностей нет, сердечек на пути вдвое больше
    powerups: ['shield', 'magnet', 'catnip'],
  },
  {
    id: 7,
    theme: 'pond',
    name: 'Лягушачий пруд',
    tagline: 'Ква',
    story: 'Лето, кувшинки и лягушата. Они добрые, но прыгают без предупреждения. Почти.',
    tip: 'Круги на воде — сейчас прыгнет лягушонок. Держись повыше.',
    gates: 19,
    speed: 204,
    gap: 202,
    spacing: 305,
    move: 30,
    hazards: ['frog'],
    powerups: ['shield', 'magnet', 'catnip'],
  },
  {
    id: 8,
    theme: 'plush',
    name: 'Плюшевый совет',
    tagline: 'Заседание открыто',
    story: 'Зайка, Мишка и Панда собрались на совет. Мия — председатель и совершает облёт.',
    tip: 'Здесь спокойно. Лови клубки — в каждом два сердечка.',
    gates: 16,
    speed: 190,
    gap: 210,
    spacing: 305,
    move: 20,
    hazards: ['yarn'],
    powerups: ['shield', 'magnet', 'catnip'],
  },
  {
    id: 9,
    theme: 'gothic',
    name: 'Поцелуй или кусь',
    tagline: 'Розовая луна',
    story: 'Свечи, замок и летучие мыши. Мия надела шляпу и сделала серьёзное лицо.',
    tip: 'Летучие мыши летят волной. Красный «!» покажет, откуда ждать.',
    gates: 21,
    speed: 208,
    gap: 198,
    spacing: 300,
    move: 36,
    hazards: ['bat'],
    powerups: ['shield', 'magnet', 'catnip'],
  },
  {
    id: 10,
    theme: 'love',
    name: 'Дорога к Насте',
    tagline: 'Финал',
    story: 'Последний перелёт. Там, в конце, ждёт самое главное сердце.',
    tip: 'Здесь всё сразу. Долети до большого сердца.',
    gates: 24,
    speed: 212,
    gap: 196,
    spacing: 300,
    move: 40,
    hazards: ['balloon', 'cucumber'],
    powerups: ['shield', 'magnet', 'catnip'],
  },
];

/** Миры бесконечного режима — в том же порядке, что и сюжет. */
export const ENDLESS_THEMES = ['living', 'kitchen', 'party', 'night', 'winter', 'rain', 'pond', 'plush', 'gothic', 'love'];
const ENDLESS_STEP = 6; // мир меняется каждые шесть ворот: за средний забег видно больше половины миров
// У каждого мира в бесконечном режиме — свой обитатель из сюжета (в гостиной спокойно: только шарики).
const ENDLESS_HAZARD = { living: 'balloon', kitchen: 'drop', party: 'balloon', night: 'cucumber', winter: 'wind', rain: 'rain', pond: 'frog', plush: 'yarn', gothic: 'bat', love: 'balloon' };

/** Параметры бесконечного режима: сложность растёт с каждыми воротами. */
export function endlessParams(passed) {
  const k = Math.min(1, passed / 45);
  const theme = ENDLESS_THEMES[Math.floor(passed / ENDLESS_STEP) % ENDLESS_THEMES.length];
  // первые два мира — разминка: сначала пусто, потом только шарики с сердечками; дальше у каждого мира свой обитатель
  const hazards = passed < ENDLESS_STEP ? [] : passed < ENDLESS_STEP * 2 ? ['balloon'] : [ENDLESS_HAZARD[theme]];
  // со второго круга по мирам к обитателю добавляются огурцы (кроме мира летучих мышей — там хватает своих)
  if (passed >= ENDLESS_STEP * ENDLESS_THEMES.length && !hazards.includes('cucumber') && !hazards.includes('bat')) hazards.push('cucumber');
  return {
    theme,
    speed: 172 + 70 * k,
    gap: 205 - 50 * k,
    spacing: 305 - 25 * k,
    move: passed > 12 ? Math.min(50, (passed - 12) * 2.5) : 0,
    hazards,
    powerups: ['shield', 'magnet', 'catnip'],
  };
}

/** Облики. w — ширина спрайта в мире, ax/ay — точка «центра головы» (0..1). */
export const SKINS = [
  { id: 'super', name: 'Супер-Мия', hint: 'Дождевик, лапы вперёд', price: 0, src: 'assets/img/skins/super.webp', w: 124, ax: 0.6, ay: 0.36, wings: [0.36, 0.5] },
  { id: 'hood', name: 'Капюшон', hint: 'Смотрю только вперёд', price: 40, src: 'assets/img/skins/hood.webp', w: 82, ax: 0.5, ay: 0.5, wings: [0.2, 0.62] },
  { id: 'eyes', name: 'Глазки', hint: 'Запрещённый приём', price: 80, src: 'assets/img/skins/eyes.webp', w: 80, ax: 0.5, ay: 0.52, wings: [0.14, 0.6] },
  { id: 'frog', name: 'Лягушка', hint: 'Ква', price: 120, src: 'assets/img/skins/frog.webp', w: 76, ax: 0.5, ay: 0.6, wings: [0.14, 0.7] },
  { id: 'face', name: 'Просто Мия', hint: 'Без фильтров', price: 160, src: 'assets/img/skins/face.webp', w: 84, ax: 0.5, ay: 0.5, wings: [0.1, 0.55] },
  { id: 'wink', name: 'Хитрюга', hint: 'Я всё вижу', price: 220, src: 'assets/img/skins/wink.webp', w: 80, ax: 0.5, ay: 0.5, wings: [0.1, 0.55] },
];

export const POWERUPS = {
  shield: { name: 'Пузырь', desc: 'спасает от одного удара', color: '#8FD3F4' },
  magnet: { name: 'Магнит', desc: 'сердечки летят сами', color: '#7FB7E6', time: 7 },
  catnip: { name: 'Кошачья мята', desc: 'Мия неуязвима', color: '#8FD17F', time: 5 },
};
