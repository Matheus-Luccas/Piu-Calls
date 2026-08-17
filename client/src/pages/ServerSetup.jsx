import { useState } from 'react';
import { setServerUrl } from '../config';

export default function ServerSetup({ onSaved, initialValue = '', title, subtitle, allowCancel, onCancel }) {
  const [value, setValue] = useState(initialValue || '');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!value.trim()) {
      setError('Cole o endereço do servidor.');
      return;
    }
    let url = value.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

    setTesting(true);
    try {
      const res = await fetch(`${url}/api/health`, { credentials: 'include' });
      if (!res.ok) throw new Error('Servidor respondeu com erro.');
    } catch (err) {
      setError(
        'Não consegui conectar nesse endereço. Confira se o link está certo e se o servidor está ligado, ou continue mesmo assim.'
      );
      setTesting(false);
      return;
    }
    setTesting(false);
    setServerUrl(url);
    onSaved(url);
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <h1>{title || 'Conectar ao servidor'}</h1>
        <p className="auth-subtitle">
          {subtitle ||
            'Cole aqui o link do servidor do seu grupo (quem criou o servidor te enviou esse endereço).'}
        </p>

        <label>Endereço do servidor</label>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://meu-squad.onrender.com"
          autoFocus
        />

        {error && <div className="auth-error">{error}</div>}

        <button className="btn-primary auth-submit" type="submit" disabled={testing}>
          {testing ? 'Verificando...' : 'Conectar'}
        </button>

        {allowCancel && (
          <button type="button" className="auth-switch" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </form>
    </div>
  );
}
