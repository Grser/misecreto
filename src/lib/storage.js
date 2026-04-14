import AsyncStorage from '@react-native-async-storage/async-storage';

export const SK  = 'ms-secrets-v8';
export const UK  = 'ms-users-v8';
export const SSK = 'ms-sess-v8';
export const NK  = 'ms-nsfw-v8';

export const sGet = async (k) => {
  try { const v = await AsyncStorage.getItem(k); return v ? JSON.parse(v) : null; }
  catch { return null; }
};

export const sSet = async (k, v) => {
  try { await AsyncStorage.setItem(k, JSON.stringify(v)); } catch {}
};

export const hashStr = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return h.toString(36);
};

export const uid = () => 'id' + Date.now() + Math.random().toString(36).slice(2, 6);
export const rndC = () => Math.floor(Math.random() * 8);

export const timeAgo = (ms) => {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'ahora';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

export const fullDate = (ms) => {
  if (!ms) return '–';
  return new Date(ms).toLocaleDateString('es', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export const cleanSecrets = (arr) =>
  (arr || []).map(s => ({
    ...s,
    comments: (s.comments || []).map(c => ({
      ...c,
      likedBy: c.likedBy || [],
      replies: (c.replies || []).map(r => ({ ...r, likedBy: r.likedBy || [] })),
    })),
  }));

export const checkStorageConnection = async () => {
  const pingKey = '__ms-db-ping__';
  const pingVal = Date.now().toString();
  try {
    await AsyncStorage.setItem(pingKey, pingVal);
    const got = await AsyncStorage.getItem(pingKey);
    await AsyncStorage.removeItem(pingKey);
    return got === pingVal;
  } catch {
    return false;
  }
};
