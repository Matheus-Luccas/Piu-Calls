import { useEffect, useRef } from 'react';

export default function VideoTile({ stream, muted, username, avatarColor, micOn = true, videoLabel }) {
  const videoRef = useRef(null);
  const hasVideo = stream && stream.getVideoTracks().length > 0;

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream || null;
  }, [stream]);

  return (
    <div className="video-tile">
      {hasVideo ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} className="video-tile-el" />
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
