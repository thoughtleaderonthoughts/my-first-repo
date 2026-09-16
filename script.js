const books = [
  { id: 1, title: 'The Little Cloud', grade: 'K', time: '3 min', emoji: '☁️', deco: '🌤️', color: '#cfe8ed', pages: ['The little cloud floats in the blue sky.', 'It sees a bird fly by.', 'The cloud makes soft rain for a flower.'] },
  { id: 2, title: 'Max Finds a Friend', grade: 'K', time: '4 min', emoji: '🐶', deco: '🦋', color: '#f8dfb9', pages: ['Max is a small brown dog.', 'He meets a fox by the old log.', 'Now Max and the fox play all day.'] },
  { id: 3, title: 'The Moon Garden', grade: '1', time: '5 min', emoji: '🌙', deco: '🌼', color: '#ccd4eb', pages: ['Mia plants seeds beneath the moon.', 'Silver flowers begin to bloom.', 'Tiny moths dance around the garden.'] },
  { id: 4, title: 'Sam’s Big Adventure', grade: '1', time: '6 min', emoji: '🚲', deco: '🌳', color: '#d9ebcc', pages: ['Sam rides his bike down the path.', 'He crosses a bridge over a stream.', 'At sunset, Sam pedals safely home.'] },
  { id: 5, title: 'The Secret Treehouse', grade: '2', time: '7 min', emoji: '🌳', deco: '🪜', color: '#e7d5b3', pages: ['A secret treehouse waits in the woods.', 'Inside, we find a map and a lantern.', 'The map leads us to a sparkling pond.'] },
  { id: 6, title: 'Luna and the Stars', grade: '2', time: '8 min', emoji: '🔭', deco: '⭐', color: '#d8d4eb', pages: ['Luna watches the stars through her telescope.', 'She draws each bright shape in her notebook.', 'One day, Luna hopes to explore space.'] },
  { id: 7, title: 'A Very Busy Bee', grade: 'K', time: '3 min', emoji: '🐝', deco: '🌻', color: '#f8e6a9', pages: ['Bee buzzes over the green hill.', 'She lands on a big yellow flower.', 'Then Bee carries pollen back home.'] },
  { id: 8, title: 'The Kind Dragon', grade: '2', time: '7 min', emoji: '🐉', deco: '🏰', color: '#d4e7df', pages: ['A gentle dragon lives beyond the castle.', 'He uses warm breath to bake village bread.', 'Everyone cheers for their helpful friend.'] }
];

const grid = document.getElementById('book-grid');
const voiceSelect = document.getElementById('voice-select');
let activeBook = null;
let page = 0;
let wordIndex = 0;
let recognition = null;
let listening = false;
let advancing = false;
let availableVoices = [];
let advanceTimer = null;
let readerGeneration = 0;

function gradeName(grade) {
  return grade === 'K' ? 'Kindergarten' : `${grade}${grade === '1' ? 'st' : 'nd'} grade`;
}

function clean(word) {
  return word.toLowerCase().replace(/[^a-z']/g, '');
}

function renderBooks(filter = 'all') {
  grid.innerHTML = '';
  books.filter((book) => filter === 'all' || book.grade === filter).forEach((book) => {
    const card = document.createElement('article');
    card.className = 'book-card';
    card.tabIndex = 0;
    card.setAttribute('aria-label', `Read ${book.title}, ${gradeName(book.grade)}`);
    card.innerHTML = `<div class="book-cover" style="background:${book.color}"><span class="cloud-deco d1">${book.deco}</span><span class="scene">${book.emoji}</span><span class="cloud-deco d2">☁️</span></div><div class="book-info"><span class="level">${gradeName(book.grade)}</span><h3>${book.title}</h3><div class="book-meta"><span>◷ ${book.time} read</span><span class="read-arrow">→</span></div></div>`;
    card.addEventListener('click', () => openBook(book));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openBook(book);
      }
    });
    const status = document.createElement('p');
    status.className = 'book-status';
    const record = window.readingAccount?.state.books[book.id];
    status.textContent = record?.completedAt ? '✓ Completed · Read again' : record ? 'Continue reading' : 'Start a new adventure';
    card.querySelector('.book-info').appendChild(status);
    grid.appendChild(card);
  });
}

document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => {
  document.querySelector('.filter.active').classList.remove('active');
  button.classList.add('active');
  renderBooks(button.dataset.grade);
  celebrate();
}));

function openBook(book) {
  activeBook = book;
  const saved = ProgressModel.resume(window.readingAccount?.state.books[book.id], book);
  page = saved.page;
  wordIndex = saved.word;
  readerGeneration = window.readingAccount?.state.generation || 0;
  document.getElementById('reader').classList.add('open');
  document.getElementById('reader').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  renderPage();
  celebrate();
}

