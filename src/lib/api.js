// src/lib/api.js
const normalizeApiBase = (rawBase) => {
  if (!rawBase) return null;

  const clean = String(rawBase).trim().replace(/\/+$/, '');
  if (!clean) return null;

  // Si te pasan solo dominio (https://mi-api.com), agregamos la ruta esperada.
  if (!clean.includes('api.php')) {
    return `${clean}/backend/api.php`;
  }

  return clean;
};

const WEB_DEFAULT = typeof window !== 'undefined' && window?.location
  ? `${window.location.origin}/backend/api.php`
  : null;

export const API_BASE = normalizeApiBase(process.env.EXPO_PUBLIC_API_URL)
  || WEB_DEFAULT
  || 'http://127.0.0.1/backend/api.php';

const buildUrl = (action) => `${API_BASE}?action=${encodeURIComponent(action)}`;

export async function apiRequest(action, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(buildUrl(action), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('No se pudo conectar al servidor. Revisa EXPO_PUBLIC_API_URL y que backend/api.php esté activo.');
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    throw new Error('Respuesta inválida del servidor. Verifica que EXPO_PUBLIC_API_URL apunte a /backend/api.php.');
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
