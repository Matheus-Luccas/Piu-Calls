import { useEffect, useState } from 'react';
import { api } from './api';
import { connectSocket, disconnectSocket } from './socket';
import { hasServerUrl, getServerUrl } from './config';
import Auth from './pages/Auth';
import ServerSetup from './pages/ServerSetup';
import ServerSidebar from './components/ServerSidebar';
import ChannelSidebar from './components/ChannelSidebar';
import ChatPanel from './components/ChatPanel';
import VoicePanel from './components/VoicePanel';
import UpdateBanner from './components/UpdateBanner';

export default function App() {
  const [serverConfigured, setServerConfigured] = useState(hasServerUrl());
  const [showServerSettings, setShowServerSettings] = useState(false);

  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [socket, setSocket] = useState(null);

  const [servers, setServers] = useState([]);
  const [activeServerId, setActiveServerId] = useState(null);
  const [serverDetail, setServerDetail] = useState(null); // { server, channels, members }
  const [activeChannel, setActiveChannel] = useState(null);

  // Verifica sessão existente ao carregar (só depois que o servidor está configurado)
  useEffect(() => {
    if (!serverConfigured) return;
    setCheckingSession(true);
    api
      .me()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));
  }, [serverConfigured]);

  // Conecta o socket assim que autenticado
  useEffect(() => {
    if (!user) return;
    const s = connectSocket();
    setSocket(s);
    return () => disconnectSocket();
  }, [user]);

  // Carrega lista de servidores (guilds)
  useEffect(() => {
    if (!user) return;
    api.listServers().then((data) => {
      setServers(data.servers);
      if (data.servers.length > 0) setActiveServerId((prev) => prev ?? data.servers[0].id);
    });
  }, [user]);

  // Carrega detalhe do servidor ativo
  useEffect(() => {
    if (!activeServerId) return;
    api.getServer(activeServerId).then((data) => {
      setServerDetail(data);
      setActiveChannel((prev) => {
        if (prev && data.channels.some((c) => c.id === prev.id)) return prev;
        return data.channels.find((c) => c.type === 'text') || data.channels[0] || null;
      });
    });
  }, [activeServerId]);

  async function handleCreateServer(name) {
    try {
      const data = await api.createServer(name);
      const list = await api.listServers();
      setServers(list.servers);
      setActiveServerId(data.server.id);
    } catch (err) {
      alert('Não foi possível criar o servidor: ' + err.message);
    }
  }

  async function handleJoinServer(inviteCode) {
    try {
      const data = await api.joinServer(inviteCode);
      const list = await api.listServers();
      setServers(list.servers);
      setActiveServerId(data.server.id);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleCreateChannel(name, type) {
    await api.createChannel(activeServerId, name, type);
    const data = await api.getServer(activeServerId);
    setServerDetail(data);
  }

  function resetAppState() {
    disconnectSocket();
    setUser(null);
    setSocket(null);
    setServers([]);
    setServerDetail(null);
    setActiveServerId(null);
    setActiveChannel(null);
  }

  async function handleLogout() {
    await api.logout();
    resetAppState();
  }

  function handleServerUrlChanged() {
    resetAppState();
    setShowServerSettings(false);
    setServerConfigured(true);
  }

  if (!serverConfigured) {
    return (
      <>
        <UpdateBanner />
        <ServerSetup onSaved={() => setServerConfigured(true)} />
      </>
    );
  }

  if (showServerSettings) {
    return (
      <>
        <UpdateBanner />
        <ServerSetup
          title="Trocar servidor"
          subtitle="Isso vai te desconectar do servidor atual."
          initialValue={getServerUrl()}
          allowCancel
          onCancel={() => setShowServerSettings(false)}
          onSaved={handleServerUrlChanged}
        />
      </>
    );
  }

  if (checkingSession) {
    return (
      <>
        <UpdateBanner />
        <div className="loading-screen">Carregando...</div>
      </>
    );
  }
  if (!user) {
    return (
      <>
        <UpdateBanner />
        <Auth onAuthenticated={setUser} onChangeServer={() => setShowServerSettings(true)} />
      </>
    );
  }
  if (!socket) {
    return (
      <>
        <UpdateBanner />
        <div className="loading-screen">Conectando...</div>
      </>
    );
  }

  return (
    <div className="app-shell">
      <UpdateBanner />
      <ServerSidebar
        servers={servers}
        activeServerId={activeServerId}
        onSelect={setActiveServerId}
        onCreateServer={handleCreateServer}
        onJoinServer={handleJoinServer}
      />

      {serverDetail ? (
        <>
          <ChannelSidebar
            server={serverDetail.server}
            channels={serverDetail.channels}
            members={serverDetail.members}
            activeChannel={activeChannel}
            onSelectChannel={setActiveChannel}
            onCreateChannel={handleCreateChannel}
            currentUser={user}
            onLogout={handleLogout}
            onChangeServer={() => setShowServerSettings(true)}
          />
          <div className="main-panel">
            {activeChannel?.type === 'text' && (
              <ChatPanel socket={socket} channel={activeChannel} currentUser={user} />
            )}
            {activeChannel?.type === 'voice' && (
              <VoicePanel
                socket={socket}
                channel={activeChannel}
                currentUser={user}
                onLeaveCall={() => setActiveChannel(null)}
              />
            )}
            {!activeChannel && <div className="empty-state">Selecione um canal para começar.</div>}
          </div>
        </>
      ) : (
        <div className="empty-state">
          Você ainda não está em nenhum servidor. Crie um novo ou entre com um código de convite. →
        </div>
      )}
    </div>
  );
}
