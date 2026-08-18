import { io } from 'socket.io-client';
import { getServerUrl } from './config';

let socket = null;

// Cria (ou reutiliza) a conexão de socket autenticada por sessão (cookie).
// Deve ser chamado somente após o login, pois o servidor rejeita sockets sem sessão.
export function connectSocket() {
  if (socket && socket.connected) return socket;
  socket = io(getServerUrl(), {
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
