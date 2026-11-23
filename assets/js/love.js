/* Страница «Записки»: показывает записки и письма из config.js.
   Игра — это два уровня по десять раундов. После каждого раунда Мия оставляет записку,
   в конце уровня приходит письмо. Здесь всё сложено так же: уровень → десять записок → письмо.
   Запертое открывается, когда пройден соответствующий раунд.
   Для проверки текстов есть адрес love.html?peek=1 — он показывает всё сразу. */

import { CONFIG, setSignature } from './config.js';
import { save } from './storage.js';
import { LEVELS, ROUNDS, roundsOf } from './game/levels.js';

const peek = new URLSearchParams(location.search).has('peek');
const opened = new Set(save.data.notes);
const isOpen = (round) => peek || opened.has(round);
const roundBy = (id) => ROUNDS.find((r) => r.id === id);
// финалы называются по имени из config.js — так же, как в игре
const roundName = (id) => {
  const r = roundBy(id);
  if (!r) return `Раунд ${id}`;
  if (r.theme === 'love') return `Дорога к ${CONFIG.her.dative}`;
  if (r.theme === 'dawn') return `Дорога к ${CONFIG.her.dative} · рассвет`;
  return r.name;
};

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

/** Открытая записка раунда. */
function openNote(note) {
  const card = el('article', 'note');
  card.append(el('span', 'note__no', `Записка № ${note.round} · ${roundName(note.round)}`));
  card.append(el('h3', '', note.title));
  paragraphs(card, note.text);
  const sign = el('p', 'note__sign');
  setSignature(sign, `— ${note.from || CONFIG.cat.name}`);
  card.append(sign);
  return card;
}

/** Запертая записка: какой раунд её откроет и, если он уже доступен, кнопка «Пройти раунд». */
function lockedNote(note) {
  const r = roundBy(note.round) || { level: 1, no: note.round };
  const card = el('article', 'note note--locked');
  const lock = el('span', 'lockicon');
  lock.append(icon('i-lock'));
  card.append(lock);
  card.append(el('strong', '', `Записка № ${note.round}`));
  card.append(el('span', '', `Откроется после раунда ${r.no} — «${roundName(note.round)}»`));
  if (save.isRoundOpen(note.round)) {
    const link = el('a', 'btn btn--small', 'Пройти раунд');
    link.href = `play.html?round=${note.round}`;
    card.append(link);
  }
  return card;
}

/** Письмо уровня: открытое — целиком, запертое — конвертом с замком. */
function letterCard(letter, label, open, lastRound) {
  if (!open) {
    const card = el('article', 'note note--final note--locked');
    const lock = el('span', 'lockicon');
    lock.append(icon('i-lock'));
    card.append(lock);
    card.append(el('strong', '', label));
    card.append(el('span', '', `Придёт после раунда ${lastRound.no} — «${roundName(lastRound.id)}»`));
    return card;
  }
  const card = el('article', 'note note--final');
  card.append(el('span', 'note__no', label));
  card.append(el('h3', '', letter.title));
  paragraphs(card, letter.text);
  const sign = el('p', 'note__sign');
  setSignature(sign, CONFIG.from);
  card.append(sign);
  return card;
}

const letters = CONFIG.letters || [];
const box = document.getElementById('notes');
let got = 0;

LEVELS.forEach((level) => {
  const rounds = roundsOf(level.id);
  const last = rounds[rounds.length - 1];
  const notes = CONFIG.notes.filter((n) => rounds.some((r) => r.id === n.round));
  const letter = letters.find((l) => l.level === level.id);
  const openNotes = notes.filter((n) => isOpen(n.round)).length;
  const letterOpen = !!letter && isOpen(last.id);
  got += openNotes + (letterOpen ? 1 : 0);

  const sec = el('section', 'notebook');
  sec.dataset.level = level.id;
  sec.setAttribute('aria-label', `Уровень ${level.id}. ${level.name}`);
  const head = el('header', 'notebook__head');
  head.append(el('p', 'eyebrow', `Уровень ${level.id}`));
  head.append(el('h2', '', level.name));
  head.append(el('p', 'notebook__about', `${level.about}. Записок открыто: ${openNotes} из ${notes.length}.`));
  sec.append(head);

  const list = el('ul', 'notes');
  notes.forEach((note) => {
    const li = el('li');
    li.append(isOpen(note.round) ? openNote(note) : lockedNote(note));
    list.append(li);
  });
  sec.append(list);

  // письмо — отдельно, под записками своего уровня: так видно, что оно не от Мии, а «переданное»
  if (letter) {
    const wrap = el('div', 'notebook__letter');
    const label = letters.length > 1 ? `Письмо № ${letters.indexOf(letter) + 1} из ${letters.length}` : 'Письмо';
    wrap.append(letterCard(letter, label, letterOpen, last));
    sec.append(wrap);
  }
  box.append(sec);
});

const total = CONFIG.notes.length + letters.length;
document.getElementById('noteCount').textContent = got === total ? `Открыты все ${total}` : `Открыто ${got} из ${total}`;

// Всё, что открыто на этой странице, считается прочитанным — метка «новое» в игре гаснет.
if (!peek) CONFIG.notes.forEach((n) => opened.has(n.round) && save.markNoteSeen(n.round));
