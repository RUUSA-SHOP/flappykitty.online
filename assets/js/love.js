/* Страница «Записки»: показывает записки из config.js.
   Запертые открываются, когда пройден соответствующий уровень.
   Для проверки текстов есть адрес love.html?peek=1 — он показывает всё сразу. */

import { CONFIG, setSignature } from './config.js';
import { save } from './storage.js';
import { LEVELS } from './game/levels.js';

const peek = new URLSearchParams(location.search).has('peek');
const opened = new Set(save.data.notes);
const isOpen = (level) => peek || opened.has(level);
const levelName = (id) => (LEVELS.find((l) => l.id === id) || {}).name || `Уровень ${id}`;

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(id) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(NS, 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
}

function paragraphs(parent, text) {
  text.split(/\n{2,}/).forEach((part) => parent.append(el('p', '', part.trim())));
}

function openNote(note, { final = false, label = '', sender = false } = {}) {
  const card = el('article', final ? 'note note--final' : 'note');
  const text = final ? label || 'Письмо' : sender ? `Записка Мии · после уровня «${levelName(note.level)}»` : `Записка № ${note.level} · ${levelName(note.level)}`;
  card.append(el('span', 'note__no', text));
  card.append(el(final ? 'h2' : 'h3', '', note.title));
  paragraphs(card, note.text);
  const sign = el('p', 'note__sign');
  setSignature(sign, final ? CONFIG.from : `— ${note.from || CONFIG.cat.name}`);
  card.append(sign);
  return card;
}

function lockedNote(note, { final = false, label = '' } = {}) {
  const card = el('article', final ? 'note note--final note--locked' : 'note note--locked');
  const lock = el('span', 'lockicon');
  lock.append(icon('i-lock'));
  card.append(lock);
  card.append(el('strong', '', final ? label || 'Письмо' : `Записка № ${note.level}`));
  card.append(el('span', '', `Откроется после уровня «${levelName(note.level)}»`));
  const canPlay = save.isLevelOpen(note.level);
  if (canPlay) {
    const link = el('a', 'btn btn--small', 'Пройти уровень');
    link.href = `play.html?level=${note.level}`;
    card.append(link);
  }
  return card;
}

const list = document.getElementById('notes');
CONFIG.notes.forEach((note) => {
  const li = el('li');
  li.append(isOpen(note.level) ? openNote(note) : lockedNote(note));
  list.append(li);
});

// У каждого финала две карточки: записка самой Мии и письмо создателя под ней.
// Так на странице видно, что письмо — не от Мии, а «переданное».
const letters = CONFIG.letters || [];
const finalBox = document.getElementById('final');
letters.forEach((letter, i) => {
  if (i > 0) finalBox.append(el('hr', 'note__sep'));
  const open = isOpen(letter.level);
  const who = `Письмо № ${i + 1} из ${letters.length}`;
  // 1) записка Мии
  finalBox.append(
    open
      ? openNote({ ...letter.note, level: letter.level }, { sender: true })
      : lockedNote({ ...letter.note, level: letter.level })
  );
  // 2) письмо создателя — визуально отдельно, под запиской
  finalBox.append(
    open
      ? openNote(letter, { final: true, label: who })
      : lockedNote(letter, { final: true, label: who })
  );
});

const total = CONFIG.notes.length + letters.length * 2;
const got = [...CONFIG.notes, ...letters, ...letters.map((l) => ({ level: l.level }))]
  .filter((n) => isOpen(n.level)).length;
document.getElementById('noteCount').textContent =
  got === total ? `Открыты все ${total}` : `Открыто ${got} из ${total}`;

// Всё, что открыто на этой странице, считается прочитанным — метка «новое» в игре гаснет.
if (!peek) [...CONFIG.notes, ...letters].forEach((n) => opened.has(n.level) && save.markNoteSeen(n.level));
