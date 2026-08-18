import { useState } from 'react';

export default function ServerSidebar({ servers, activeServerId, onSelect, onCreateServer, onJoinServer }) {
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [value, setValue] = useState('');

  function submit(e) {
    e.preventDefault();
    if (!value.trim()) return;
    if (mode === 'create') onCreateServer(value.trim());
    else if (mode === 'join') onJoinServer(value.trim());
    setValue('');
    setMode(null);
  }

  return (
    <div className="server-sidebar">
      {servers.map((s) => (
        <button
          key={s.id}
          className={`server-icon ${activeServerId === s.id ? 'server-icon-active' : ''}`}
          title={s.name}
          onClick={() => onSelect(s.id)}
        >
          {s.name.slice(0, 2).toUpperCase()}
        </button>
      ))}

      <div className="server-sidebar-divider" />

      <button className="server-icon server-icon-add" title="Criar servidor" onClick={() => setMode('create')}>
        +
      </button>
      <button className="server-icon server-icon-add" title="Entrar com código de convite" onClick={() => setMode('join')}>
        #
      </button>

      {mode && (
        <div className="modal-overlay" onClick={() => setMode(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <h3>{mode === 'create' ? 'Criar novo servidor' : 'Entrar em um servidor'}</h3>
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === 'create' ? 'Nome do servidor' : 'Código de convite'}
            />
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setMode(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary">
                {mode === 'create' ? 'Criar' : 'Entrar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
