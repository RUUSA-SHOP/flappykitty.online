/* Уровни, раунды и облики Мии.

   Уровень — это десять раундов. Уровней два, раундов двадцать.
   После каждого раунда Мия оставляет записку, после десятого раунда уровня приходит ещё и письмо.

   ROUNDS — все раунды подряд, id от 1 до 20: первые десять — первый уровень, вторые десять — второй.
   Чтобы поменять раунд — правь объект в ROUNDS; мир раунда (theme) рисуется в themes.js.
   Последний раунд уровня помечен finale: после него — письмо.
   Опасности (hazards): drop — капли из кранов, balloon — шарики с сердечками, cucumber — огурцы,
   wind — ветер, rain — капли с туч, frog — прыгающие лягушата, yarn — клубки с сердечками,
   bat — летучие мыши, dust — клубки пыли, roomba — робот-пылесос (тянет вниз), bubble — мыльные пузыри,
   bird — голуби, steam — пар (подбрасывает вверх), bun — летящие булочки, soldier — оловянные солдатики,
   ember — угольки из камина, lightning — молнии. */

export const WORLD = {
  H: 720, // высота игрового мира в условных пикселях
  GROUND: 660, // линия пола
  GRAVITY: 1300,
  FLAP: -390,
  MAX_FALL: 560,
  RADIUS: 20, // радиус «хитбокса» Мии — честный и чуть меньше картинки
  GATE_W: 78,
};

/** Сколько раундов в одном уровне. */
export const ROUNDS_PER_LEVEL = 10;

/** Уровни. Раунды уровня — это ROUNDS с тем же level (см. roundsOf). */
export const LEVELS = [
  { id: 1, name: 'Первая дорога', about: 'От дивана до самого главного сердца' },
  { id: 2, name: 'Вторая дорога', about: 'Чердак, гроза и рассвет' },
];

export const ROUNDS = [

  /* ---------- Уровень 1. Первая дорога ---------- */

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
    tagline: 'Финал первого уровня',
    story: 'Последний перелёт. Там, в конце, ждёт самое главное сердце и первое письмо.',
    tip: 'Самый длинный перелёт первого уровня. Опасностей нет — только не торопись.',
    gates: 36,
    speed: 205,
    gap: 202,
    spacing: 300,
    move: 28,
    // финал первого уровня длинный, но добрый: только шарики с сердечками
    hazards: ['balloon'],
    powerups: ['shield', 'magnet', 'catnip'],
    finale: true, // последний раунд первого уровня: после него — первое письмо
  },

  /* ---------- Уровень 2. Вторая дорога ---------- */

  {
    id: 11,
    theme: 'attic',
    name: 'Чердак',
    tagline: 'Пыль и открытия',
    story: 'Выше шкафа, за коробками — целый мир. Тут пахнет старыми письмами и приключениями.',
    tip: 'Клубки пыли плывут навстречу. Они медленные — облети сверху или снизу.',
    gates: 15,
    speed: 192,
    gap: 210,
    spacing: 305,
    move: 10,
    hazards: ['dust'],
    powerups: ['shield', 'magnet', 'catnip'],
  },
  {
    id: 12,
    theme: 'vacuum',
    name: 'Робот-пылесос',
    tagline: 'Он не злой, он работает',
    story: 'Робот катается по квартире и уверен, что Мия — это очень большой комок шерсти.',
    tip: 'Над роботом Мию тянет вниз. Пока летишь над ним — маши чаще.',
    gates: 17,
    speed: 200,
    gap: 204,
    spacing: 302,
    move: 28,
    hazards: ['roomba'],
    powerups: ['shield', 'magnet', 'catnip'],
  },
  {
    id: 13,
    theme: 'yarn',
    name: 'Корзинка с нитками',
    tagline: 'Клубок за клубком',
    story: 'Корзинка опрокинулась, и нитки разбежались по всей комнате. Мия летит их догонять.',
    tip: 'Передышка. Лови клубки — в каждом два сердечка.',
    gates: 18,
    speed: 196,
    gap: 208,
    spacing: 305,
    move: 24,
    hazards: ['yarn'],
    powerups: ['shield', 'magnet', 'catnip'],
  },
  {
    id: 14,
    theme: 'bath',
    name: 'Ванная',
    tagline: 'Мокрое дело',
    story: 'Кран капает, мыльные пузыри летят, полотенца натянуты как паруса. Мия против купания.',
    tip: 'С потолка падают капли. Пузырь всплывает, когда Мия подлетает, — не задень.',
    gates: 16,
    speed: 194,
    gap: 218,
    spacing: 305,
    move: 22,
    hazards: ['drop', 'bubble'],
    powerups: ['shield', 'magnet', 'catnip'],
  },
  {
    id: 15,
    theme: 'street',
    name: 'Двор',
    tagline: 'Первый выход',
    story: 'Первый раз без дождевика на улице. Голуби относятся к Мии с подозрением.',
    tip: 'Стрелки показывают ветер. Голубь взлетает с земли прямо перед Мией — пропусти его.',
    gates: 19,
    speed: 198,
    gap: 208,
    spacing: 302,
    move: 30,
    hazards: ['wind', 'bird'],
    powerups: ['shield', 'magnet', 'catnip'],
  },
  {
    id: 16,
    theme: 'bakery',
    name: 'Пекарня',
    tagline: 'Пахнет домом',
    story: 'Тёплый воздух, мука в воздухе и булочки на полках. Мия официально тут работает дегустатором.',
    tip: 'Пар из кастрюли подбрасывает Мию вверх. Булочки летят навстречу — их облетай.',
    gates: 17,
    speed: 188,
    gap: 218,
    spacing: 306,
    move: 14,
    hazards: ['steam', 'bun'],
    powerups: ['shield', 'magnet', 'catnip'],
  },
  {
    id: 17,
    theme: 'toybox',
    name: 'Ящик с игрушками',
    tagline: 'Солдатики в атаке',
    story: 'Оловянные солдатики построились и пошли в атаку. По воздуху. Мия против целой армии.',
    tip: 'Солдатики летят навстречу строго по прямой. Увидела — уходи выше или ниже.',
    gates: 20,
    speed: 200,
    gap: 206,
    spacing: 300,
    move: 28,
    hazards: ['soldier'],
    powerups: ['shield', 'magnet', 'catnip'],
  },
  {
    id: 18,
    theme: 'fireplace',
    name: 'Камин',
    tagline: 'Тепло и угольки',
    story: 'Угольки взлетают вверх, а Мия летит мимо, стараясь не подпалить усы.',
    tip: 'Угольки вылетают из огня, когда Мия подлетает. Смотри вниз и пропускай их.',
    gates: 20,
    speed: 200,
    gap: 206,
    spacing: 302,
    move: 28,
    hazards: ['ember'],
    powerups: ['shield', 'magnet', 'catnip'],
  },
  {
    id: 19,
    theme: 'storm',
    name: 'Гроза',
    tagline: 'Самый страшный вечер',
    story: 'Мия всегда боялась грома. Сегодня она летит прямо в грозу — и гром боится первым.',
    tip: 'В небе загорается точка — туда ударит молния. Пролетай ниже неё. И не забывай про капли.',
    gates: 20,
    speed: 204,
    gap: 206,
    spacing: 300,
    move: 30,
    hazards: ['lightning', 'rain'],
    powerups: ['shield', 'magnet', 'catnip'],
  },
  {
    id: 20,
    theme: 'dawn',
    name: 'Дорога к Насте · рассвет',
    tagline: 'Финал',
    story: 'Всё небо в её честь. Последний, самый длинный перелёт — и второе письмо.',
    tip: 'Самый длинный перелёт игры. Под светящейся точкой пролетай ниже: в неё бьёт молния.',
    gates: 44,
    speed: 208,
    gap: 200,
    spacing: 300,
    move: 34,
    hazards: ['lightning', 'balloon'],
    powerups: ['shield', 'magnet', 'catnip'],
    finale: true, // последний раунд второго уровня: после него — второе письмо
  },
];

