import { getServerUrl } from './config';

async function request(path, options = {}) {
  const res = await fetch(`${getServerUrl()}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    throw new Error(data?.error || `Erro ${res.status}`);
  }
  return data;
}

export const api = {
  me: () => request('/api/auth/me'),
  register: (username, password) =>
    request('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }),
  login: (username, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),

  listServers: () => request('/api/servers'),
  createServer: (name) => request('/api/servers', { method: 'POST', body: JSON.stringify({ name }) }),
  joinServer: (inviteCode) => request('/api/servers/join', { method: 'POST', body: JSON.stringify({ inviteCode }) }),
  getServer: (id) => request(`/api/servers/${id}`),

  createChannel: (serverId, name, type) =>
    request(`/api/channels/server/${serverId}`, { method: 'POST', body: JSON.stringify({ name, type }) }),
  getMessages: (channelId) => request(`/api/channels/${channelId}/messages`),
};
