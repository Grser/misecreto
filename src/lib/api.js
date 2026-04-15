const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

const ensureBaseUrl = () => {
  if (!API_BASE_URL) {
    throw new Error('Falta EXPO_PUBLIC_API_BASE_URL en .env');
  }
};

const parseJson = async (res) => {
  const payload = await res.json().catch(() => null);
  if (!payload) throw new Error('Respuesta inválida del servidor');
  if (!res.ok || payload.ok === false) {
    throw new Error(payload.error || `HTTP ${res.status}`);
  }
  return payload;
};

const request = async (path, options = {}) => {
  ensureBaseUrl();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  return parseJson(res);
};

export const registerUser = async (payload) => {
  const data = await request('/register.php', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.user;
};

export const loginUser = async (payload) => {
  const data = await request('/login.php', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.user;
};

export const fetchSecrets = async () => {
  const data = await request('/secrets.php');
  return Array.isArray(data.secrets) ? data.secrets : [];
};

export const createSecret = async (payload) => {
  const data = await request('/secrets.php', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.secret;
};

export const fetchComments = async (secretId) => {
  const data = await request(`/comments.php?secret_id=${encodeURIComponent(secretId)}`);
  return Array.isArray(data.comments) ? data.comments : [];
};

export const createComment = async (payload) => {
  const data = await request('/comments.php', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.comment;
};

export const fetchAdminStatus = async (userId) => {
  const data = await request(`/admin-status.php?user_id=${encodeURIComponent(userId)}`);
  return data;
};

export const authApi = {
  login: async (username, password) => {
    const user = await loginUser({ username, password });
    return { ok: true, user, token: `session:${user.id}` };
  },
  register: async (username, password, options = {}) => {
    const user = await registerUser({
      username,
      password,
      admin_code: options.admin_code || '',
    });
    return { ok: true, user, token: `session:${user.id}` };
  },
  claimAdmin: async () => {
    throw new Error('Usa el código admin al registrarte para obtener rol admin.');
  },
  requestAppeal: async () => {
    throw new Error('No implementado en API REST actual');
  },
};

export const secretsApi = {
  list: async () => ({ ok: true, items: await fetchSecrets() }),
  create: async (_token, payload) => ({ ok: true, secret: await createSecret(payload) }),
};

export const adminApi = {
  setUserBan: async () => { throw new Error('Admin API no conectada en este flujo'); },
  setUserAdmin: async () => { throw new Error('Admin API no conectada en este flujo'); },
  snapshot: async () => { throw new Error('Admin API no conectada en este flujo'); },
  deleteSecret: async () => { throw new Error('Admin API no conectada en este flujo'); },
  scanNsfwMismatch: async () => { throw new Error('Admin API no conectada en este flujo'); },
};

export const healthApi = {
  check: async (userId) => {
    if (userId) {
      return fetchAdminStatus(userId);
    }
    return request('/secrets.php');
  },
};
