import { getHealth } from './api.js';

// Simple router
class Router {
  constructor(routes) {
    this.routes = routes;
    this.contentEl = document.getElementById('app-content');

    window.addEventListener('hashchange', () => this.navigate());
    window.addEventListener('load', () => this.navigate());
  }

  navigate() {
    const hash = window.location.hash || '#/';
    const path = hash.slice(1) || '/';

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('href') === hash) {
        item.classList.add('active');
      }
    });

    // Find matching route
    const route = this.routes[path] || this.routes['/404'];
    this.render(route);
  }

  async render(route) {
    if (typeof route === 'function') {
      const content = await route();
      this.contentEl.innerHTML = content;
    } else {
      this.contentEl.innerHTML = route;
    }
  }
}

// Views
const views = {
  '/': () => `
    <div class="card">
      <div class="card-header">
        <h1 class="card-title">Welcome to LangLearn</h1>
      </div>
      <p>Your language learning assistant. Get started by:</p>
      <ul style="margin-top: var(--spacing-md); margin-left: var(--spacing-lg); list-style: disc;">
        <li><a href="#/ask">Ask a question</a> about translations or grammar</li>
        <li>Review your <a href="#/phrases">saved phrases</a></li>
        <li>Start a <a href="#/practice">practice session</a></li>
        <li>Have a <a href="#/conversations">conversation</a> with AI</li>
      </ul>
      <div id="health-status" class="mt-md text-sm text-muted"></div>
    </div>
  `,

  '/ask': () => `
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
            placeholder="How do you say 'hello' in German?"
            rows="3"
          ></textarea>
        </div>
        <div class="flex gap-md">
          <div class="form-group" style="flex: 1;">
            <label class="form-label" for="source-lang">From</label>
            <select id="source-lang" class="form-select">
              <option value="en">English</option>
              <option value="pl">Polish</option>
            </select>
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label" for="target-lang">To</label>
            <select id="target-lang" class="form-select">
              <option value="de">German</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
            </select>
          </div>
        </div>
        <button type="submit" class="btn btn-primary">Ask</button>
      </form>
      <div id="answer" class="mt-md hidden">
        <hr>
        <div id="answer-content"></div>
      </div>
    </div>
  `,

  '/phrases': () => `
    <div class="card">
      <div class="card-header flex justify-between items-center">
        <h1 class="card-title">Phrases</h1>
        <button class="btn btn-primary btn-sm">Add Phrase</button>
      </div>
      <div id="phrases-list">
        <p class="text-muted text-center">No phrases yet. Ask questions to extract phrases.</p>
      </div>
    </div>
  `,

  '/practice': () => `
    <div class="card">
      <div class="card-header">
        <h1 class="card-title">Practice</h1>
      </div>
      <div id="practice-content">
        <p class="text-muted text-center">No phrases due for review.</p>
        <div class="text-center mt-md">
          <button class="btn btn-primary">Start Practice</button>
        </div>
      </div>
    </div>
  `,

  '/conversations': () => `
    <div class="card">
      <div class="card-header flex justify-between items-center">
        <h1 class="card-title">Conversations</h1>
        <button class="btn btn-primary btn-sm">New Conversation</button>
      </div>
      <div id="conversations-list">
        <p class="text-muted text-center">No conversations yet.</p>
      </div>
    </div>
  `,

  '/settings': () => `
    <div class="card">
      <div class="card-header">
        <h1 class="card-title">Settings</h1>
      </div>
      <form id="settings-form">
        <div class="form-group">
          <label class="form-label" for="source-language">Native Language</label>
          <select id="source-language" class="form-select">
            <option value="en">English</option>
            <option value="pl">Polish</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="target-language">Learning Language</label>
          <select id="target-language" class="form-select">
            <option value="de">German</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="daily-goal">Daily Goal (phrases)</label>
          <input type="number" id="daily-goal" class="form-input" value="20" min="1" max="100">
        </div>
        <button type="submit" class="btn btn-primary">Save Settings</button>
      </form>
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

// Initialize router
const router = new Router(views);

// Check API health on home page
async function checkHealth() {
  const statusEl = document.getElementById('health-status');
  if (!statusEl) return;

  try {
    const health = await getHealth();
    statusEl.innerHTML = `Backend: <span style="color: var(--color-success);">${health.status}</span> (v${health.version})`;
  } catch (error) {
    statusEl.innerHTML = `Backend: <span style="color: var(--color-error);">offline</span>`;
  }
}

// Run health check when navigating to home
window.addEventListener('hashchange', () => {
  if (window.location.hash === '#/' || window.location.hash === '') {
    setTimeout(checkHealth, 100);
  }
});

// Initial health check
setTimeout(checkHealth, 100);
