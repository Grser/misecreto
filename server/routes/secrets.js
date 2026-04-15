const express = require('express');
const { pool } = require('../db');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id, s.user_id, u.username, s.title, s.content, s.nsfw, s.color_idx, s.created_at
       FROM secrets s
       INNER JOIN users u ON u.id = s.user_id
       ORDER BY s.created_at DESC`,
    );
    return res.json({ ok: true, secrets: rows });
  } catch (error) {
    console.error('GET /secrets failed:', error);
    return res.status(500).json({ ok: false, error: 'No se pudieron cargar los secretos' });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = Number(req.body?.user_id);
    const title = String(req.body?.title || '').trim();
    const content = String(req.body?.content || '').trim();
    const nsfw = Number(req.body?.nsfw) === 1 ? 1 : 0;
    const colorIdx = Number.isFinite(Number(req.body?.color_idx)) ? Number(req.body.color_idx) : 0;

    if (!userId) {
      return res.status(400).json({ ok: false, error: 'user_id es obligatorio' });
    }
    if (!title) {
      return res.status(400).json({ ok: false, error: 'title es obligatorio' });
    }
    if (!content) {
      return res.status(400).json({ ok: false, error: 'content es obligatorio' });
    }

    const [[owner]] = await pool.query('SELECT id, username FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!owner) {
      return res.status(404).json({ ok: false, error: 'El usuario no existe' });
    }

    const [insert] = await pool.query(
      'INSERT INTO secrets (user_id, title, content, nsfw, color_idx) VALUES (?, ?, ?, ?, ?)',
      [userId, title, content, nsfw, colorIdx],
    );

    const [[created]] = await pool.query(
      `SELECT s.id, s.user_id, u.username, s.title, s.content, s.nsfw, s.color_idx, s.created_at
       FROM secrets s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.id = ?
       LIMIT 1`,
      [insert.insertId],
    );

    return res.status(201).json({ ok: true, secret: created });
  } catch (error) {
    console.error('POST /secrets failed:', error);
    return res.status(500).json({ ok: false, error: 'No se pudo crear el secreto' });
  }
});

module.exports = router;
