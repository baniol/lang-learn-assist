import * as api from './api.js';

// State
let state = {
  settings: null,
  languages: [],
  tags: [],
};

// Load initial state
async function loadState() {
  try {
    const [settings, languages, tags] = await Promise.all([
      api.getSettings(),
      api.getLanguages(),
      api.getTags(),
    ]);
    state.settings = settings;
    state.languages = languages;
    state.tags = tags;
  } catch (e) {
    console.error('Failed to load state:', e);
  }
}

// Router
class Router {
  constructor(routes) {
    this.routes = routes;
    this.contentEl = document.getElementById('app-content');
    window.addEventListener('hashchange', () => this.navigate());
  }

  navigate() {
    const hash = window.location.hash || '#/';
    const path = hash.slice(1) || '/';

    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('href') === hash) {
        item.classList.add('active');
      }
    });

    const route = this.routes[path] || this.routes['/404'];
    this.render(route);
  }

  async render(route) {
    if (typeof route === 'function') {
      const content = await route();
      this.contentEl.innerHTML = content;
      // Run post-render hooks
      if (route.afterRender) {
        route.afterRender();
      }
    } else {
      this.contentEl.innerHTML = route;
    }
  }
}

// Language helpers
const LANGUAGES = {
  en: 'English',
  de: 'German',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  pt: 'Portuguese',
  pl: 'Polish',
  nl: 'Dutch',
  ru: 'Russian',
  ja: 'Japanese',
  zh: 'Chinese',
  ko: 'Korean',
};

function getLangName(code) {
  return LANGUAGES[code] || code;
}

function langOptions(selected, exclude = null) {
  return Object.entries(LANGUAGES)
    .filter(([code]) => code !== exclude)
    .map(([code, name]) =>
      `<option value="${code}" ${code === selected ? 'selected' : ''}>${name}</option>`
    ).join('');
}