// У каждого раунда: level — номер уровня (1 или 2), no — номер раунда внутри уровня (1–10).
ROUNDS.forEach((r, i) => {
  r.level = Math.floor(i / ROUNDS_PER_LEVEL) + 1;
  r.no = (i % ROUNDS_PER_LEVEL) + 1;
});

/** Раунды одного уровня. */
export const roundsOf = (levelId) => ROUNDS.filter((r) => r.level === levelId);

/** Миры бесконечного режима — все миры сюжета. Порядок в забеге каждый раз свой (см. Sim), начинается всегда с гостиной. */
export const ENDLESS_THEMES = ROUNDS.map((r) => r.theme);
const ENDLESS_STEP = 6; // мир меняется каждые шесть ворот: за средний забег видно шесть миров
const ENDLESS_CUCUMBERS_FROM = 60; // с этих ворот к обитателю мира добавляются огурцы
// У каждого мира в бесконечном режиме — свой обитатель из сюжета (в гостиной спокойно: только шарики).
const ENDLESS_HAZARD = {
  living: 'balloon', kitchen: 'drop', party: 'balloon', night: 'cucumber', winter: 'wind',
  rain: 'rain', pond: 'frog', plush: 'yarn', gothic: 'bat', love: 'balloon',
  attic: 'dust', vacuum: 'roomba', yarn: 'yarn', bath: 'drop', street: 'bird',
  bakery: 'bun', toybox: 'soldier', fireplace: 'ember', storm: 'lightning', dawn: 'cucumber',
};

/** Параметры бесконечного режима: сложность растёт с каждыми воротами. */
export function endlessParams(passed, worlds = ENDLESS_THEMES) {
  const k = Math.min(1, passed / 45);
  const theme = worlds[Math.floor(passed / ENDLESS_STEP) % worlds.length];
  // первые два мира — разминка: сначала пусто, потом только шарики с сердечками; дальше у каждого мира свой обитатель
  const hazards = passed < ENDLESS_STEP ? [] : passed < ENDLESS_STEP * 2 ? ['balloon'] : [ENDLESS_HAZARD[theme]];
  // в долгом забеге к обитателю добавляются огурцы (кроме мира летучих мышей — там хватает своих)
  if (passed >= ENDLESS_CUCUMBERS_FROM && !hazards.includes('cucumber') && !hazards.includes('bat')) hazards.push('cucumber');
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
