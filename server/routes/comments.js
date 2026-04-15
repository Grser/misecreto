const express = require('express');
const { pool } = require('../db');

const router = express.Router();

router.get('/:secretId', async (req, res) => {
  try {
    const secretId = Number(req.params.secretId);
    if (!secretId) {
      return res.status(400).json({ ok: false, error: 'secretId inválido' });
    }

    const [rows] = await pool.query(
      `SELECT c.id, c.secret_id, c.user_id, u.username, c.parent_id, c.content, c.created_at
       FROM comments c
       INNER JOIN users u ON u.id = c.user_id
       WHERE c.secret_id = ?
       ORDER BY c.created_at ASC`,
      [secretId],
    );

    return res.json({ ok: true, comments: rows });
  } catch (error) {
    console.error('GET /comments/:secretId failed:', error);
    return res.status(500).json({ ok: false, error: 'No se pudieron cargar los comentarios' });
  }
});

router.post('/', async (req, res) => {
  try {
    const secretId = Number(req.body?.secret_id);
    const userId = Number(req.body?.user_id);
    const parentIdRaw = req.body?.parent_id;
    const parentId = parentIdRaw === null || parentIdRaw === undefined || parentIdRaw === ''
      ? null
      : Number(parentIdRaw);
    const content = String(req.body?.content || '').trim();

    if (!secretId) {
      return res.status(400).json({ ok: false, error: 'secret_id es obligatorio' });
    }
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'user_id es obligatorio' });
    }
    if (!content) {
      return res.status(400).json({ ok: false, error: 'content es obligatorio' });
    }

    const [[secret]] = await pool.query('SELECT id FROM secrets WHERE id = ? LIMIT 1', [secretId]);
    if (!secret) {
      return res.status(404).json({ ok: false, error: 'El secreto no existe' });
    }

    const [[user]] = await pool.query('SELECT id FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'El usuario no existe' });
    }

    if (parentId !== null) {
      const [[parent]] = await pool.query(
        'SELECT id FROM comments WHERE id = ? AND secret_id = ? LIMIT 1',
        [parentId, secretId],
      );
      if (!parent) {
        return res.status(404).json({ ok: false, error: 'parent_id no existe en este secreto' });
      }
    }

    const [insert] = await pool.query(
      'INSERT INTO comments (secret_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)',
      [secretId, userId, parentId, content],
    );

    const [[created]] = await pool.query(
      `SELECT c.id, c.secret_id, c.user_id, u.username, c.parent_id, c.content, c.created_at
       FROM comments c
       INNER JOIN users u ON u.id = c.user_id
       WHERE c.id = ?
       LIMIT 1`,
      [insert.insertId],
    );

    return res.status(201).json({ ok: true, comment: created });
  } catch (error) {
    console.error('POST /comments failed:', error);
    return res.status(500).json({ ok: false, error: 'No se pudo crear el comentario' });
  }
});

module.exports = router;
