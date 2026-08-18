import { useEffect, useRef, useState } from 'react';
import { getDevicePrefs, setDevicePrefs } from '../config';

const speakerSupported = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

export default function DeviceSettings({ onClose }) {
  const [devices, setDevices] = useState({ mics: [], cams: [], speakers: [] });
  const [micId, setMicId] = useState('');
  const [camId, setCamId] = useState('');
  const [speakerId, setSpeakerId] = useState('');
  const [error, setError] = useState(null);

  const videoPreviewRef = useRef(null);
  const meterBarRef = useRef(null);
  const previewStreamsRef = useRef([]);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const prefs = getDevicePrefs();
    setMicId(prefs.micId);
    setCamId(prefs.camId);
    setSpeakerId(prefs.speakerId);
    refreshDevices();

    navigator.mediaDevices.addEventListener?.('devicechange', refreshDevices);
    return () => navigator.mediaDevices.removeEventListener?.('devicechange', refreshDevices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshDevices() {
    let list = await navigator.mediaDevices.enumerateDevices();
    const hasLabels = list.some((d) => d.label);
    if (!hasLabels) {
      // Os nomes dos dispositivos só aparecem depois de uma permissão concedida —
      // pede uma vez só pra "desbloquear" os rótulos.
      try {
        const tmp = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        tmp.getTracks().forEach((t) => t.stop());
        list = await navigator.mediaDevices.enumerateDevices();
      } catch {
        // sem câmera/mic disponível ou permissão negada — segue sem rótulos
      }
    }
    setDevices({
      mics: list.filter((d) => d.kind === 'audioinput'),
      cams: list.filter((d) => d.kind === 'videoinput'),
      speakers: list.filter((d) => d.kind === 'audiooutput'),
    });
  }

  // Prévia ao vivo: reabre câmera/microfone escolhidos sempre que a seleção muda,
  // pra mostrar a imagem e o nível de volume antes de salvar.
  useEffect(() => {
    let cancelled = false;
    stopPreview();

    async function start() {
      const streams = [];
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: micId ? { deviceId: { exact: micId } } : true,
        });
        if (cancelled) {
          audioStream.getTracks().forEach((t) => t.stop());
        } else {
          streams.push(audioStream);
          startMeter(audioStream);
        }
      } catch (err) {
        if (!cancelled) setError('Não foi possível abrir o microfone selecionado: ' + err.message);
      }

      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: camId ? { deviceId: { exact: camId } } : true,
        });
        if (cancelled) {
          videoStream.getTracks().forEach((t) => t.stop());
        } else {
          streams.push(videoStream);
          if (videoPreviewRef.current) videoPreviewRef.current.srcObject = videoStream;
        }
      } catch {
        // sem câmera disponível — tudo bem, só não mostra prévia de vídeo
      }

      previewStreamsRef.current = streams;
    }

    start();
    return () => {
      cancelled = true;
      stopPreview();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micId, camId]);

  function startMeter(audioStream) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(audioStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      const data = new Uint8Array(analyser.frequencyBinCount);

      function tick() {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        if (meterBarRef.current) meterBarRef.current.style.width = `${Math.min(100, (avg / 100) * 100)}%`;
        rafRef.current = requestAnimationFrame(tick);
      }
      tick();
    } catch {
      // Web Audio indisponível — só não mostra o medidor, sem quebrar o resto
    }
  }

  function stopPreview() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (meterBarRef.current) meterBarRef.current.style.width = '0%';
    for (const s of previewStreamsRef.current) s.getTracks().forEach((t) => t.stop());
    previewStreamsRef.current = [];
  }

  async function testSpeaker() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.15;
      const dest = audioCtx.createMediaStreamDestination();
      osc.connect(gain).connect(dest);
      osc.frequency.value = 440;

      const el = new Audio();
      el.srcObject = dest.stream;
      if (speakerId && el.setSinkId) await el.setSinkId(speakerId);
      await el.play();

      osc.start();
      setTimeout(() => {
        osc.stop();
        audioCtx.close();
      }, 500);
    } catch (err) {
      setError('Não foi possível tocar o som de teste: ' + err.message);
    }
  }

  function handleSave() {
    setDevicePrefs({ micId, camId, speakerId });
    stopPreview();
    onClose();
  }

  function handleCancel() {
    stopPreview();
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal device-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Dispositivos de áudio e vídeo</h3>
        <p className="device-modal-hint">
          Vale a partir da próxima vez que você entrar num canal de voz. Se já estiver
          numa chamada, saia e entre de novo no canal pra aplicar.
        </p>

        {error && <div className="auth-error">{error}</div>}

        <label>Microfone</label>
        <select value={micId} onChange={(e) => setMicId(e.target.value)}>
          <option value="">Padrão do sistema</option>
          {devices.mics.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Microfone ${d.deviceId.slice(0, 6)}`}
            </option>
          ))}
        </select>
        <div className="device-meter">
          <div className="device-meter-bar" ref={meterBarRef} />
        </div>

        <label>Câmera</label>
        <select value={camId} onChange={(e) => setCamId(e.target.value)}>
          <option value="">Padrão do sistema</option>
          {devices.cams.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Câmera ${d.deviceId.slice(0, 6)}`}
            </option>
          ))}
        </select>
        <video ref={videoPreviewRef} autoPlay playsInline muted className="device-preview" />

        <label>Alto-falante / fone (saída de áudio)</label>
        {speakerSupported ? (
          <>
            <select value={speakerId} onChange={(e) => setSpeakerId(e.target.value)}>
              <option value="">Padrão do sistema</option>
              {devices.speakers.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Saída ${d.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
            <button type="button" className="btn-secondary device-test-btn" onClick={testSpeaker}>
              🔊 Testar som
            </button>
          </>
        ) : (
          <p className="device-modal-hint">
            Escolher a saída de áudio não é suportado aqui — vai usar sempre o
            dispositivo padrão do sistema.
          </p>
        )}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={handleCancel}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
