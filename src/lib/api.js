// src/lib/api.js
const WEB_DEFAULT = typeof window !== 'undefined' && window?.location
  ? `${window.location.protocol}//${window.location.hostname}/backend/api.php`
  : null;

export const API_BASE = process.env.EXPO_PUBLIC_API_URL || WEB_DEFAULT || 'http://127.0.0.1/backend/api.php';

const buildUrl = (action) => `${API_BASE}?action=${encodeURIComponent(action)}`;

export async function apiRequest(action, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(buildUrl(action), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    throw new Error('Respuesta inválida del servidor');
  }

  if (!res.ok || payload?.ok === false) {
    throw new Error(payload?.error || `Error HTTP ${res.status}`);
  }

  return payload;
}

export const authApi = {
  login: (username, password) => apiRequest('login', { method: 'POST', body: { username, password } }),
  register: (username, password) => apiRequest('register', { method: 'POST', body: { username, password } }),
};

export const secretsApi = {
  list: (token) => apiRequest('secrets.list', { token }),
  create: (token, data) => apiRequest('secrets.create', { method: 'POST', token, body: data }),
};

export const healthApi = {
  check: () => apiRequest('health'),
};
