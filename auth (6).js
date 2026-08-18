const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');

const router = express.Router();

const COLORS = ['#5865F2', '#EB459E', '#ED4245', '#FEE75C', '#57F287', '#F5A623', '#9B59B6', '#1ABC9C'];

function publicUser(u) {
  return { id: u.id, username: u.username, avatarColor: u.avatar_color };
}

router.post('/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || username.trim().length < 3 || password.length < 4) {
    return res.status(400).json({ error: 'Usuário (min 3 caracteres) e senha (min 4 caracteres) são obrigatórios.' });
  }
  const clean = username.trim();
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(clean);
  if (exists) return res.status(409).json({ error: 'Esse nome de usuário já existe.' });

  const hash = bcrypt.hashSync(password, 10);
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const info = db.prepare(
    'INSERT INTO users (username, password_hash, avatar_color, created_at) VALUES (?, ?, ?, ?)'
  ).run(clean, hash, color, Date.now());

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
  }
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Não autenticado' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Não autenticado' });
  res.json({ user: publicUser(user) });
});

module.exports = router;
