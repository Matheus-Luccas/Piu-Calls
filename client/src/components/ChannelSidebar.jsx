import { useState } from 'react';

export default function ChannelSidebar({ server, channels, members, activeChannel, onSelectChannel, onCreateChannel, currentUser, onLogout, onChangeServer }) {
  const [creating, setCreating] = useState(null); // 'text' | 'voice' | null
  const [name, setName] = useState('');

  const textChannels = channels.filter((c) => c.type === 'text');
  const voiceChannels = channels.filter((c) => c.type === 'voice');

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateChannel(name.trim(), creating);
    setName('');
    setCreating(null);
  }

  return (
    <div className="channel-sidebar">
      <div className="channel-sidebar-header">
        <div className="server-title">{server.name}</div>
        <div className="invite-code" title="Compartilhe este código para outros entrarem">
          Convite: <code>{server.invite_code}</code>
        </div>
      </div>

      <div className="channel-section">
        <div className="channel-section-title">
          <span>CANAIS DE TEXTO</span>
          <button className="channel-add-btn" onClick={() => setCreating('text')}>
            +
          </button>
        </div>
        {textChannels.map((c) => (
          <button
            key={c.id}
            className={`channel-item ${activeChannel?.id === c.id ? 'channel-item-active' : ''}`}
            onClick={() => onSelectChannel(c)}
          >
            # {c.name}
          </button>
        ))}
      </div>

      <div className="channel-section">
        <div className="channel-section-title">
          <span>CANAIS DE VOZ</span>
          <button className="channel-add-btn" onClick={() => setCreating('voice')}>
            +
          </button>
        </div>
        {voiceChannels.map((c) => (
          <button
            key={c.id}
            className={`channel-item ${activeChannel?.id === c.id ? 'channel-item-active' : ''}`}
            onClick={() => onSelectChannel(c)}
          >
            🔊 {c.name}
          </button>
        ))}
      </div>

      <div className="member-list">
        <div className="channel-section-title">
          <span>MEMBROS — {members.length}</span>
        </div>
        {members.map((m) => (
          <div key={m.id} className="member-item">
            <div className="avatar-circle small" style={{ background: m.avatarColor }}>
              {m.username[0]?.toUpperCase()}
            </div>
            {m.username}
          </div>
        ))}
      </div>

      <div className="current-user-bar">
        <div className="avatar-circle small" style={{ background: currentUser.avatarColor }}>
          {currentUser.username[0]?.toUpperCase()}
        </div>
        <span>{currentUser.username}</span>
        {onChangeServer && (
          <button className="btn-secondary logout-btn" onClick={onChangeServer} title="Trocar servidor">
            ⚙
          </button>
        )}
        <button className="btn-secondary logout-btn" onClick={onLogout}>
          Sair
        </button>
      </div>

      {creating && (
        <div className="modal-overlay" onClick={() => setCreating(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <h3>Criar canal de {creating === 'text' ? 'texto' : 'voz'}</h3>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do canal" />
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setCreating(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary">
                Criar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
