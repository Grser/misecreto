// src/lib/api.js

const normalizeApiBase = (rawBase) => {
  if (!rawBase) return null;
  const clean = String(rawBase).trim().replace(/\/+$/, '');
  if (!clean) return null;
  if (clean.endsWith('api.php')) return clean;
  if (clean.endsWith('/backend')) return `${clean}/api.php`;
  return `${clean}/backend/api.php`;
};

const resolveApiBase = () => {
  const envBase = normalizeApiBase(process.env.EXPO_PUBLIC_API_URL);
  if (envBase) return envBase;

  if (typeof window !== 'undefined' && window?.location?.origin) {
    return `${window.location.origin}/backend/api.php`;
  }

  return 'http://127.0.0.1/backend/api.php';
};

const API_BASE = resolveApiBase();

const withAction = (base, action) => {
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}action=${encodeURIComponent(action)}`;
};

const fetchWithTimeout = async (url, init = {}, timeoutMs = 9000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

async function request(action, options = {}) {
  const { method = 'GET', token, body } = options;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = withAction(API_BASE, action);
  const res = await fetchWithTimeout(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return { res, url };
}

const parseJsonPayload = async (res, meta) => {
  const rawText = await res.text();
  if (!rawText) return {};

  try {
    return JSON.parse(rawText);
  } catch (error) {
    const parseError = new Error('Respuesta inválida del servidor. Verifica que la URL del backend apunte a /backend/api.php.');
    parseError.code = 'API_PARSE_ERROR';
    throw parseError;
  }
};

export async function apiRequest(action, options = {}) {
  try {
    const { res, url } = await request(action, options);
    const payload = await parseJsonPayload(res, { action, method: options?.method || 'GET', url });

    if (res.ok && payload?.ok !== false) {
      return payload;
    }

    throw new Error(payload?.error || `Error HTTP ${res.status}`);
  } catch (error) {
    if (error?.code === 'API_PARSE_ERROR') {
      throw error;
    }
    if (/aborted|network|failed|load|connection/i.test(error?.message || '')) {
      throw new Error(
        `No se pudo conectar al servidor (${API_BASE}). `
        + 'Asegúrate de que el backend PHP esté ejecutándose y que EXPO_PUBLIC_API_URL sea correcta.'
      );
    }
    throw error;
  }
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