function renderPage() {
  stopListening();
  clearTimeout(advanceTimer);
  advancing = false;
  const words = activeBook.pages[page].split(' ');
  document.getElementById('story-grade').textContent = gradeName(activeBook.grade);
  document.getElementById('story-title').textContent = activeBook.title;
  document.getElementById('story-picture').style.background = activeBook.color;
  document.getElementById('story-picture').textContent = activeBook.emoji;
  document.getElementById('story-text').innerHTML = words.map((word, index) => `<span class="word ${index < wordIndex ? 'done' : index === wordIndex ? 'current' : ''}" data-word="${clean(word)}">${word}</span>`).join(' ');
  document.getElementById('page-label').textContent = `Page ${page + 1} of ${activeBook.pages.length}`;
  document.getElementById('page-progress').style.width = `${((page + 1) / activeBook.pages.length) * 100}%`;
  document.getElementById('prev-page').disabled = page === 0;
  document.getElementById('next-page').disabled = page === activeBook.pages.length - 1;
  renderPhonics();
  setStatus(wordIndex ? 'Great job! Keep going.' : 'Tap the microphone, then read the glowing word.');
}

function currentWord() {
  return document.querySelector('.word.current')?.dataset.word;
}

// This kid-friendly visual grouping is intentionally simple. It groups common
// English letter teams; it is a reading aid rather than a pronunciation dictionary.
function phonicsParts(word) {
  const letterTeams = ['tion', 'igh', 'tch', 'dge', 'ch', 'sh', 'th', 'ph', 'wh', 'qu', 'ck', 'ng', 'ee', 'oo', 'ai', 'ay', 'ea', 'oa', 'ow', 'ou', 'oi', 'oy', 'ar', 'er', 'ir', 'or', 'ur'];
  const parts = [];
  let cursor = 0;
  while (cursor < word.length) {
    const team = letterTeams.find((candidate) => word.startsWith(candidate, cursor));
    parts.push(team || word[cursor]);
    cursor += (team || word[cursor]).length;
  }
  return parts;
}

function renderPhonics(highlightedLetters = 0, complete = false) {
  const word = currentWord();
  if (!word) return;
  let lettersSeen = 0;
  document.getElementById('phonics-parts').innerHTML = phonicsParts(word).map((part) => {
    lettersSeen += part.length;
    const highlighted = complete || lettersSeen <= highlightedLetters;
    return `<span class="phonics-part${highlighted ? ' heard' : ''}">${part}</span>`;
  }).join('<span class="phonics-dot">·</span>');
}

function longestSharedPrefix(spoken, expected) {
  let length = 0;
  while (length < spoken.length && length < expected.length && spoken[length] === expected[length]) length += 1;
  return length;
}

