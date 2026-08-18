import { useState } from 'react';
import { api } from '../api';
import { getServerUrl } from '../config';

export default function Auth({ onAuthenticated, onChangeServer }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = mode === 'login' ? await api.login(username, password) : await api.register(username, password);
      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <h1>Squad</h1>
        <p className="auth-subtitle">Chat e chamada em grupo para o seu time, do seu jeito.</p>

        <label>Usuário</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="seu_usuario" autoFocus />

        <label>Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        {error && <div className="auth-error">{error}</div>}

        <button className="btn-primary auth-submit" type="submit" disabled={loading}>
          {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>

        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        >
          {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </button>

        {onChangeServer && (
          <button type="button" className="auth-server-link" onClick={onChangeServer}>
            Servidor: {getServerUrl().replace(/^https?:\/\//, '')} · trocar
          </button>
        )}
      </form>
    </div>
  );
}
