const express = require('express');
const crypto = require('crypto');
const { promisify } = require('util');
const { pool } = require('../db');

const router = express.Router();
const scryptAsync = promisify(crypto.scrypt);
const ADMIN_CODE = process.env.ADMIN_CODE || 'KGjmwQh2R9';

const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${Buffer.from(derived).toString('hex')}`;
};

const verifyPassword = async (password, passwordHash) => {
  const [salt, hashHex] = String(passwordHash || '').split(':');
  if (!salt || !hashHex) return false;

  const hashedBuffer = Buffer.from(hashHex, 'hex');
  const derived = await scryptAsync(password, salt, hashedBuffer.length);
  return crypto.timingSafeEqual(hashedBuffer, Buffer.from(derived));
};

const normalizeUsername = (value) => String(value || '').trim().toLowerCase();

router.post('/register', async (req, res) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || '');
    const adminCode = String(req.body?.admin_code || '');

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      return res.status(400).json({ ok: false, error: 'Usuario inválido (3-24, letras/números/_)' });
    }
    if (password.length < 8) {
      return res.status(400).json({ ok: false, error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const [[existing]] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
    if (existing) {
      return res.status(409).json({ ok: false, error: 'Ese usuario ya existe' });
    }

    const passwordHash = await hashPassword(password);
    const isAdmin = adminCode === ADMIN_CODE ? 1 : 0;

    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)',
      [username, passwordHash, isAdmin],
    );

    const [[created]] = await pool.query(
      'SELECT id, username, is_admin, created_at FROM users WHERE id = ? LIMIT 1',
      [result.insertId],
    );

    return res.status(201).json({ ok: true, user: created });
  } catch (error) {
    console.error('POST /auth/register failed:', error);
    return res.status(500).json({ ok: false, error: 'No se pudo registrar el usuario' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'Usuario y contraseña son obligatorios' });
    }

    const [[user]] = await pool.query(
      'SELECT id, username, is_admin, created_at, password_hash FROM users WHERE username = ? LIMIT 1',
      [username],
    );

    if (!user) {
      return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
    }

    return res.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('POST /auth/login failed:', error);
    return res.status(500).json({ ok: false, error: 'No se pudo iniciar sesión' });
  }
});

module.exports = router;
