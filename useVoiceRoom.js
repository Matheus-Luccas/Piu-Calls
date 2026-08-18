import { useCallback, useEffect, useRef, useState } from 'react';
import { getDevicePrefs } from '../config';
import { api } from '../api';

// Tenta abrir o dispositivo escolhido nas configurações; se ele não existir mais
// (foi desconectado, por exemplo), cai de volta pro padrão do sistema em vez de falhar.
async function getUserMediaWithFallback(constraintKey, deviceId) {
  if (deviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({ [constraintKey]: { deviceId: { exact: deviceId } } });
    } catch {
      // segue para o padrão do sistema
    }
  }
  return navigator.mediaDevices.getUserMedia({ [constraintKey]: true });
}

// STUN público do Google — suficiente para testes na mesma rede / redes "abertas".
// Para chamadas confiáveis entre redes diferentes (NAT simétrico, 4G etc.) em produção,
// normalmente é necessário também um servidor TURN (ex.: coturn próprio ou um serviço
// como metered.ca / Twilio). Veja o README. Esse valor é só o "fallback" inicial —
// assim que o app conecta, ele busca a lista real (que pode incluir TURN, se
// configurado no servidor) em getIceServers().
const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

// Guarda em cache (por sessão do app) a lista vinda do servidor, pra não
// precisar buscar de novo a cada pessoa que entra/sai da chamada.
let iceServersCache = null;
async function getIceServers() {
  if (iceServersCache) return iceServersCache;
  try {
    const { iceServers } = await api.iceServers();
    iceServersCache = iceServers?.length ? iceServers : DEFAULT_ICE_SERVERS;
  } catch {
    iceServersCache = DEFAULT_ICE_SERVERS;
  }
  return iceServersCache;
}

