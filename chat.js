const db = require('../db/database');

function isMember(serverId, userId) {
  return !!db.prepare('SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?').get(serverId, userId);
}

function channelRoom(channelId) {
  return `channel:${channelId}`;
}

function registerChat(io, socket) {
  const userId = socket.handshake.session.userId;

  socket.on('chat:join', ({ channelId }) => {
    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
    if (!channel || channel.type !== 'text' || !isMember(channel.server_id, userId)) return;
    socket.join(channelRoom(channelId));
  });

  socket.on('chat:leave', ({ channelId }) => {
    socket.leave(channelRoom(channelId));
  });

  socket.on('chat:message', ({ channelId, content }) => {
    if (!content || !content.trim()) return;
    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
    if (!channel || channel.type !== 'text' || !isMember(channel.server_id, userId)) return;

    const trimmed = content.trim().slice(0, 2000);
    const now = Date.now();
    const info = db.prepare(
      'INSERT INTO messages (channel_id, user_id, content, created_at) VALUES (?, ?, ?, ?)'
    ).run(channelId, userId, trimmed, now);

    const user = db.prepare('SELECT id, username, avatar_color as avatarColor FROM users WHERE id = ?').get(userId);
    const message = {
      id: info.lastInsertRowid,
      channelId: Number(channelId),
      content: trimmed,
      createdAt: now,
      userId: user.id,
      username: user.username,
      avatarColor: user.avatarColor,
    };
    io.to(channelRoom(channelId)).emit('chat:message', message);
  });
}

module.exports = { registerChat };
