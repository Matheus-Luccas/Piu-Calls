import { useCallback, useEffect, useRef, useState } from 'react';
import { getDevicePrefs } from '../config';

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
// como metered.ca / Twilio). Veja o README.
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

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

  const createPeerConnection = useCallback((socketId, remoteUser, isPolite) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const remoteStream = new MediaStream();
    const entry = { pc, isPolite, makingOffer: false, ignoreOffer: false, remoteStream };
    pcsRef.current.set(socketId, entry);

    for (const track of localStreamRef.current.getTracks()) {
      pc.addTrack(track, localStreamRef.current);
    }

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
      remoteStream.addTrack(event.track);
      event.track.onended = () => {
        remoteStream.removeTrack(event.track);
        bumpPeers();
      };
      bumpPeers();
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        // deixa o evento voice:peer-left do servidor cuidar da limpeza principal;
        // aqui só evitamos travar em estado de erro.
      }
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

    async function join() {
      try {
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

        socket.emit('voice:join', { channelId: channel.id }, (res) => {
          if (cancelled) return;
          if (res?.error) {
            setError(res.error);
            return;
          }
          setJoined(true);
          for (const peer of res.peers) {
            const isPolite = socket.id < peer.socketId;
            createPeerConnection(peer.socketId, peer.user, isPolite);
          }
        });
      } catch (err) {
        setError('Não foi possível acessar o microfone: ' + err.message);
      }
    }

    join();

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
      // remove a track de vídeo atual (se houver) de todas as conexões e do stream local
      if (localVideoTrackRef.current) {
        const old = localVideoTrackRef.current;
        for (const [, entry] of pcsRef.current) {
          const sender = entry.pc.getSenders().find((s) => s.track === old);
          if (sender) entry.pc.removeTrack(sender);
        }
        localStreamRef.current.removeTrack(old);
        old.stop();
        localVideoTrackRef.current = null;
      }
      if (newTrack) {
        localVideoTrackRef.current = newTrack;
        localStreamRef.current.addTrack(newTrack);
        for (const [, entry] of pcsRef.current) {
          entry.pc.addTrack(newTrack, localStreamRef.current);
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
