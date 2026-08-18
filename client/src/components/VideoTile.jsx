export default function VideoTile({ stream, muted, username, avatarColor, micOn = true, videoLabel }) {
  const hasVideo = stream && stream.getVideoTracks().length > 0;

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
            if (el) el.srcObject = stream;
          }}
          autoPlay
          playsInline
          muted={muted}
          className="video-tile-el"
        />
      ) : (
        <div className="video-tile-avatar">
          <div className="avatar-circle" style={{ background: avatarColor }}>
            {username?.[0]?.toUpperCase()}
          </div>
        </div>
      )}
      {!hasVideo && stream && <audio ref={(el) => el && (el.srcObject = stream)} autoPlay muted={muted} />}
      <div className="video-tile-label">
        <span className={`mic-dot ${micOn ? 'mic-on' : 'mic-off'}`} />
        {username}
        {videoLabel && <span className="video-tile-badge">{videoLabel}</span>}
      </div>
    </div>
  );
}
