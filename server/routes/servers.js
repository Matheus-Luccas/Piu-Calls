const express = require('express');
const crypto = require('crypto');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function genInviteCode() {
  return crypto.randomBytes(4).toString('hex');
}

function serverForUser(serverId, userId) {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  if (!server) return null;
  const member = db.prepare('SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?').get(serverId, userId);
  if (!member) return null;
  return server;
}

// Lista servidores do usuário logado
router.get('/', (req, res) => {
  const servers = db.prepare(`
    SELECT s.* FROM servers s
    JOIN server_members m ON m.server_id = s.id
    WHERE m.user_id = ?
    ORDER BY s.created_at ASC
  `).all(req.session.userId);
  res.json({ servers });
});

// Cria um novo servidor (e canais padrão)
router.post('/', (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nome do servidor é obrigatório.' });

  const inviteCode = genInviteCode();
  const now = Date.now();
  const info = db.prepare(
    'INSERT INTO servers (name, invite_code, owner_id, created_at) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), inviteCode, req.session.userId, now);
  const serverId = info.lastInsertRowid;

  db.prepare('INSERT INTO server_members (server_id, user_id, joined_at) VALUES (?, ?, ?)')
    .run(serverId, req.session.userId, now);

  db.prepare('INSERT INTO channels (server_id, name, type, position, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(serverId, 'geral', 'text', 0, now);
  db.prepare('INSERT INTO channels (server_id, name, type, position, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(serverId, 'Sala de Voz', 'voice', 1, now);

  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  res.json({ server });
});

// Entrar em um servidor via código de convite
router.post('/join', (req, res) => {
  const { inviteCode } = req.body || {};
  if (!inviteCode) return res.status(400).json({ error: 'Código de convite é obrigatório.' });

  const server = db.prepare('SELECT * FROM servers WHERE invite_code = ?').get(inviteCode.trim());
  if (!server) return res.status(404).json({ error: 'Servidor não encontrado para esse código.' });

  const already = db.prepare('SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?')
    .get(server.id, req.session.userId);
  if (!already) {
    db.prepare('INSERT INTO server_members (server_id, user_id, joined_at) VALUES (?, ?, ?)')
      .run(server.id, req.session.userId, Date.now());
  }
  res.json({ server });
});

// Detalhe do servidor: canais + membros
router.get('/:id', (req, res) => {
  const server = serverForUser(req.params.id, req.session.userId);
  if (!server) return res.status(404).json({ error: 'Servidor não encontrado ou sem acesso.' });

  const channels = db.prepare('SELECT * FROM channels WHERE server_id = ? ORDER BY type, position, id')
    .all(server.id);
  const members = db.prepare(`
    SELECT u.id, u.username, u.avatar_color as avatarColor FROM users u
    JOIN server_members m ON m.user_id = u.id
    WHERE m.server_id = ?
  `).all(server.id);

  res.json({ server, channels, members });
});

module.exports = router;