// Views
const views = {
  '/': async () => {
    const health = await api.getHealth().catch(() => null);
    return `
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">Welcome to LangLearn</h1>
        </div>
        <p>Your language learning assistant. Get started by:</p>
        <ul style="margin-top: var(--spacing-md); margin-left: var(--spacing-lg); list-style: disc;">
          <li><a href="#/ask">Ask a question</a> about translations or grammar</li>
          <li>Review your <a href="#/phrases">saved phrases</a></li>
          <li>Start a <a href="#/practice">practice session</a></li>
        </ul>
        <div class="mt-md text-sm text-muted">
          Backend: ${health ? `<span style="color: var(--color-success);">${health.status}</span> (v${health.version})` : '<span style="color: var(--color-error);">offline</span>'}
        </div>
      </div>
    `;
  },

  '/ask': () => {
    const src = state.settings?.source_language || 'en';
    const tgt = state.settings?.active_target_language || 'de';
    return `
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">Ask a Question</h1>
        </div>
        <form id="ask-form">
          <div class="form-group">
            <label class="form-label" for="question">Your question</label>
            <textarea
              id="question"
              class="form-textarea"
              placeholder="How do you say 'I would like a coffee' in German?"
              rows="3"
            ></textarea>
          </div>
          <div class="flex gap-md">
            <div class="form-group" style="flex: 1;">
              <label class="form-label" for="source-lang">From</label>
              <select id="source-lang" class="form-select">
                ${langOptions(src)}
              </select>
            </div>
            <div class="form-group" style="flex: 1;">
              <label class="form-label" for="target-lang">To</label>
              <select id="target-lang" class="form-select">
                ${langOptions(tgt)}
              </select>
            </div>
          </div>
          <button type="submit" class="btn btn-primary" id="ask-btn">Ask</button>
        </form>
        <div id="answer" class="mt-md hidden"></div>
      </div>
    `;
  },

  '/phrases': async () => {
    const tgt = state.settings?.active_target_language;
    const phrases = await api.getPhrases(tgt ? { target_language: tgt } : {}).catch(() => []);

    const phrasesList = phrases.length === 0
      ? '<p class="text-muted text-center">No phrases yet. Ask questions to get phrase suggestions.</p>'
      : phrases.map(p => `
          <div class="phrase-item" data-id="${p.id}">
            <div class="phrase-content">
              <div class="phrase-text">${escapeHtml(p.phrase)}</div>
              <div class="phrase-translation text-muted text-sm">${escapeHtml(p.translation || '')}</div>
              ${p.context ? `<div class="phrase-context text-muted text-sm" style="font-style: italic;">${escapeHtml(p.context)}</div>` : ''}
            </div>
            <div class="phrase-meta text-sm text-muted">
              ${getLangName(p.target_language)}
            </div>
            <button class="btn btn-ghost btn-sm delete-phrase" data-id="${p.id}">Delete</button>
          </div>
        `).join('');

    return `
      <div class="card">
        <div class="card-header flex justify-between items-center">
          <h1 class="card-title">Phrases</h1>
          <div class="flex gap-md items-center">
            <select id="filter-lang" class="form-select" style="width: auto;">
              <option value="">All languages</option>
              ${state.languages.map(l =>
                `<option value="${l.target_language}" ${l.target_language === tgt ? 'selected' : ''}>${getLangName(l.target_language)}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        <div id="phrases-list">
          ${phrasesList}
        </div>
      </div>
      <style>
        .phrase-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--color-border);
        }
        .phrase-item:last-child { border-bottom: none; }
        .phrase-content { flex: 1; }
        .phrase-text { font-weight: 500; }
      </style>
    `;
  },

  '/tags': async () => {
    const tags = await api.getTags().catch(() => []);

    const tagsList = tags.length === 0
      ? '<p class="text-muted text-center">No tags yet.</p>'
      : tags.map(t => `
          <div class="tag-item flex items-center gap-md" data-id="${t.id}">
            <span class="badge" style="background: ${t.color || 'var(--color-bg-secondary)'};">${escapeHtml(t.name)}</span>
            <div class="flex-1"></div>
            <button class="btn btn-ghost btn-sm edit-tag" data-id="${t.id}" data-name="${escapeHtml(t.name)}" data-color="${t.color || ''}">Edit</button>
            <button class="btn btn-ghost btn-sm delete-tag" data-id="${t.id}">Delete</button>
          </div>
        `).join('');

    return `
      <div class="card">
        <div class="card-header flex justify-between items-center">
          <h1 class="card-title">Tags</h1>
          <button class="btn btn-primary btn-sm" id="add-tag-btn">Add Tag</button>
        </div>
        <div id="tags-list">
          ${tagsList}
        </div>
        <div id="tag-form" class="mt-md hidden">
          <div class="flex gap-md">
            <input type="text" id="tag-name" class="form-input" placeholder="Tag name" style="flex: 1;">
            <input type="color" id="tag-color" class="form-input" value="#4a90d9" style="width: 60px;">
            <button class="btn btn-primary" id="save-tag-btn">Save</button>
            <button class="btn btn-secondary" id="cancel-tag-btn">Cancel</button>
          </div>
        </div>
      </div>
      <style>
        .tag-item { padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--color-border); }
        .tag-item:last-child { border-bottom: none; }
      </style>
    `;
  },

  '/settings': async () => {
    const settings = state.settings || await api.getSettings().catch(() => ({}));
    const languages = state.languages || await api.getLanguages().catch(() => []);

    const languagesList = languages.map(l => `
      <div class="flex items-center gap-md" style="padding: var(--spacing-xs) 0;">
        <span class="badge ${l.target_language === settings.active_target_language ? 'badge-primary' : ''}">${getLangName(l.target_language)}</span>
        ${l.target_language !== settings.active_target_language
          ? `<button class="btn btn-ghost btn-sm set-active-lang" data-lang="${l.target_language}">Set Active</button>`
          : '<span class="text-sm text-muted">(active)</span>'}
        <button class="btn btn-ghost btn-sm remove-lang" data-id="${l.id}">Remove</button>
      </div>
    `).join('');

    return `
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">Settings</h1>
        </div>

        <h3 style="margin-bottom: var(--spacing-sm);">Source Language</h3>
        <div class="form-group">
          <select id="source-language" class="form-select">
            ${langOptions(settings.source_language || 'en')}
          </select>
        </div>

        <h3 style="margin-bottom: var(--spacing-sm);">Target Languages</h3>
        <div id="languages-list" style="margin-bottom: var(--spacing-md);">
          ${languagesList || '<p class="text-muted">No target languages added.</p>'}
        </div>
        <div class="flex gap-md">
          <select id="new-language" class="form-select" style="flex: 1;">
            ${langOptions('')}
          </select>
          <button class="btn btn-secondary" id="add-language-btn">Add Language</button>
        </div>

        <hr style="margin: var(--spacing-lg) 0;">

        <h3 style="margin-bottom: var(--spacing-sm);">Learning Settings</h3>
        <div class="flex gap-md">
          <div class="form-group" style="flex: 1;">
            <label class="form-label" for="daily-goal">Daily Goal</label>
            <input type="number" id="daily-goal" class="form-input" value="${settings.daily_goal || 20}" min="1" max="100">
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label" for="session-limit">Session Limit</label>
            <input type="number" id="session-limit" class="form-input" value="${settings.session_limit || 10}" min="1" max="50">
          </div>
        </div>

        <button class="btn btn-primary" id="save-settings-btn">Save Settings</button>
      </div>
    `;
  },

  '/practice': () => `
    <div class="card">
      <div class="card-header">
        <h1 class="card-title">Practice</h1>
      </div>
      <div class="text-center">
        <p class="text-muted">Practice mode coming in Phase 4.</p>
      </div>
    </div>
  `,

  '/404': () => `
    <div class="card text-center">
      <h1>404</h1>
      <p class="text-muted">Page not found</p>
      <a href="#/" class="btn btn-primary mt-md">Go Home</a>
    </div>
  `,
};

// Escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Event delegation
document.addEventListener('click', async (e) => {
  const target = e.target;

  // Ask form submit
  if (target.id === 'ask-btn') {
    e.preventDefault();
    await handleAskSubmit();
  }

  // Save phrase from suggestion
  if (target.classList.contains('save-phrase')) {
    await handleSavePhrase(target);
  }

  // Delete phrase
  if (target.classList.contains('delete-phrase')) {
    await handleDeletePhrase(target.dataset.id);
  }

  // Filter phrases by language
  if (target.id === 'filter-lang') {
    const lang = target.value;
    if (lang) {
      await api.updateSettings({ active_target_language: lang });
      state.settings.active_target_language = lang;
    }
    router.navigate();
  }

  // Settings - add language
  if (target.id === 'add-language-btn') {
    const select = document.getElementById('new-language');
    if (select.value) {
      await api.addLanguage(select.value);
      state.languages = await api.getLanguages();
      router.navigate();
    }
  }

  // Settings - remove language
  if (target.classList.contains('remove-lang')) {
    await api.removeLanguage(target.dataset.id);
    state.languages = await api.getLanguages();
    router.navigate();
  }

  // Settings - set active language
  if (target.classList.contains('set-active-lang')) {
    await api.updateSettings({ active_target_language: target.dataset.lang });
    state.settings.active_target_language = target.dataset.lang;
    router.navigate();
  }

  // Settings - save
  if (target.id === 'save-settings-btn') {
    await handleSaveSettings();
  }

  // Tags - add
  if (target.id === 'add-tag-btn') {
    document.getElementById('tag-form').classList.remove('hidden');
    document.getElementById('tag-name').value = '';
    document.getElementById('tag-name').dataset.editId = '';
  }

  // Tags - cancel
  if (target.id === 'cancel-tag-btn') {
    document.getElementById('tag-form').classList.add('hidden');
  }

  // Tags - save
  if (target.id === 'save-tag-btn') {
    await handleSaveTag();
  }

  // Tags - edit
  if (target.classList.contains('edit-tag')) {
    document.getElementById('tag-form').classList.remove('hidden');
    document.getElementById('tag-name').value = target.dataset.name;
    document.getElementById('tag-color').value = target.dataset.color || '#4a90d9';
    document.getElementById('tag-name').dataset.editId = target.dataset.id;
  }

  // Tags - delete
  if (target.classList.contains('delete-tag')) {
    await api.deleteTag(target.dataset.id);
    state.tags = await api.getTags();
    router.navigate();
  }
});

// Change events
document.addEventListener('change', async (e) => {
  if (e.target.id === 'filter-lang') {
    const lang = e.target.value;
    if (lang) {
      await api.updateSettings({ active_target_language: lang });
      state.settings.active_target_language = lang;
    }
    router.navigate();
  }
});

// Form submissions
document.addEventListener('submit', async (e) => {
  if (e.target.id === 'ask-form') {
    e.preventDefault();
    await handleAskSubmit();
  }
});

// Handlers
async function handleAskSubmit() {
  const btn = document.getElementById('ask-btn');
  const question = document.getElementById('question').value.trim();
  const sourceLang = document.getElementById('source-lang').value;
  const targetLang = document.getElementById('target-lang').value;

  if (!question) return;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Asking...';

  try {
    const result = await api.askQuestion(question, targetLang, sourceLang);
    showAnswer(result);
  } catch (err) {
    showAnswer({ error: err.message });
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ask';
  }
}

function showAnswer(result) {
  const answerEl = document.getElementById('answer');
  answerEl.classList.remove('hidden');

  if (result.error) {
    answerEl.innerHTML = `<div class="message" style="background: var(--color-error); color: white;">${escapeHtml(result.error)}</div>`;
    return;
  }

  const phrasesHtml = result.suggested_phrases?.length
    ? result.suggested_phrases.map((p, i) => `
        <div class="phrase-suggestion flex items-center gap-md" style="padding: var(--spacing-sm); background: var(--color-bg-secondary); border-radius: var(--border-radius); margin-bottom: var(--spacing-sm);">
          <div style="flex: 1;">
            <div style="font-weight: 500;">${escapeHtml(p.phrase)}</div>
            <div class="text-sm text-muted">${escapeHtml(p.translation)}</div>
            ${p.context ? `<div class="text-sm text-muted" style="font-style: italic;">${escapeHtml(p.context)}</div>` : ''}
          </div>
          <button class="btn btn-primary btn-sm save-phrase"
            data-phrase="${escapeHtml(p.phrase)}"
            data-translation="${escapeHtml(p.translation)}"
            data-context="${escapeHtml(p.context || '')}"
            data-question-id="${result.id}"
            data-target="${document.getElementById('target-lang').value}"
            data-source="${document.getElementById('source-lang').value}">
            Save
          </button>
        </div>
      `).join('')
    : '<p class="text-muted">No phrases suggested.</p>';

  answerEl.innerHTML = `
    <hr style="margin: var(--spacing-md) 0;">
    <div class="message message-assistant">
      <div style="margin-bottom: var(--spacing-md);">${escapeHtml(result.response || '')}</div>
      <h4 style="margin-bottom: var(--spacing-sm);">Suggested Phrases</h4>
      ${phrasesHtml}
    </div>
  `;
}

async function handleSavePhrase(btn) {
  const phrase = {
    phrase: btn.dataset.phrase,
    translation: btn.dataset.translation,
    context: btn.dataset.context || null,
    target_language: btn.dataset.target,
    source_language: btn.dataset.source,
    question_id: btn.dataset.questionId,
  };

  try {
    await api.createPhrase(phrase);
    btn.textContent = 'Saved!';
    btn.disabled = true;
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');
  } catch (err) {
    btn.textContent = 'Error';
    console.error(err);
  }
}

async function handleDeletePhrase(id) {
  if (!confirm('Delete this phrase?')) return;
  await api.deletePhrase(id);
  router.navigate();
}

async function handleSaveSettings() {
  const settings = {
    source_language: document.getElementById('source-language').value,
    daily_goal: parseInt(document.getElementById('daily-goal').value, 10),
    session_limit: parseInt(document.getElementById('session-limit').value, 10),
  };

  try {
    state.settings = await api.updateSettings(settings);
    alert('Settings saved!');
  } catch (err) {
    alert('Failed to save settings: ' + err.message);
  }
}

async function handleSaveTag() {
  const name = document.getElementById('tag-name').value.trim();
  const color = document.getElementById('tag-color').value;
  const editId = document.getElementById('tag-name').dataset.editId;

  if (!name) return;

  try {
    if (editId) {
      await api.updateTag(editId, { name, color });
    } else {
      await api.createTag(name, color);
    }
    state.tags = await api.getTags();
    document.getElementById('tag-form').classList.add('hidden');
    router.navigate();
  } catch (err) {
    alert('Failed to save tag: ' + err.message);
  }
}

// Update nav with Tags link
function updateNav() {
  const nav = document.querySelector('.nav-list');
  const tagsLink = nav.querySelector('[data-view="tags"]');
  if (!tagsLink) {
    const li = document.createElement('li');
    li.innerHTML = '<a href="#/tags" class="nav-item" data-view="tags">Tags</a>';
    nav.insertBefore(li, nav.querySelector('[data-view="practice"]')?.parentElement);
  }
}

// Router instance - must be created before event handlers use it
const router = new Router(views);

// Initialize
async function init() {
  await loadState();
  updateNav();
  // Navigate after state is loaded
  router.navigate();
}

init();
