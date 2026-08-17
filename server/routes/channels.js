const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function assertMembership(serverId, userId) {
  return db.prepare('SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?').get(serverId, userId);
}

// Cria canal em um servidor
router.post('/server/:serverId', (req, res) => {
  const { serverId } = req.params;
  const { name, type } = req.body || {};
  if (!assertMembership(serverId, req.session.userId)) {
    return res.status(403).json({ error: 'Você não é membro desse servidor.' });
  }
  if (!name || !name.trim() || !['text', 'voice'].includes(type)) {
    return res.status(400).json({ error: 'Nome e tipo (text|voice) são obrigatórios.' });
  }
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) as m FROM channels WHERE server_id = ? AND type = ?')
    .get(serverId, type).m;
  const info = db.prepare(
    'INSERT INTO channels (server_id, name, type, position, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(serverId, name.trim(), type, maxPos + 1, Date.now());
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(info.lastInsertRowid);
  res.json({ channel });
});

// Lista mensagens de um canal de texto
router.get('/:channelId/messages', (req, res) => {
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.channelId);
  if (!channel) return res.status(404).json({ error: 'Canal não encontrado.' });
  if (!assertMembership(channel.server_id, req.session.userId)) {
    return res.status(403).json({ error: 'Sem acesso a esse canal.' });
  }
  const rows = db.prepare(`
    SELECT msg.id, msg.content, msg.created_at as createdAt,
           u.id as userId, u.username, u.avatar_color as avatarColor
    FROM messages msg
    JOIN users u ON u.id = msg.user_id
    WHERE msg.channel_id = ?
    ORDER BY msg.created_at DESC
    LIMIT 100
  `).all(channel.id);
  rows.reverse();
  res.json({ messages: rows });
});

module.exports = router;
