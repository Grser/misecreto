// src/lib/api.js
import { sGet, sSet, UK, SK, NK, uid, hashStr, cleanSecrets, checkStorageConnection } from './storage';
import { normalizeUsername, validateRegisterInput } from './validation';

const nowIso = () => new Date().toISOString();

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

const getCurrentUserFromToken = async (token) => {
  const userId = normalizeToken(token);
  if (!userId) throw new Error('No autorizado');

  const users = normalizeUsers(await sGet(UK));
  const user = Object.values(users).find((u) => Number(u.id) === userId);
  if (!user) throw new Error('Usuario inválido');

  return user;
};

export const authApi = {
  login: async (username, password) => {
    const clean = normalizeUsername(username);
    const users = normalizeUsers(await sGet(UK));
    const user = users[clean];

    if (!user || user.passwordHash !== hashStr(String(password || ''))) {
      throw new Error('Credenciales inválidas');
    }

    return {
      ok: true,
      token: `local:${user.id}`,
      user: userResponse(user),
    };
  },

  register: async (username, password, { color, country } = {}) => {
    const clean = String(username || '').trim().toLowerCase();
    if (clean.length < 3 || String(password || '').length < 4) {
      throw new Error('Datos inválidos');
    }

    const users = normalizeUsers(await sGet(UK));
    if (users[clean]) {
      throw new Error('Usuario ya existe');
    }

    const user = {
      id: Date.now(),
      username: clean,
      passwordHash: hashStr(String(password || '')),
      isAdmin: false,
      color: Number.isFinite(color) ? color : 0,
      country: country || 'us',
      banned: false,
      nsfwVerified: false,
      createdAt: Date.now(),
    };

    users[clean] = user;
    await sSet(UK, users);

    return {
      ok: true,
      token: `local:${user.id}`,
      user: userResponse(user),
    };
  },

  resetLocalUser: async (username, newPassword) => {
    const clean = String(username || '').trim().toLowerCase();
    const nextPass = String(newPassword || '');
    if (!clean || !nextPass) {
      throw new Error('Datos inválidos');
    }

    const users = normalizeUsers(await sGet(UK));
    const user = users[clean];
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    users[clean] = {
      ...user,
      passwordHash: hashStr(nextPass),
    };
    await sSet(UK, users);

    return { ok: true };
  },

  deleteLocalUser: async (username) => {
    const clean = String(username || '').trim().toLowerCase();
    if (!clean) {
      throw new Error('Datos inválidos');
    }

    const users = normalizeUsers(await sGet(UK));
    if (!users[clean]) {
      throw new Error('Usuario no encontrado');
    }

    delete users[clean];
    await sSet(UK, users);

    return { ok: true };
  },
};

export const secretsApi = {
  list: async (token) => {
    const user = await getCurrentUserFromToken(token);
    const sfw = cleanSecrets(await sGet(SK) || []);
    const nsfw = cleanSecrets(await sGet(NK) || []);
    const all = [...sfw, ...nsfw];

    const items = all
      .slice()
      .sort((a, b) => Number(b.time || 0) - Number(a.time || 0))
      .map((row) => ({
        id: row.id,
        title: row.title || 'Secreto',
        content: row.text || '',
        nsfw: row.nsfw ? 1 : 0,
        color_idx: Number(row.color || 0),
        created_at: row.time ? new Date(row.time).toISOString() : nowIso(),
        username: row.author || user.username,
        likes: Number(row.likes || 0),
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
    const id = uid();

    list.unshift({
      id,
      text: content,
      photo: null,
      expiresAt: null,
      durationMinutes: 0,
      author: user.username,
      color: Number(data?.color_idx || 0),
      country: 'us',
      likes: 0,
      dislikes: 0,
      views: 0,
      likedBy: [],
      dislikedBy: [],
      time: Date.now(),
      comments: [],
      nsfw: !!data?.nsfw,
      title,
    });

    await sSet(targetKey, list);
    return { ok: true, id };
  },
};

export const healthApi = {
  check: async () => {
    const ok = await checkStorageConnection();
    if (!ok) throw new Error('No se pudo conectar a la base local');
    return { ok: true, message: 'Base local conectada' };
  },
};
