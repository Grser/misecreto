// src/lib/api.js
import { sGet, sSet, UK, SK, NK, AK, uid, hashStr, cleanSecrets, checkStorageConnection } from './storage';
import { normalizeUsername } from './validation';

const nowIso = () => new Date().toISOString();
const API_URL = process.env.EXPO_PUBLIC_API_URL || '';
const hasRemote = /^https?:\/\//i.test(API_URL);

const isNetworkError = (error) => {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('failed to fetch') || msg.includes('network request failed');
};

const withRemoteFallback = async (remoteFn, localFn) => {
  if (!hasRemote) return localFn();
  try {
    return await remoteFn();
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    return localFn();
  }
};

const normalizeUsers = (users) => users || {};

const normalizeToken = (token) => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split(':');
  if (parts.length !== 2 || parts[0] !== 'local') return null;
  const id = Number(parts[1]);
  return Number.isFinite(id) ? id : null;
};

const userResponse = (user) => ({
  id: user.id,
  username: user.username,
  is_admin: user.isAdmin ? 1 : 0,
  color: Number.isFinite(user.color) ? user.color : 0,
  country: user.country || 'us',
  nsfwVerified: !!user.nsfwVerified,
});

const apiReq = async (action, { method = 'GET', token, body } = {}) => {
  const url = `${API_URL}${API_URL.includes('?') ? '&' : '?'}action=${encodeURIComponent(action)}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error || 'Error de servidor');
  return json;
};

const getCurrentUserFromToken = async (token) => {
  const userId = normalizeToken(token);
  if (!userId) throw new Error('No autorizado');

  const users = normalizeUsers(await sGet(UK));
  const user = Object.values(users).find((u) => Number(u.id) === userId);
  if (!user) throw new Error('Usuario inválido');

  return user;
};

const localAuth = {
  login: async (username, password) => {
    const clean = normalizeUsername(username);
    const users = normalizeUsers(await sGet(UK));
    const user = users[clean];

    if (!user || user.passwordHash !== hashStr(String(password || ''))) {
      throw new Error('Credenciales inválidas');
    }
    if (user.banned) throw new Error('Tu cuenta está suspendida');

    return { ok: true, token: `local:${user.id}`, user: userResponse(user) };
  },

  register: async (username, password, { color, country } = {}) => {
    const clean = String(username || '').trim().toLowerCase();
    if (clean.length < 3 || String(password || '').length < 4) throw new Error('Datos inválidos');

    const users = normalizeUsers(await sGet(UK));
    if (users[clean]) throw new Error('Usuario ya existe');

    const user = {
      id: Date.now(), username: clean, passwordHash: hashStr(String(password || '')),
      isAdmin: false, color: Number.isFinite(color) ? color : 0, country: country || 'us',
      banned: false, nsfwVerified: false, createdAt: Date.now(),
    };

    users[clean] = user;
    await sSet(UK, users);

    return { ok: true, token: `local:${user.id}`, user: userResponse(user) };
  },

  requestAppeal: async (username, password, reason) => {
    const clean = normalizeUsername(username);
    const users = normalizeUsers(await sGet(UK));
    const user = users[clean];
    if (!user || user.passwordHash !== hashStr(String(password || ''))) {
      throw new Error('Credenciales inválidas');
    }
    if (!user.banned) throw new Error('Tu cuenta no está suspendida');
    const appealReason = String(reason || '').trim();
    if (appealReason.length < 12) throw new Error('Explica el motivo con más detalle');

    const appeals = (await sGet(AK)) || [];
    appeals.unshift({
      id: uid(),
      username: clean,
      reason: appealReason,
      status: 'pendiente',
      createdAt: Date.now(),
    });
    await sSet(AK, appeals);
    return { ok: true };
  },
};

const NSFW_TERMS = [
  'sexo', 'sexual', 'desnuda', 'desnudo', 'desnudos', 'desnudas', 'xxx', 'onlyfans',
  'porn', 'porno', 'fetiche', 'nudes', 'pack', 'hot', 'caliente', 'anal', 'oral',
  'penetr', 'coger', 'follar', 'masturb', 'cum', 'semen', 'tetas', 'pene', 'vagina',
];

const localNsfwScan = async () => {
  const sfw = cleanSecrets(await sGet(SK) || []);
  const nsfw = cleanSecrets(await sGet(NK) || []);
  const all = [...sfw, ...nsfw];

  const classify = (text) => {
    const normalized = String(text || '').toLowerCase();
    const hits = NSFW_TERMS.filter((term) => normalized.includes(term));
    const score = Math.min(1, hits.length * 0.18);
    return { isAdult: hits.length > 0, score, hits };
  };

  const mismatches = all.map((item) => {
    const out = classify(`${item.title || ''} ${item.text || ''}`);
    if (!out.isAdult && item.nsfw) return { ...item, suggested_nsfw: false, aiScore: out.score, aiReasons: ['Poca señal +18'] };
    if (out.isAdult && !item.nsfw) return { ...item, suggested_nsfw: true, aiScore: out.score, aiReasons: out.hits };
    return null;
  }).filter(Boolean);

  return mismatches.map((x) => ({
    id: x.id,
    username: x.author,
    content: x.text,
    title: x.title || 'Secreto',
    nsfw: x.nsfw ? 1 : 0,
    suggested_nsfw: x.suggested_nsfw ? 1 : 0,
    ai_score: Number(x.aiScore || 0),
    ai_reasons: x.aiReasons || [],
  }));
};

const localAdmin = {
  setUserBan: async (token, username, banned) => {
    const actor = await getCurrentUserFromToken(token);
    if (!actor.isAdmin) throw new Error('No autorizado');

    const clean = String(username || '').trim().toLowerCase();
    const users = normalizeUsers(await sGet(UK));
    const target = users[clean];
    if (!target) throw new Error('Usuario no encontrado');

    users[clean] = { ...target, banned: !!banned };
    await sSet(UK, users);
    return { ok: true };
  },

  setUserAdmin: async (token, username, isAdmin) => {
    const actor = await getCurrentUserFromToken(token);
    if (!actor.isAdmin) throw new Error('No autorizado');

    const clean = String(username || '').trim().toLowerCase();
    const users = normalizeUsers(await sGet(UK));
    const target = users[clean];
    if (!target) throw new Error('Usuario no encontrado');

    users[clean] = { ...target, isAdmin: !!isAdmin };
    await sSet(UK, users);
    return { ok: true };
  },

  snapshot: async (token) => {
    const user = await getCurrentUserFromToken(token);
    if (!user.isAdmin) throw new Error('No autorizado');
    return {
      ok: true,
      users: normalizeUsers(await sGet(UK)),
      items: [...cleanSecrets(await sGet(SK) || []), ...cleanSecrets(await sGet(NK) || [])],
      appeals: (await sGet(AK) || []),
    };
  },

  deleteSecret: async (token, id) => {
    const actor = await getCurrentUserFromToken(token);
    if (!actor.isAdmin) throw new Error('No autorizado');
    const n1 = cleanSecrets(await sGet(SK) || []).filter((x) => String(x.id) !== String(id));
    const n2 = cleanSecrets(await sGet(NK) || []).filter((x) => String(x.id) !== String(id));
    await sSet(SK, n1); await sSet(NK, n2);
    return { ok: true };
  },

  scanNsfwMismatch: async (token) => {
    const actor = await getCurrentUserFromToken(token);
    if (!actor.isAdmin) throw new Error('No autorizado');
    return { ok: true, items: await localNsfwScan() };
  },
};

const localSecrets = {
  list: async (token) => {
    const user = await getCurrentUserFromToken(token);
    const sfw = cleanSecrets(await sGet(SK) || []);
    const nsfw = cleanSecrets(await sGet(NK) || []);
    const all = [...sfw, ...nsfw];

    const items = all.slice().sort((a, b) => Number(b.time || 0) - Number(a.time || 0)).map((row) => ({
      id: row.id, title: row.title || 'Secreto', content: row.text || '', nsfw: row.nsfw ? 1 : 0,
      color_idx: Number(row.color || 0), created_at: row.time ? new Date(row.time).toISOString() : nowIso(),
      username: row.author || user.username, likes: Number(row.likes || 0),
    }));

    return { ok: true, user: userResponse(user), items };
  },

  create: async (token, data) => {
    const user = await getCurrentUserFromToken(token);
    const content = String(data?.content || '').trim();
    const title = String(data?.title || 'Secreto').trim() || 'Secreto';
    if (!content) throw new Error('Título y contenido son obligatorios');

    const targetKey = data?.nsfw ? NK : SK;
    const list = cleanSecrets(await sGet(targetKey) || []);
    list.unshift({
      id: uid(), text: content, photo: null, expiresAt: null, durationMinutes: 0, author: user.username,
      color: Number(data?.color_idx || 0), country: 'us', likes: 0, dislikes: 0, views: 0,
      likedBy: [], dislikedBy: [], time: Date.now(), comments: [], nsfw: !!data?.nsfw, title,
    });

    await sSet(targetKey, list);
    return { ok: true };
  },
};

export const authApi = {
  login: async (username, password) => withRemoteFallback(
    () => apiReq('auth.login', { method: 'POST', body: { username, password } }),
    () => localAuth.login(username, password),
  ),

  register: async (username, password, meta = {}) => withRemoteFallback(
    () => apiReq('auth.register', { method: 'POST', body: { username, password, ...meta } }),
    () => localAuth.register(username, password, meta),
  ),

  claimAdmin: async (token, code) => (hasRemote
    ? apiReq('auth.claim_admin', { method: 'POST', token, body: { code } })
    : (() => { throw new Error('Esta función requiere backend compartido'); })()),

  requestAppeal: async (username, password, reason) => withRemoteFallback(
    () => apiReq('auth.request_appeal', { method: 'POST', body: { username, password, reason } }),
    () => localAuth.requestAppeal(username, password, reason),
  ),
};

export const adminApi = {
  setUserBan: async (token, username, banned) => withRemoteFallback(
    () => apiReq('admin.set_user_ban', { method: 'POST', token, body: { username, banned } }),
    () => localAdmin.setUserBan(token, username, banned),
  ),

  setUserAdmin: async (token, username, isAdmin) => withRemoteFallback(
    () => apiReq('admin.set_user_admin', { method: 'POST', token, body: { username, is_admin: isAdmin } }),
    () => localAdmin.setUserAdmin(token, username, isAdmin),
  ),

  snapshot: async (token) => withRemoteFallback(
    () => apiReq('admin.snapshot', { method: 'GET', token }),
    () => localAdmin.snapshot(token),
  ),

  deleteSecret: async (token, id) => withRemoteFallback(
    () => apiReq('admin.delete_secret', { method: 'POST', token, body: { id } }),
    () => localAdmin.deleteSecret(token, id),
  ),

  scanNsfwMismatch: async (token) => withRemoteFallback(
    () => apiReq('admin.scan_nsfw_mismatch', { method: 'GET', token }),
    () => localAdmin.scanNsfwMismatch(token),
  ),
};

export const secretsApi = {
  list: async (token) => withRemoteFallback(
    () => apiReq('secrets.list', { method: 'GET', token }),
    () => localSecrets.list(token),
  ),

  create: async (token, data) => withRemoteFallback(
    () => apiReq('secrets.create', { method: 'POST', token, body: data }),
    () => localSecrets.create(token, data),
  ),
};

export const healthApi = {
  check: async () => {
    return withRemoteFallback(
      () => apiReq('health', { method: 'GET' }),
      async () => {
        const ok = await checkStorageConnection();
        if (!ok) throw new Error('No se pudo conectar a la base local');
        return { ok: true, message: 'Base local conectada' };
      },
    );
  },
};
