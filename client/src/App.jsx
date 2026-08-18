import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { connectSocket, disconnectSocket } from './socket';
import { hasServerUrl, getServerUrl } from './config';
import { useVoiceRoom } from './voice/useVoiceRoom';
import Auth from './pages/Auth';
import ServerSetup from './pages/ServerSetup';
import ServerSidebar from './components/ServerSidebar';
import ChannelSidebar from './components/ChannelSidebar';
import ChatPanel from './components/ChatPanel';
import VoicePanel from './components/VoicePanel';
import VoiceCallBar from './components/VoiceCallBar';
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
  const [activeChannel, setActiveChannel] = useState(null); // canal sendo VISTO no momento

  // Canal de voz ao qual a pessoa está realmente CONECTADA — separado de
  // activeChannel de propósito: navegar até um canal de texto pra mandar uma
  // mensagem não pode derrubar a chamada em andamento. voiceServerId guarda
  // de qual servidor é essa chamada, pra dar pra "pular" de volta pra ela
  // mesmo depois de trocar de servidor.
  const [voiceChannel, setVoiceChannel] = useState(null);
  const [voiceServerId, setVoiceServerId] = useState(null);
  const voiceChannelRef = useRef(null);
  useEffect(() => {
    voiceChannelRef.current = voiceChannel;
  }, [voiceChannel]);

  // O hook fica aqui em cima (não dentro de VoicePanel) exatamente para
  // sobreviver a trocas de activeChannel — ele só reage a mudanças em
  // voiceChannel.
  const voice = useVoiceRoom({ socket, channel: voiceChannel, currentUser: user });

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
        // Se estamos aqui porque a pessoa clicou em "voltar pra chamada" e
        // essa chamada é de outro servidor, troca pro canal de voz da
        // chamada assim que os canais desse servidor chegarem.
        const vc = voiceChannelRef.current;
        if (vc && data.channels.some((c) => c.id === vc.id)) return vc;
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

  // Selecionar um canal de TEXTO só troca o que está sendo visto. Selecionar
  // um canal de VOZ também (re)conecta a chamada de voz — é assim que uma
  // pessoa entra/troca de call, mas nunca acontece sozinho ao ler o chat.
  function handleSelectChannel(channel) {
    setActiveChannel(channel);
    if (channel.type === 'voice') {
      setVoiceChannel(channel);
      setVoiceServerId(activeServerId);
    }
  }

  function handleLeaveCall() {
    setActiveChannel((prev) => (voiceChannel && prev?.id === voiceChannel.id ? null : prev));
    setVoiceChannel(null);
    setVoiceServerId(null);
  }

  function handleJumpToCall() {
    if (!voiceChannel) return;
    if (voiceServerId && voiceServerId !== activeServerId) {
      // Troca de servidor primeiro; o efeito de "carrega detalhe do servidor
      // ativo" acima cuida de selecionar o canal de voz assim que os canais
      // desse servidor chegarem.
      setActiveServerId(voiceServerId);
    } else {
      setActiveChannel(voiceChannel);
    }
  }

  function resetAppState() {
    disconnectSocket();
    setUser(null);
    setSocket(null);
    setServers([]);
    setServerDetail(null);
    setActiveServerId(null);
    setActiveChannel(null);
    setVoiceChannel(null);
    setVoiceServerId(null);
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
            onSelectChannel={handleSelectChannel}
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
              <VoicePanel channel={activeChannel} currentUser={user} onLeaveCall={handleLeaveCall} {...voice} />
            )}
            {!activeChannel && <div className="empty-state">Selecione um canal para começar.</div>}
          </div>
          {voiceChannel && activeChannel?.id !== voiceChannel.id && (
            <VoiceCallBar
              channel={voiceChannel}
              micOn={voice.micOn}
              toggleMic={voice.toggleMic}
              onJump={handleJumpToCall}
              onLeave={handleLeaveCall}
            />
          )}
        </>
      ) : (
        <div className="empty-state">
          Você ainda não está em nenhum servidor. Crie um novo ou entre com um código de convite. →
        </div>
      )}
    </div>
  );
}
