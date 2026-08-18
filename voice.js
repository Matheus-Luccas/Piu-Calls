const db = require('../db/database');

const MAX_PEERS_PER_ROOM = 10;

function isMember(serverId, userId) {
  return !!db.prepare('SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?').get(serverId, userId);
}

function voiceRoom(channelId) {
  return `voice:${channelId}`;
}

function registerVoice(io, socket) {
  const userId = socket.handshake.session.userId;
  const user = db.prepare('SELECT id, username, avatar_color as avatarColor FROM users WHERE id = ?').get(userId);

  // Quais canais de voz este socket está atualmente em
  socket.voiceChannels = socket.voiceChannels || new Set();

  socket.on('voice:join', ({ channelId }, ack) => {
    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
    if (!channel || channel.type !== 'voice' || !isMember(channel.server_id, userId)) {
      if (ack) ack({ error: 'Sem acesso a esse canal de voz.' });
      return;
    }
    const room = voiceRoom(channelId);
    const roomSockets = io.sockets.adapter.rooms.get(room);
    const currentSize = roomSockets ? roomSockets.size : 0;
    if (currentSize >= MAX_PEERS_PER_ROOM) {
      if (ack) ack({ error: `Sala cheia (máximo ${MAX_PEERS_PER_ROOM} pessoas).` });
      return;
    }

    // Lista de peers já presentes, para o recém-chegado criar conexões
    const existingPeers = [];
    if (roomSockets) {
      for (const sid of roomSockets) {
        const s = io.sockets.sockets.get(sid);
        if (s) existingPeers.push({ socketId: sid, user: s.voiceUser || null });
      }
    }

    socket.voiceUser = user;
    socket.join(room);
    socket.voiceChannels.add(String(channelId));

    socket.to(room).emit('voice:peer-joined', { socketId: socket.id, user });
    if (ack) ack({ peers: existingPeers, self: { socketId: socket.id, user } });
  });

  socket.on('voice:leave', ({ channelId }) => {
    const room = voiceRoom(channelId);
    socket.leave(room);
    socket.voiceChannels.delete(String(channelId));
    socket.to(room).emit('voice:peer-left', { socketId: socket.id });
  });

  // Relay de sinalização WebRTC (offer/answer/ice candidates) ponto a ponto
  socket.on('voice:signal', ({ to, data }) => {
    if (!to) return;
    io.to(to).emit('voice:signal', { from: socket.id, data });
  });

  // Estado de mídia (mudo, câmera, compartilhamento de tela) para refletir na UI dos outros
  socket.on('voice:state', ({ channelId, state }) => {
    const room = voiceRoom(channelId);
    socket.to(room).emit('voice:state', { socketId: socket.id, state });
  });

  socket.on('disconnect', () => {
    for (const channelId of socket.voiceChannels) {
      socket.to(voiceRoom(channelId)).emit('voice:peer-left', { socketId: socket.id });
    }
  });
}

module.exports = { registerVoice, MAX_PEERS_PER_ROOM };
