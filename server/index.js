require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { testConnection } = require('./db');
const authRoutes = require('./routes/auth');
const secretsRoutes = require('./routes/secrets');
const commentsRoutes = require('./routes/comments');

const app = express();
const port = Number(process.env.PORT || 8081);

app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await testConnection();
    res.json({ ok: true, status: 'up', db: 'connected' });
  } catch (error) {
    console.error('GET /health failed:', error);
    res.status(500).json({ ok: false, status: 'down', db: 'error' });
  }
});

app.use('/auth', authRoutes);
app.use('/secrets', secretsRoutes);
app.use('/comments', commentsRoutes);

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada' });
});

app.use((error, _req, res, _next) => {
  console.error('Unhandled server error:', error);
  res.status(500).json({ ok: false, error: 'Error interno del servidor' });
});

app.listen(port, () => {
  console.log(`MiSecreto API listening on http://localhost:${port}`);
});
