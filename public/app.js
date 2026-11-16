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
  const scene = scenes.find(item => item.id === route) ?? scenes[0];
  const changed = activeScene !== scene;
  if (changed) {
    scenes.forEach(item => { item.hidden = item !== scene; });
    navigation.forEach(link => {
      if (link.hash === '#' + scene.id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    activeScene = scene;
    if (scene.id === 'luu-but') loadNotes();
  }
  if (route === 'hanh-trinh') {
    requestAnimationFrame(() => document.querySelector('#hanh-trinh').scrollIntoView());
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
