import { useRef } from 'react';
import { getDevicePrefs } from '../config';

// Aplica a saída de áudio (alto-falante/fone) escolhida nas configurações a um
// elemento <audio>/<video>. setSinkId não existe em todo navegador (não tem no
// Firefox, por exemplo) — mas existe no Chromium, que é o que o app desktop usa.
function applyOutputDevice(el) {
  if (!el || !el.setSinkId) return;
  const { speakerId } = getDevicePrefs();
  if (speakerId) el.setSinkId(speakerId).catch(() => {});
}

export default function VideoTile({ stream, muted, username, avatarColor, micOn = true, videoLabel }) {
  const hasVideo = stream && stream.getVideoTracks().length > 0;
  const videoElRef = useRef(null);

  function handleExpand() {
    const el = videoElRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (el.requestFullscreen) {
      el.requestFullscreen();
    }
  }

  return (
    <div className="video-tile">
      {hasVideo ? (
        // Ref-callback em vez de useEffect: o <video> só existe no DOM quando
        // hasVideo é true, e essa tag é remontada toda vez que a pessoa liga
        // câmera/tela pela primeira vez (antes disso o quadradinho mostra só o
        // avatar). Um useEffect preso a "stream" não dispara nesse momento
        // porque o objeto MediaStream em si não muda de referência — só ganha
        // uma faixa de vídeo nova — então o vídeo ficava preto, sem fonte
        // conectada. O ref-callback roda exatamente quando a tag é criada.
        <video
          ref={(el) => {
            videoElRef.current = el;
            if (el) {
              el.srcObject = stream;
              applyOutputDevice(el);
            }
          }}
          autoPlay
          playsInline
          muted={muted}
          className="video-tile-el"
          onDoubleClick={handleExpand}
        />
      ) : (
        <div className="video-tile-avatar">
          <div className="avatar-circle" style={{ background: avatarColor }}>
            {username?.[0]?.toUpperCase()}
          </div>
        </div>
      )}
      {!hasVideo && stream && (
        <audio
          ref={(el) => {
            if (el) {
              el.srcObject = stream;
              applyOutputDevice(el);
            }
          }}
          autoPlay
          muted={muted}
        />
      )}

      {hasVideo && (
        <button
          className="video-tile-expand-btn"
          onClick={handleExpand}
          title="Tela cheia (ou dê 2 cliques no vídeo)"
        >
          ⛶
        </button>
      )}

      <div className="video-tile-label">
        <span className={`mic-dot ${micOn ? 'mic-on' : 'mic-off'}`} />
        {username}
        {videoLabel && <span className="video-tile-badge">{videoLabel}</span>}
      </div>
    </div>
  );
}
