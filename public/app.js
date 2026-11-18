const scenes = [...document.querySelectorAll('.scene')];
const navigation = [...document.querySelectorAll('nav a')];
const form = document.querySelector('#note-form');
const statusText = document.querySelector('#status');
const list = document.querySelector('#notes');
const counter = document.querySelector('#count');
const submitButton = form.querySelector('button[type=submit]');
const storageKey = 'thang-muoi-mot-luu-but-v1';
const notesEndpoint = document.querySelector('meta[name=guestbook-endpoint]')?.content;
let activeScene;
let notes = [];
let guestbookLoaded = false;

function showScene(initial = false) {
  const route = location.hash.slice(1);
  const sceneId = route === 'hanh-trinh' ? 'lich-su' : route === 'viet-luu-but' ? 'luu-but' : route;
  const scene = scenes.find(item => item.id === sceneId) ?? scenes[0];
  const changed = activeScene !== scene;
  if (changed) {
    scene.classList.toggle('scene-backward', scenes.indexOf(scene) < scenes.indexOf(activeScene));
    scenes.forEach(item => { item.hidden = item !== scene; });
    navigation.forEach(link => {
      if (link.hash === '#' + scene.id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    activeScene = scene;
    if (scene.id === 'luu-but') {
      loadNotes();
      scrapbookShownAt = performance.now();
    }
    scheduleScrapbookRotation();
  }
  if (route === 'hanh-trinh') {
    requestAnimationFrame(() => document.querySelector('#hanh-trinh').scrollIntoView());
  } else if (route === 'viet-luu-but') {
    requestAnimationFrame(() => form.scrollIntoView());
  } else if (changed && !initial) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const heading = scene.querySelector('h1');
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

document.querySelectorAll('[data-poem]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-poem]').forEach(item => {
      const selected = item === button;
      item.setAttribute('aria-pressed', String(selected));
      document.getElementById(item.dataset.poem).hidden = !selected;
    });
  });
});

function announce(message, isError = false) {
  statusText.classList.toggle('error', isError);
  statusText.textContent = message;
}

function readLocalNotes() {
  const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
  return Array.isArray(saved) ? saved.filter(note => note && typeof note.message === 'string') : [];
}

function renderNotes() {
  const cards = notes.map(note => {
    const card = document.createElement('article');
    card.className = 'note';
    const message = document.createElement('p');
    const author = document.createElement('small');
    message.textContent = note.message;
    author.textContent = [note.author, note.role].join(' · ');
    card.append(message, author);
    return card;
  });
  list.replaceChildren(...cards);
  document.querySelector('#note-total').textContent = notes.length + ' lời nhắn';
  document.querySelector('#empty-notes').hidden = notes.length > 0;
}

async function loadNotes() {
  if (guestbookLoaded) return;
  if (notesEndpoint) document.querySelector('#storage-hint').textContent = 'Lời nhắn sẽ xuất hiện trong sổ lưu bút chung.';
  submitButton.disabled = true;
  try {
    if (notesEndpoint) {
      const response = await fetch(notesEndpoint);
      if (!response.ok) throw new Error('Guestbook unavailable');
      notes = await response.json();
    } else {
      notes = readLocalNotes();
    }
    guestbookLoaded = true;
    renderNotes();
  } catch {
    announce('Chưa tải được lời nhắn. Bạn có thể thử gửi hoặc tải lại trang.', true);
  } finally {
    submitButton.disabled = false;
  }
}

