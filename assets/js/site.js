/* Общий скрипт обычных страниц сайта (не игры):
   кошелёк сердечек в шапке и просмотр фотографий в альбоме. */

import { save } from './storage.js';

/* ---------- кошелёк в шапке ---------- */

const walletBox = document.querySelector('[data-wallet-box]');
if (walletBox) {
  const d = save.data;
  // Пока игра ни разу не запускалась, показывать «0 сердечек» незачем.
  if (d.plays > 0 || d.totalHearts > 0) {
    walletBox.querySelector('[data-wallet]').textContent = d.hearts;
    walletBox.hidden = false;
  }
}

/* ---------- альбом ---------- */

const album = document.getElementById('album');
const box = document.getElementById('lightbox');

if (album && box && typeof box.showModal === 'function') {
  const photos = Array.from(album.querySelectorAll('.photo'));
  const img = document.getElementById('lbImg');
  const cap = document.getElementById('lbCap');
  const count = document.getElementById('lbCount');
  let current = 0;
  let opener = null;

  const show = (i) => {
    current = (i + photos.length) % photos.length;
    const btn = photos[current];
    img.src = btn.dataset.full;
    img.alt = btn.querySelector('img').alt;
    cap.textContent = btn.dataset.cap;
    count.textContent = `${current + 1} / ${photos.length}`;
    // Соседний кадр подгружаем заранее, чтобы листалось без паузы.
    const next = photos[(current + 1) % photos.length];
    new Image().src = next.dataset.full;
  };

  photos.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      opener = btn;
      show(i);
      box.showModal();
    });
  });

  document.getElementById('lbClose').addEventListener('click', () => box.close());
  document.getElementById('lbPrev').addEventListener('click', () => show(current - 1));
  document.getElementById('lbNext').addEventListener('click', () => show(current + 1));

  // Клик по затемнению вокруг фотографии закрывает просмотр.
  box.addEventListener('click', (e) => {
    if (e.target === box) box.close();
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });
  box.addEventListener('close', () => {
    img.removeAttribute('src');
    if (opener) opener.focus();
  });

  // Свайп влево и вправо на телефоне.
  let startX = null;
  box.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
  });
  box.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
  });
}
