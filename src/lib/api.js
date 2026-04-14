// src/lib/api.js
const normalizeApiBase = (rawBase) => {
  if (!rawBase) return null;

  const clean = String(rawBase).trim().replace(/\/+$/, '');
  if (!clean) return null;

  if (clean.endsWith('api.php')) return clean;
  if (clean.endsWith('/backend')) return `${clean}/api.php`;

  // Si te pasan solo dominio (https://mi-api.com), agregamos la ruta esperada.
  return `${clean}/backend/api.php`;
};

const WEB_DEFAULT = typeof window !== 'undefined' && window?.location
  ? `${window.location.origin}/backend/api.php`
  : null;

export const API_BASE = normalizeApiBase(process.env.EXPO_PUBLIC_API_URL)
  || WEB_DEFAULT
  || 'http://127.0.0.1/backend/api.php';

const buildUrl = (action) => {
  const separator = API_BASE.includes('?') ? '&' : '?';
  return `${API_BASE}${separator}action=${encodeURIComponent(action)}`;
};

const getWebOrigin = () => {
  if (typeof window === 'undefined' || !window?.location) return null;
  return window.location.origin || null;
};

const debugApi = (stage, details = {}) => {
  if (typeof console === 'undefined' || typeof console.info !== 'function') return;
  console.info('[MiSecreto API DEBUG]', stage, {
    apiBase: API_BASE,
    webOrigin: getWebOrigin(),
    ...details,
  });
};

export async function apiRequest(action, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = buildUrl(action);
  debugApi('request:start', { action, method, url, hasToken: Boolean(token) });

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    debugApi('request:network_error', {
      action,
      method,
      url,
      error: error?.message || String(error),
    });
    throw new Error('No se pudo conectar al servidor. Revisa EXPO_PUBLIC_API_URL y que backend/api.php esté activo.');
  }

  let payload = null;
  try {
    const rawText = await res.text();
    payload = rawText ? JSON.parse(rawText) : {};
  } catch (error) {
    debugApi('request:parse_error', {
      action,
      method,
      url,
      status: res.status,
      error: error?.message || String(error),
    });
    throw new Error('Respuesta inválida del servidor. Verifica que EXPO_PUBLIC_API_URL apunte a /backend/api.php.');
  }

  debugApi('request:response', {
    action,
    method,
    url,
    status: res.status,
    ok: res.ok,
    payloadOk: payload?.ok,
    payloadError: payload?.error,
  });

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