function showSpeechProgress(transcript) {
  const expected = currentWord();
  if (!expected) return;
  const spokenWord = (transcript.toLowerCase().match(/[a-z']+/g) || []).at(-1) || '';
  renderPhonics(longestSharedPrefix(spokenWord, expected));
}

function completeCurrentWord() {
  if (advancing || !currentWord()) return;
  advancing = true;
  renderPhonics(currentWord().length, true);
  setStatus('That’s right — every sound came together!');
  celebrate();
  advanceTimer = setTimeout(advanceWord, 450);
}

function advanceWord() {
  const words = activeBook.pages[page].split(' ');
  wordIndex += 1;
  window.readingAccount?.record(activeBook.id, page, wordIndex, readerGeneration);
  advancing = false;
  if (wordIndex >= words.length) {
    if (page < activeBook.pages.length - 1) {
      setStatus('Page complete! Moving to the next page…');
      celebrate('Page complete!', true);
      advancing = true;
      stopListening();
      advanceTimer = setTimeout(() => {
        page += 1;
        wordIndex = 0;
        renderPage();
      }, 700);
    } else {
      renderPageWords();
      celebrate('Wonderful reading!', true);
      stopListening();
      document.querySelector('#celebration p').textContent = 'Page complete! Your bookshelf shows your saved progress.';
      document.getElementById('celebration').classList.add('show');
      document.getElementById('celebration').setAttribute('aria-hidden', 'false');
    }
    return;
  }
  renderPageWords();
  renderPhonics();
  setStatus('Great reading! Sound out the next word.');
}

function renderPageWords() {
  document.querySelectorAll('.word').forEach((element, index) => {
    element.classList.toggle('done', index < wordIndex);
    element.classList.toggle('current', index === wordIndex);
  });
}

function setStatus(text) {
  document.querySelector('#speech-status span:last-child').textContent = text;
}

function startListening() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setStatus('Speech recognition is not available here. Try Chrome or Edge.');
    return;
  }
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.onresult = (event) => {
    let heard = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) heard += `${event.results[index][0].transcript} `;
    showSpeechProgress(heard);
    const spoken = heard.toLowerCase().match(/[a-z']+/g) || [];
    if (spoken.includes(currentWord())) completeCurrentWord();
    else if (event.results[event.results.length - 1].isFinal) setStatus(`Almost! Sound it out and try “${currentWord()}” again.`);
  };
  recognition.onerror = (event) => {
    if (event.error !== 'aborted') setStatus(event.error === 'not-allowed' ? 'Please allow microphone access to read aloud.' : 'I didn’t catch that. Tap the microphone and try again.');
    stopListening();
  };
  recognition.onend = () => {
    if (listening) {
      try { recognition.start(); } catch { stopListening(); }
    }
  };
  recognition.start();
  listening = true;
  document.getElementById('mic-button').classList.add('listening');
  document.querySelector('.mic-label').textContent = 'Listening…';
  document.getElementById('speech-status').classList.add('listening');
  setStatus(`Listening for “${currentWord()}”…`);
}

function stopListening() {
  listening = false;
  if (recognition) {
    recognition.onend = null;
    recognition.onresult = null;
    recognition.onerror = null;
    try { recognition.stop(); } catch { /* Recognition may already be stopped. */ }
    recognition = null;
  }
  document.getElementById('mic-button').classList.remove('listening');
  document.querySelector('.mic-label').textContent = 'Start reading';
  document.getElementById('speech-status').classList.remove('listening');
}

function loadVoices() {
  const note = document.getElementById('voice-note');
  const supported = 'speechSynthesis' in window;
  availableVoices = supported ? window.speechSynthesis.getVoices().filter((voice) => /^en([-_]|$)/i.test(voice.lang)) : [];
  const preferred = window.readingAccount?.state.voice || '';
  voiceSelect.replaceChildren(new Option('Default browser voice', ''));
  for (const voice of availableVoices) {
    voiceSelect.appendChild(new Option(`${voice.name} · ${voice.lang}${voice.localService ? ' · on device' : ' · online'}`, voice.voiceURI));
  }
  const found = availableVoices.some((voice) => voice.voiceURI === preferred);
  voiceSelect.value = found ? preferred : '';
  voiceSelect.disabled = !supported;
  document.getElementById('preview-voice').disabled = !supported;
  document.getElementById('voice-speed').value = String(window.readingAccount?.state.rate || 0.82);
  note.textContent = !supported ? 'Read-aloud is not available in this browser.' : preferred && !found ? 'Your saved voice is unavailable on this device. Using the browser default; choose another voice here.' : availableVoices.length ? 'Try the different narrators to find your favorite. Voices are supplied by your device and browser.' : 'Using the browser default. More voices may appear after your device loads them.';
}

function speak(text) {
  stopListening();
  if (!('speechSynthesis' in window)) {
    setStatus('Read-aloud is not available in this browser.');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = availableVoices.find((voice) => voice.voiceURI === voiceSelect.value) || null;
  utterance.lang = utterance.voice?.lang || 'en-US';
  utterance.rate = Number(document.getElementById('voice-speed').value);
  utterance.pitch = 1;
  utterance.onerror = () => { document.getElementById('voice-note').textContent = 'This voice could not play. Try another voice.'; };
  utterance.onstart = () => celebrate();
  window.speechSynthesis.speak(utterance);
}

function closeReader() {
  clearTimeout(advanceTimer);
  advancing = false;
  stopListening();
  window.speechSynthesis?.cancel();
  document.getElementById('reader').classList.remove('open');
  document.getElementById('reader').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

document.getElementById('mic-button').addEventListener('click', () => (listening ? stopListening() : startListening()));
document.getElementById('try-word').addEventListener('click', () => speak(currentWord()));
document.getElementById('listen-story').addEventListener('click', () => speak(activeBook.pages[page]));
document.getElementById('preview-voice').addEventListener('click', () => speak(`Hi ${window.readingAccount?.state.name || 'reader'}! Let’s read a story together.`));
document.getElementById('close-reader').addEventListener('click', closeReader);
document.getElementById('prev-page').addEventListener('click', () => { if (page > 0) { page -= 1; wordIndex = 0; renderPage(); } });
document.getElementById('next-page').addEventListener('click', () => { if (page < activeBook.pages.length - 1) { page += 1; wordIndex = 0; renderPage(); } });
document.getElementById('celebration-close').addEventListener('click', () => {
  document.getElementById('celebration').classList.remove('show');
  document.getElementById('celebration').setAttribute('aria-hidden', 'true');
  closeReader();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    document.getElementById('celebration').classList.remove('show');
    document.getElementById('celebration').setAttribute('aria-hidden', 'true');
    closeReader();
  }
});

loadVoices();
if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = loadVoices;
renderBooks();

voiceSelect.addEventListener('change', () => window.readingAccount?.preferences({ voice: voiceSelect.value }));
document.getElementById('voice-speed').addEventListener('change', (event) => window.readingAccount?.preferences({ rate: Number(event.target.value) }));
