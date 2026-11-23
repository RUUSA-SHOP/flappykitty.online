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

function openNote(note, { final = false, index = 0, total = 1 } = {}) {
  const card = el('article', final ? 'note note--final' : 'note');
  const label = final ? (total > 1 ? `Письмо № ${index + 1} из ${total}` : 'Письмо') : `Записка № ${note.level} · ${levelName(note.level)}`;
  card.append(el('span', 'note__no', label));
  card.append(el(final ? 'h2' : 'h3', '', note.title));
  paragraphs(card, note.text);
  const sign = el('p', 'note__sign');
  setSignature(sign, final ? CONFIG.from : `— ${note.from || CONFIG.cat.name}`);
  card.append(sign);
  return card;
}

function lockedNote(note, { final = false, index = 0, total = 1 } = {}) {
  const card = el('article', final ? 'note note--final note--locked' : 'note note--locked');
  const lock = el('span', 'lockicon');
  lock.append(icon('i-lock'));
  card.append(lock);
  card.append(el('strong', '', final ? (total > 1 ? `Письмо № ${index + 1} из ${total}` : 'Письмо') : `Записка № ${note.level}`));
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

// Писем два: после 10-го уровня и после 20-го. Показываем их подряд, каждое в своей рамке.
const letters = CONFIG.letters || [];
const finalBox = document.getElementById('final');
letters.forEach((letter, i) => {
  if (i > 0) finalBox.append(el('hr', 'note__sep'));
  finalBox.append(
    isOpen(letter.level)
      ? openNote(letter, { final: true, index: i, total: letters.length })
      : lockedNote(letter, { final: true, index: i, total: letters.length })
  );
});

const total = CONFIG.notes.length + letters.length;
const got = [...CONFIG.notes, ...letters].filter((n) => isOpen(n.level)).length;
document.getElementById('noteCount').textContent =
  got === total ? `Открыты все ${total}` : `Открыто ${got} из ${total}`;

// Всё, что открыто на этой странице, считается прочитанным — метка «новое» в игре гаснет.
if (!peek) [...CONFIG.notes, ...letters].forEach((n) => opened.has(n.level) && save.markNoteSeen(n.level));
