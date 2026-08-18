import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPanel({ socket, channel, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getMessages(channel.id).then((data) => {
      if (!cancelled) {
        setMessages(data.messages);
        setLoading(false);
      }
    });

    socket.emit('chat:join', { channelId: channel.id });

    function onMessage(msg) {
      if (msg.channelId !== channel.id) return;
      setMessages((prev) => [...prev, msg]);
    }
    socket.on('chat:message', onMessage);

    return () => {
      cancelled = true;
      socket.emit('chat:leave', { channelId: channel.id });
      socket.off('chat:message', onMessage);
    };
  }, [socket, channel.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function sendMessage(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    socket.emit('chat:message', { channelId: channel.id, content: draft });
    setDraft('');
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">💬 {channel.name}</div>
      <div className="chat-messages">
        {loading && <div className="chat-loading">Carregando mensagens...</div>}
        {!loading && messages.length === 0 && (
          <div className="chat-empty">Nenhuma mensagem ainda. Seja o primeiro a dizer algo!</div>
        )}
        {messages.map((m) => (
          <div className="chat-message" key={m.id}>
            <div className="avatar-circle small" style={{ background: m.avatarColor }}>
              {m.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="chat-message-meta">
                <span className="chat-message-author">{m.username}</span>
                <span className="chat-message-time">{formatTime(m.createdAt)}</span>
              </div>
              <div className="chat-message-content">{m.content}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input-row" onSubmit={sendMessage}>
        <input
          className="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Conversar em #${channel.name}`}
          maxLength={2000}
        />
        <button className="btn-primary" type="submit">
          Enviar
        </button>
      </form>
    </div>
  );
}
