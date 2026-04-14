// src/lib/api.js

const normalizeApiBase = (rawBase) => {
  if (!rawBase) return null;

  const clean = String(rawBase).trim().replace(/\/+$/, '');
  if (!clean) return null;

  if (clean.endsWith('api.php')) return clean;
  if (clean.endsWith('/backend')) return `${clean}/api.php`;

  return `${clean}/backend/api.php`;
};

const getWebRuntimeContext = () => {
  if (typeof window === 'undefined' || !window?.location) return null;

  const { protocol, hostname, origin, pathname } = window.location;
  const firstSegment = pathname
    .split('/')
    .filter(Boolean)
    .at(0);

  return {
    protocol,
    hostname,
    origin,
    firstSegment,
  };
};

const getCandidateApiBases = () => {
  const seen = new Set();
  const out = [];

  const push = (value) => {
    const normalized = normalizeApiBase(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  };

  const web = getWebRuntimeContext();
  const isLocalWebHost = web && (web.hostname === 'localhost' || web.hostname === '127.0.0.1');

  // 1) Valor explícito del entorno, prioridad máxima salvo localhost en web remota.
  const envBase = normalizeApiBase(process.env.EXPO_PUBLIC_API_URL);
  if (envBase) {
    const pointsToLocalhost = /\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\b/i.test(envBase);
    if (!pointsToLocalhost || !web || isLocalWebHost) {
      push(envBase);
    }
  }

  if (web) {
    // 2) Mismo host desde donde corre la web.
    push(`${web.origin}/backend/api.php`);

    // 3) Si la app está bajo subruta, intentamos con ese prefijo.
    if (web.firstSegment && web.firstSegment !== 'backend') {
      push(`${web.origin}/${web.firstSegment}/backend/api.php`);
    }

    // 4) Desarrollo local típico: probamos http/https y puertos comunes de Apache/PHP.
    if (isLocalWebHost) {
      const protocols = [...new Set([web.protocol, 'http:', 'https:'])].filter(Boolean);
      const hosts = ['localhost', '127.0.0.1'];
      const roots = ['', '/misecreto'];
      const ports = ['', ':8000', ':8080', ':8888'];

      for (const protocol of protocols) {
        for (const host of hosts) {
          for (const port of ports) {
            for (const root of roots) {
              push(`${protocol}//${host}${port}${root}/backend/api.php`);
            }
          }
        }
      }
    }
  }

  // 5) Emulador Android + fallback localhost solo fuera de web remota.
  push('http://10.0.2.2/backend/api.php');
  if (!web || isLocalWebHost) {
    push('http://127.0.0.1/backend/api.php');
    push('http://127.0.0.1:8000/backend/api.php');
    push('http://127.0.0.1:8080/backend/api.php');
  }

  return out;
};

const API_CANDIDATES = getCandidateApiBases();
let workingApiBase = API_CANDIDATES[0] || 'http://127.0.0.1/backend/api.php';

const withAction = (base, action) => {
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}action=${encodeURIComponent(action)}`;
};

const getWebOrigin = () => {
  if (typeof window === 'undefined' || !window?.location) return null;
  return window.location.origin || null;
};

const debugApi = (stage, details = {}) => {
  if (typeof console === 'undefined' || typeof console.info !== 'function') return;
  console.info('[MiSecreto API DEBUG]', stage, {
    workingApiBase,
    candidates: API_CANDIDATES,
    webOrigin: getWebOrigin(),
    ...details,
  });
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

const shouldTryNextBase = (res) => {
  // 404 en action=health suele indicar ruta incorrecta en ese host.
  return res.status === 404;
};

async function requestAgainstBase(base, action, options = {}) {
  const { method = 'GET', token, body } = options;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = withAction(base, action);
  const res = await fetchWithTimeout(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return { res, url };
}

async function resolveWorkingBase() {
  if (!API_CANDIDATES.length) return workingApiBase;

  for (const candidate of API_CANDIDATES) {
    try {
      const { res } = await requestAgainstBase(candidate, 'health');
      if (res.ok) {
        workingApiBase = candidate;
        debugApi('base:resolved', { resolved: candidate, status: res.status });
        return workingApiBase;
      }

      if (!shouldTryNextBase(res)) {
        // Si responde algo distinto de 404, existe backend en ese host.
        workingApiBase = candidate;
        debugApi('base:resolved_non404', { resolved: candidate, status: res.status });
        return workingApiBase;
      }
    } catch (error) {
      debugApi('base:candidate_failed', {
        candidate,
        error: error?.message || String(error),
      });
    }
  }

  // Si nada funcionó, dejamos el primero para reportar error coherente.
  workingApiBase = API_CANDIDATES[0];
  return workingApiBase;
}

const parseJsonPayload = async (res, meta) => {
  const rawText = await res.text();
  if (!rawText) return {};

  try {
    return JSON.parse(rawText);
  } catch (error) {
    debugApi('request:parse_error', {
      ...meta,
      status: res.status,
      error: error?.message || String(error),
      snippet: rawText.slice(0, 180),
    });
    const parseError = new Error('Respuesta inválida del servidor. Verifica que la URL del backend apunte a /backend/api.php.');
    parseError.code = 'API_PARSE_ERROR';
    throw parseError;
  }
};

export async function apiRequest(action, options = {}) {
  await resolveWorkingBase();

  const method = options?.method || 'GET';
  const tried = [];
  const basesToTry = [workingApiBase, ...API_CANDIDATES.filter((b) => b !== workingApiBase)];

  for (const base of basesToTry) {
    const meta = { action, method, base };

    try {
      const { res, url } = await requestAgainstBase(base, action, options);
      tried.push(url);

      const payload = await parseJsonPayload(res, { ...meta, url });

      debugApi('request:response', {
        ...meta,
        url,
        status: res.status,
        ok: res.ok,
        payloadOk: payload?.ok,
        payloadError: payload?.error,
      });

      if (res.ok && payload?.ok !== false) {
        if (base !== workingApiBase) {
          workingApiBase = base;
          debugApi('base:switched_after_success', { newBase: base, action });
        }
        return payload;
      }

      // Si es 404, probablemente URL incorrecta, seguimos probando otros base.
      if (shouldTryNextBase(res)) {
        continue;
      }

      throw new Error(payload?.error || `Error HTTP ${res.status}`);
    } catch (error) {
      debugApi('request:attempt_failed', {
        ...meta,
        error: error?.message || String(error),
      });
      if (error?.code === 'API_PARSE_ERROR') {
        continue;
      }
      // Solo seguimos con otro base si fue red o timeout.
      if (!/aborted|network|failed|load/i.test(error?.message || '')) {
        throw error;
      }
    }
  }

  const listed = tried.length ? tried : basesToTry.map((base) => withAction(base, action));
  throw new Error(
    `No se pudo conectar al servidor. URLs probadas: ${listed.join(' | ')}. `
    + 'Configura EXPO_PUBLIC_API_URL con la URL exacta de tu backend/api.php y verifica que el servidor PHP esté encendido.'
  );
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

export const __apiDebug = {
  getCandidates: () => [...API_CANDIDATES],
  getWorkingBase: () => workingApiBase,
};