// Hook que gerencia uma sala de voz/vídeo em grupo via WebRTC "mesh" (cada participante
// conecta diretamente com todos os outros). Funciona bem até ~10-12 pessoas, que é o
// limite configurado no servidor para esta sala.
export function useVoiceRoom({ socket, channel, currentUser }) {
  const [peers, setPeers] = useState({}); // socketId -> { user, stream, micOn, camOn, screenOn }
  const [micOn, setMicOn] = useState(true);
  const [videoMode, setVideoMode] = useState('none'); // 'none' | 'camera' | 'screen'
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState(null);

  const pcsRef = useRef(new Map()); // socketId -> { pc, isPolite, makingOffer, ignoreOffer, remoteStream }
  const iceServersRef = useRef(DEFAULT_ICE_SERVERS);
  const localAudioTrackRef = useRef(null);
  const localVideoTrackRef = useRef(null);
  const localStreamRef = useRef(new MediaStream());
  const [localStreamVersion, setLocalStreamVersion] = useState(0);

  const bumpPeers = useCallback(() => {
    setPeers((prev) => ({ ...prev }));
  }, []);

  const closePeer = useCallback((socketId) => {
    const entry = pcsRef.current.get(socketId);
    if (entry) {
      entry.pc.close();
      pcsRef.current.delete(socketId);
    }
    setPeers((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
  }, []);

  // Garante que os remetentes (senders) de áudio/vídeo dessa conexão estejam
  // levando exatamente a track local que deveriam levar agora. Isso existe por
  // causa de duas situações reais que aconteceram: (1) numa corrida de
  // negociação (alguém entrando bem na hora em que outra pessoa já está com
  // câmera/tela ligada), o navegador às vezes descarta silenciosamente o
  // remetente da track; (2) sem isso, era fácil um remetente ficar "desalinhado"
  // do que o app pensa que deveria estar enviando. Comparar e corrigir com
  // replaceTrack (em vez de addTrack) não exige renegociação nenhuma.
  function ensureLocalTracksAttached(entry) {
    if (entry.audioSender && entry.audioSender.track !== localAudioTrackRef.current) {
      entry.audioSender.replaceTrack(localAudioTrackRef.current).catch((err) => {
        console.error('Erro ao reanexar áudio local:', err);
      });
    }
    if (entry.videoSender && entry.videoSender.track !== localVideoTrackRef.current) {
      entry.videoSender.replaceTrack(localVideoTrackRef.current).catch((err) => {
        console.error('Erro ao reanexar vídeo local:', err);
      });
    }
  }

  const createPeerConnection = useCallback((socketId, remoteUser, isPolite) => {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    const remoteStream = new MediaStream();

    // Cria os dois "canos" (transceivers) de áudio e vídeo já na largada, fixos
    // pra vida toda dessa conexão, em vez de ir chamando addTrack/removeTrack
    // aos poucos conforme a pessoa liga e desliga câmera/tela. Isso resolve um
    // bug real: ao trocar de câmera pra tela (ou vice-versa) com addTrack +
    // removeTrack, o Chrome às vezes não deixava claro pro outro lado que a
    // track antiga tinha acabado — o elemento de vídeo de quem recebia ficava
    // "grudado" mostrando a track velha (preta, já sem dados chegando) em vez da
    // nova. Com um único transceiver de vídeo fixo, trocar de fonte é só um
    // replaceTrack() — sem renegociação, sem ambiguidade de qual track é a atual.
    const audioTransceiver = pc.addTransceiver(localAudioTrackRef.current, {
      direction: 'sendrecv',
      streams: [localStreamRef.current],
    });
    const videoTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
    if (localVideoTrackRef.current) {
      videoTransceiver.sender.replaceTrack(localVideoTrackRef.current).catch(() => {});
    }

    const entry = {
      pc,
      isPolite,
      makingOffer: false,
      ignoreOffer: false,
      remoteStream,
      audioSender: audioTransceiver.sender,
      videoSender: videoTransceiver.sender,
    };
    pcsRef.current.set(socketId, entry);

    pc.onnegotiationneeded = async () => {
      try {
        entry.makingOffer = true;
        await pc.setLocalDescription();
        socket.emit('voice:signal', { to: socketId, data: { description: pc.localDescription } });
      } catch (err) {
        console.error('Erro ao negociar conexão de voz:', err);
      } finally {
        entry.makingOffer = false;
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit('voice:signal', { to: socketId, data: { candidate } });
    };

    pc.ontrack = (event) => {
      const track = event.track;
      // O transceiver de vídeo existe desde o início mesmo quando a outra
      // pessoa não está com câmera/tela ligada — nesse caso a track chega
      // "muted" (sem dados). Só mostramos a track quando ela realmente estiver
      // ativa, e tiramos assim que ela silenciar de novo (ex.: desligou a
      // câmera) — assim o quadradinho volta a mostrar o avatar corretamente
      // em vez de um vídeo preto/congelado.
      function sync() {
        if (track.muted) {
          remoteStream.removeTrack(track);
        } else if (!remoteStream.getTracks().includes(track)) {
          remoteStream.addTrack(track);
        }
        bumpPeers();
      }
      track.onunmute = sync;
      track.onmute = sync;
      track.onended = () => {
        remoteStream.removeTrack(track);
        bumpPeers();
      };
      sync();
    };

    pc.onsignalingstatechange = () => {
      if (pc.signalingState === 'stable') ensureLocalTracksAttached(entry);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        // Tenta recuperar a conexão sozinha (ex.: instabilidade momentânea de
        // rede) em vez de deixar a chamada muda/preta pro resto da sessão.
        try {
          pc.restartIce();
        } catch (err) {
          console.error('Erro ao tentar restabelecer conexão de voz:', err);
        }
      }
      // 'closed'/'disconnected': deixa o evento voice:peer-left do servidor
      // cuidar da limpeza principal; aqui só evitamos travar em estado de erro.
    };

    setPeers((prev) => ({
      ...prev,
      [socketId]: { user: remoteUser, stream: remoteStream, micOn: true, camOn: false, screenOn: false },
    }));

    return entry;
  }, [socket, bumpPeers]);

  // Entrar na sala de voz
  useEffect(() => {
    if (!socket || !channel) return;
    let cancelled = false;
    // Marca que já fizemos o primeiro voice:join, pra diferenciar o 'connect'
    // inicial do socket (que 'join()' abaixo já trata) de uma reconexão de
    // verdade mais tarde (ver onSocketReconnect).
    let hasJoinedOnce = false;

    function joinRoom() {
      socket.emit('voice:join', { channelId: channel.id }, (res) => {
        if (cancelled) return;
        if (res?.error) {
          setError(res.error);
          return;
        }
        hasJoinedOnce = true;
        setJoined(true);
        for (const peer of res.peers) {
          const isPolite = socket.id < peer.socketId;
          createPeerConnection(peer.socketId, peer.user, isPolite);
        }
      });
    }

    async function join() {
      try {
        iceServersRef.current = await getIceServers();
        const { micId } = getDevicePrefs();
        const audioStream = await getUserMediaWithFallback('audio', micId);
        if (cancelled) {
          audioStream.getTracks().forEach((t) => t.stop());
          return;
        }
        const audioTrack = audioStream.getAudioTracks()[0];
        localAudioTrackRef.current = audioTrack;
        localStreamRef.current.addTrack(audioTrack);
        setLocalStreamVersion((v) => v + 1);

        joinRoom();
      } catch (err) {
        setError('Não foi possível acessar o microfone: ' + err.message);
      }
    }

    join();

    // Se a conexão com o servidor cair (Wi-Fi/rede oscilando, deploy no
    // Render, etc.) o socket.io reconecta sozinho, mas com um id novo — e o
    // servidor já tinha avisado todo mundo que essa pessoa "saiu" da sala
    // assim que a queda aconteceu (ver o handler de 'disconnect' em
    // server/socket/voice.js). Sem isto, a chamada ficava muda pra sempre
    // depois de uma queda de rede breve, até a pessoa clicar de novo no
    // canal. Aqui a gente refaz as conexões automaticamente assim que a
    // conexão volta.
    function onSocketReconnect() {
      if (cancelled || !hasJoinedOnce) return;
      for (const [, entry] of pcsRef.current) entry.pc.close();
      pcsRef.current.clear();
      setPeers({});
      setJoined(false);
      joinRoom();
    }
    socket.on('connect', onSocketReconnect);

    function onPeerJoined({ socketId, user }) {
      const isPolite = socket.id < socketId;
      createPeerConnection(socketId, user, isPolite);
    }

    function onPeerLeft({ socketId }) {
      closePeer(socketId);
    }

    async function onSignal({ from, data }) {
      let entry = pcsRef.current.get(from);
      if (!entry) return;
      const { pc } = entry;
      try {
        if (data.description) {
          const offerCollision =
            data.description.type === 'offer' && (entry.makingOffer || pc.signalingState !== 'stable');
          entry.ignoreOffer = !entry.isPolite && offerCollision;
          if (entry.ignoreOffer) return;

          await pc.setRemoteDescription(data.description);
          // Se essa descrição causou um rollback implícito do nosso lado (corrida
          // de negociação), reanexa qualquer track local que tenha ficado sem
          // remetente antes de responder — veja ensureLocalTracksAttached acima.
          ensureLocalTracksAttached(entry);
          if (data.description.type === 'offer') {
            await pc.setLocalDescription();
            socket.emit('voice:signal', { to: from, data: { description: pc.localDescription } });
          }
        } else if (data.candidate) {
          try {
            await pc.addIceCandidate(data.candidate);
          } catch (err) {
            if (!entry.ignoreOffer) console.error('Erro ao adicionar ICE candidate:', err);
          }
        }
      } catch (err) {
        console.error('Erro de sinalização WebRTC:', err);
      }
    }

    function onState({ socketId, state }) {
      setPeers((prev) => {
        if (!prev[socketId]) return prev;
        return { ...prev, [socketId]: { ...prev[socketId], ...state } };
      });
    }

    socket.on('voice:peer-joined', onPeerJoined);
    socket.on('voice:peer-left', onPeerLeft);
    socket.on('voice:signal', onSignal);
    socket.on('voice:state', onState);

    return () => {
      cancelled = true;
      socket.off('connect', onSocketReconnect);
      socket.off('voice:peer-joined', onPeerJoined);
      socket.off('voice:peer-left', onPeerLeft);
      socket.off('voice:signal', onSignal);
      socket.off('voice:state', onState);

      socket.emit('voice:leave', { channelId: channel.id });
      for (const [, entry] of pcsRef.current) entry.pc.close();
      pcsRef.current.clear();
      for (const track of localStreamRef.current.getTracks()) track.stop();
      localStreamRef.current = new MediaStream();
      localAudioTrackRef.current = null;
      localVideoTrackRef.current = null;
      setPeers({});
      setJoined(false);
      setVideoMode('none');
      setMicOn(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, channel?.id]);

  const broadcastState = useCallback(
    (partial) => {
      if (!channel) return;
      socket.emit('voice:state', { channelId: channel.id, state: partial });
    },
    [socket, channel]
  );

  const toggleMic = useCallback(() => {
    setMicOn((prev) => {
      const next = !prev;
      if (localAudioTrackRef.current) localAudioTrackRef.current.enabled = next;
      broadcastState({ micOn: next });
      return next;
    });
  }, [broadcastState]);

  const replaceVideoTrack = useCallback(
    async (newTrack) => {
      // Troca a track de vídeo local (câmera <-> tela <-> nenhuma) usando
      // replaceTrack no transceiver fixo de cada conexão — não precisa
      // renegociar nada, e evita a ambiguidade de identidade de track que
      // causava vídeo preto do lado de quem recebia (veja o comentário em
      // createPeerConnection).
      const old = localVideoTrackRef.current;
      if (old) {
        localStreamRef.current.removeTrack(old);
        old.stop();
      }
      localVideoTrackRef.current = newTrack || null;
      if (newTrack) localStreamRef.current.addTrack(newTrack);

      for (const [, entry] of pcsRef.current) {
        if (!entry.videoSender) continue;
        try {
          await entry.videoSender.replaceTrack(newTrack || null);
        } catch (err) {
          console.error('Erro ao trocar vídeo enviado:', err);
        }
      }
      setLocalStreamVersion((v) => v + 1);
    },
    []
  );

  const toggleCamera = useCallback(async () => {
    if (videoMode === 'camera') {
      await replaceVideoTrack(null);
      setVideoMode('none');
      broadcastState({ camOn: false });
      return;
    }
    try {
      const { camId } = getDevicePrefs();
      const camStream = await getUserMediaWithFallback('video', camId);
      const camTrack = camStream.getVideoTracks()[0];
      camTrack.onended = () => {
        replaceVideoTrack(null);
        setVideoMode('none');
        broadcastState({ camOn: false });
      };
      await replaceVideoTrack(camTrack);
      setVideoMode('camera');
      broadcastState({ camOn: true, screenOn: false });
    } catch (err) {
      setError('Não foi possível acessar a câmera: ' + err.message);
    }
  }, [videoMode, replaceVideoTrack, broadcastState]);

  const toggleScreenShare = useCallback(async () => {
    if (videoMode === 'screen') {
      await replaceVideoTrack(null);
      setVideoMode('none');
      broadcastState({ screenOn: false });
      return;
    }
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      screenTrack.onended = () => {
        replaceVideoTrack(null);
        setVideoMode('none');
        broadcastState({ screenOn: false });
      };
      await replaceVideoTrack(screenTrack);
      setVideoMode('screen');
      broadcastState({ screenOn: true, camOn: false });
    } catch (err) {
      // usuário cancelou o picker de compartilhamento — não é um erro fatal
      if (err.name !== 'NotAllowedError') {
        setError('Não foi possível compartilhar a tela: ' + err.message);
      }
    }
  }, [videoMode, replaceVideoTrack, broadcastState]);

  return {
    peers,
    localStream: localStreamRef.current,
    localStreamVersion,
    micOn,
    videoMode,
    joined,
    error,
    setError,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
  };
}
