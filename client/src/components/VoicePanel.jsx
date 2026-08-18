import { useEffect, useState } from 'react';
import { useVoiceRoom } from '../voice/useVoiceRoom';
import VideoTile from './VideoTile';
import DeviceSettings from './DeviceSettings';

export default function VoicePanel({ socket, channel, currentUser }) {
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const {
    peers,
    localStream,
    localStreamVersion,
    micOn,
    videoMode,
    joined,
    error,
    setError,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
  } = useVoiceRoom({ socket, channel, currentUser });

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error, setError]);

  const peerList = Object.entries(peers);

  return (
    <div className="voice-panel">
      <div className="voice-header">
        <span>🔊 {channel.name}</span>
        <span className="voice-status">{joined ? `Conectado · ${peerList.length + 1} na sala` : 'Conectando...'}</span>
      </div>

      {error && <div className="voice-error">{error}</div>}

      <div className="video-grid">
        <VideoTile
          key="self"
          stream={localStream}
          streamVersion={localStreamVersion}
          muted
          username={`${currentUser.username} (você)`}
          avatarColor={currentUser.avatarColor}
          micOn={micOn}
          videoLabel={videoMode === 'screen' ? 'Compartilhando tela' : videoMode === 'camera' ? 'Câmera' : null}
        />
        {peerList.map(([socketId, peer]) => (
          <VideoTile
            key={socketId}
            stream={peer.stream}
            muted={false}
            username={peer.user?.username || 'Usuário'}
            avatarColor={peer.user?.avatarColor}
            micOn={peer.micOn}
            videoLabel={peer.screenOn ? 'Compartilhando tela' : peer.camOn ? 'Câmera' : null}
          />
        ))}
      </div>

      <div className="voice-controls">
        <button className={`ctrl-btn ${micOn ? '' : 'ctrl-off'}`} onClick={toggleMic} title="Ligar/desligar microfone">
          {micOn ? '🎤' : '🔇'}
        </button>
        <button
          className={`ctrl-btn ${videoMode === 'camera' ? 'ctrl-active' : ''}`}
          onClick={toggleCamera}
          title="Ligar/desligar câmera"
        >
          {videoMode === 'camera' ? '📹' : '📷'}
        </button>
        <button
          className={`ctrl-btn ${videoMode === 'screen' ? 'ctrl-active' : ''}`}
          onClick={toggleScreenShare}
          title="Compartilhar tela"
        >
          🖥️
        </button>
        <button className="ctrl-btn" onClick={() => setShowDeviceSettings(true)} title="Dispositivos de áudio e vídeo">
          ⚙
        </button>
      </div>

      {showDeviceSettings && <DeviceSettings onClose={() => setShowDeviceSettings(false)} />}
    </div>
  );
}
