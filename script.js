const textarea = document.getElementById('note-text');
const charCount = document.getElementById('char-count');
const wordCount = document.getElementById('word-count');
const clearBtn = document.getElementById('clear-btn');
const themeBtn = document.getElementById('theme-toggle');
const body = document.body;

function updateCounts() {
  const text = textarea.value;
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  charCount.textContent = `${chars} / 200 characters`;
  wordCount.textContent = `${words} words`;

  charCount.classList.remove('warning', 'over');
  if (chars > 200) {
    charCount.classList.add('over');
  } else if (chars > 180) {
    charCount.classList.add('warning');
  }
}

function saveDraft() {
  localStorage.setItem('draft', textarea.value);
}

function restoreDraft() {
  const draft = localStorage.getItem('draft');
  if (draft) textarea.value = draft;
}

function clearAll() {
  textarea.value = '';
  localStorage.removeItem('draft');
  updateCounts();
}

function toggleTheme() {
  body.classList.toggle('dark');
  const darkMode = body.classList.contains('dark');
  themeBtn.textContent = darkMode ? 'Light mode' : 'Dark mode';
  localStorage.setItem('theme', darkMode ? 'dark' : 'light');
}

// Events
textarea.addEventListener('input', () => {
  updateCounts();
  saveDraft();
});

textarea.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    clearAll();
  }
});

clearBtn.addEventListener('click', clearAll);
themeBtn.addEventListener('click', toggleTheme);

// On load
restoreDraft();
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
  body.classList.add('dark');
  themeBtn.textContent = 'Light mode';
}
updateCounts();