form.elements.message.addEventListener('input', () => {
  form.elements.message.setCustomValidity('');
  counter.textContent = form.elements.message.value.length + ' / 600';
});
form.elements.author.addEventListener('input', () => form.elements.author.setCustomValidity(''));
form.addEventListener('submit', async event => {
  event.preventDefault();
  const entry = Object.fromEntries(new FormData(form));
  entry.author = entry.author.trim();
  entry.message = entry.message.trim();
  for (const field of ['author', 'message']) {
    if (!entry[field]) {
      form.elements[field].setCustomValidity('Vui lòng nhập nội dung cho mục này.');
      form.elements[field].reportValidity();
      return;
    }
  }
  submitButton.disabled = true;
  try {
    if (notesEndpoint) {
      const response = await fetch(notesEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      if (!response.ok) throw new Error('Guestbook could not save the note');
      const saved = await response.json();
      notes = [saved, ...notes].slice(0, 100);
      if (!guestbookLoaded) await loadNotes();
    } else {
      notes = [entry, ...readLocalNotes()];
      localStorage.setItem(storageKey, JSON.stringify(notes));
    }
    renderNotes();
    form.reset();
    counter.textContent = '0 / 600';
    announce('Lời nhắn của bạn đã được lưu.');
  } catch {
    announce('Chưa lưu được lời nhắn. Bạn hãy thử lại.', true);
  } finally {
    submitButton.disabled = false;
  }
});

const scrapbook = document.querySelector('.scrapbook');
const scrapbookPages = [...scrapbook.querySelectorAll('.scrapbook-page')];
const scrapbookCount = document.querySelector('#scrapbook-count');
const scrapbookMotion = document.querySelector('#scrapbook-motion');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let scrapbookIndex = 0;
let requestedScrapbookIndex = 0;
let scrapbookTransitioning = false;
let scrapbookTimer;
let scrapbookPlaying = !reducedMotion.matches;
let scrapbookShownAt = performance.now();

scrapbookPages.forEach(page => {
  const paragraphs = [...page.querySelectorAll('.letter-sheet h3, .letter-sheet blockquote p, .letter-signature')];
  const characterCount = paragraphs.reduce((total, paragraph) => total + Array.from(paragraph.textContent).length, 0);
  const characterInterval = Math.min(22, 1800 / characterCount);
  let position = 0;
  paragraphs.forEach(paragraph => {
    const fragment = document.createDocumentFragment();
    paragraph.textContent.split(/(\s+)/u).forEach(part => {
      if (/^\s+$/u.test(part)) {
        fragment.append(document.createTextNode(part));
        return;
      }
      const word = document.createElement('span');
      word.className = 'letter-word';
      Array.from(part).forEach(character => {
        const glyph = document.createElement('span');
        glyph.className = 'letter-glyph';
        glyph.textContent = character;
        glyph.style.setProperty('--glyph-delay', (150 + position * characterInterval) + 'ms');
        word.append(glyph);
        position++;
      });
      fragment.append(word);
    });
    paragraph.replaceChildren(fragment);
  });
});

async function showScrapbookPage(index) {
  requestedScrapbookIndex = (index + scrapbookPages.length) % scrapbookPages.length;
  scrapbookPages[requestedScrapbookIndex].querySelector('img').loading = 'eager';
  if (scrapbookTransitioning || requestedScrapbookIndex === scrapbookIndex) return;
  scrapbookTransitioning = true;
  clearTimeout(scrapbookTimer);
  try {
    while (requestedScrapbookIndex !== scrapbookIndex) {
      scrapbook.classList.toggle('scrapbook-backward', index < scrapbookIndex);
      const outgoing = scrapbookPages[scrapbookIndex];
      const incomingImage = scrapbookPages[requestedScrapbookIndex].querySelector('img');
      await incomingImage.decode().catch(() => {});
      if (!reducedMotion.matches && activeScene?.id === 'luu-but') {
        await outgoing.animate([
          { opacity: 1, filter: 'blur(0px)', transform: 'scale(1)' },
          { opacity: .45, filter: 'blur(2px)', transform: 'scale(1.012)', offset: .55 },
          { opacity: 0, filter: 'blur(5px)', transform: 'scale(1.025) translateY(-5px)' }
        ], { duration: 360, easing: 'ease-in', fill: 'none' }).finished;
      }
      outgoing.hidden = true;
      scrapbookIndex = requestedScrapbookIndex;
      const incoming = scrapbookPages[scrapbookIndex];
      incoming.hidden = false;
      scrapbookShownAt = performance.now();
      const pageNumber = scrapbookIndex + 1;
      scrapbookCount.textContent = String(pageNumber).padStart(2, '0') + ' / ' + scrapbookPages.length;
      scrapbookCount.setAttribute('aria-label', 'Trang ' + pageNumber + ' trên ' + scrapbookPages.length);
      await Promise.allSettled(incoming.getAnimations().map(animation => animation.finished));
    }
  } finally {
    scrapbookTransitioning = false;
    scheduleScrapbookRotation();
  }
}

function scheduleScrapbookRotation() {
  clearTimeout(scrapbookTimer);
  if (!scrapbookPlaying || scrapbookTransitioning || activeScene?.id !== 'luu-but' || document.hidden) return;
  scrapbookTimer = setTimeout(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !scrapbook.contains(selection.anchorNode)) {
      showScrapbookPage(scrapbookIndex + 1);
    } else {
      scrapbookShownAt = performance.now();
    }
    scheduleScrapbookRotation();
  }, Math.max(0, 8000 - (performance.now() - scrapbookShownAt)));
}

function setScrapbookPlaying(playing) {
  scrapbookPlaying = playing;
  scrapbookShownAt = performance.now();
  scrapbookMotion.textContent = playing ? 'Tạm dừng' : 'Tự lật trang';
  scheduleScrapbookRotation();
}

function chooseScrapbookPage(index) {
  showScrapbookPage(index);
}

document.querySelector('#scrapbook-prev').addEventListener('click', () => chooseScrapbookPage(requestedScrapbookIndex - 1));
document.querySelector('#scrapbook-next').addEventListener('click', () => chooseScrapbookPage(requestedScrapbookIndex + 1));
scrapbookMotion.addEventListener('click', () => setScrapbookPlaying(!scrapbookPlaying));
document.addEventListener('visibilitychange', () => {
  scrapbookShownAt = performance.now();
  scheduleScrapbookRotation();
});
reducedMotion.addEventListener('change', event => {
  if (event.matches) setScrapbookPlaying(false);
});
setScrapbookPlaying(scrapbookPlaying);

const motionToggle = document.querySelector('.motion-toggle');
const backgroundPreference = 'thang-muoi-mot-pause-background';
let backgroundPaused = false;
try {
  backgroundPaused = localStorage.getItem(backgroundPreference) === 'true';
} catch {
  // The toggle still works for this visit when browser storage is unavailable.
}

function updateBackgroundMotion() {
  document.documentElement.classList.toggle('pause-background', backgroundPaused);
  motionToggle.textContent = backgroundPaused ? 'Bật nền động' : 'Tạm dừng nền động';
}

updateBackgroundMotion();
motionToggle.hidden = false;
motionToggle.addEventListener('click', () => {
  backgroundPaused = !backgroundPaused;
  updateBackgroundMotion();
  try {
    localStorage.setItem(backgroundPreference, String(backgroundPaused));
  } catch {
    // The current page already reflects the user's choice.
  }
});

window.addEventListener('hashchange', () => showScene());
showScene(true);

const tributeStage = document.querySelector('.tribute-stage');
const tributeObserver = new IntersectionObserver(([entry]) => {
  if (entry.intersectionRatio >= .45) tributeStage.classList.add('tribute-in-view');
  else if (!entry.isIntersecting) tributeStage.classList.remove('tribute-in-view');
}, { threshold: [0, .45] });
tributeObserver.observe(tributeStage);
