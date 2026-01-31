const API_BASE = '/api';

class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  const config = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      data.error?.message || 'Request failed',
      response.status,
      data.error?.code
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// Health check
export async function getHealth() {
  const response = await fetch('/health');
  return response.json();
}

// Questions / Ask
export async function askQuestion(question, targetLanguage, sourceLanguage) {
  return request('/questions', {
    method: 'POST',
    body: { question, target_language: targetLanguage, source_language: sourceLanguage },
  });
}

export async function getQuestions(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/questions${query ? `?${query}` : ''}`);
}

// Phrases
export async function getPhrases(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/phrases${query ? `?${query}` : ''}`);
}

export async function createPhrase(phrase) {
  return request('/phrases', {
    method: 'POST',
    body: phrase,
  });
}

export async function deletePhrase(id) {
  return request(`/phrases/${id}`, { method: 'DELETE' });
}

export async function confirmPhrase(id) {
  return request(`/phrases/${id}/confirm`, { method: 'POST' });
}

// Practice / SRS
export async function getDueReviews() {
  return request('/practice/due');
}

export async function submitReview(phraseId, quality) {
  return request('/practice/review', {
    method: 'POST',
    body: { phrase_id: phraseId, quality },
  });
}

// Conversations
export async function getConversations() {
  return request('/conversations');
}

export async function createConversation(data) {
  return request('/conversations', {
    method: 'POST',
    body: data,
  });
}

export async function getConversation(id) {
  return request(`/conversations/${id}`);
}

export async function deleteConversation(id) {
  return request(`/conversations/${id}`, { method: 'DELETE' });
}

export async function sendMessage(conversationId, content) {
  return request(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: { content },
  });
}

// Settings
export async function getSettings() {
  return request('/settings');
}

export async function updateSettings(settings) {
  return request('/settings', {
    method: 'PUT',
    body: settings,
  });
}

export { ApiError };
