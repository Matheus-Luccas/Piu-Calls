const STORAGE_KEY = 'squad_server_url';

// URL padrão usada apenas em desenvolvimento (quando rodando com `npm run dev`
// direto no navegador). No app desktop (Electron) o usuário sempre configura
// a URL do servidor na primeira execução, então isso é só um fallback.
const DEFAULT_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function getServerUrl() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

export function setServerUrl(url) {
  const clean = url.trim().replace(/\/+$/, '');
  localStorage.setItem(STORAGE_KEY, clean);
}

export function hasServerUrl() {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

export function clearServerUrl() {
  localStorage.removeItem(STORAGE_KEY);
}

// Mantido por compatibilidade com quem importar API_URL diretamente.
export const API_URL = getServerUrl();

// ---------- Preferência de dispositivos (microfone, câmera, saída de áudio) ----------
// Guardamos só o deviceId escolhido. Vale a partir da próxima vez que entrar num
// canal de voz (trocar durante uma chamada já em andamento exige sair e entrar
// de novo no canal).
const MIC_KEY = 'squad_mic_device';
const CAM_KEY = 'squad_cam_device';
const SPEAKER_KEY = 'squad_speaker_device';

export function getDevicePrefs() {
  try {
    return {
      micId: localStorage.getItem(MIC_KEY) || '',
      camId: localStorage.getItem(CAM_KEY) || '',
      speakerId: localStorage.getItem(SPEAKER_KEY) || '',
    };
  } catch {
    return { micId: '', camId: '', speakerId: '' };
  }
}

export function setDevicePrefs({ micId, camId, speakerId }) {
  try {
    if (micId !== undefined) localStorage.setItem(MIC_KEY, micId || '');
    if (camId !== undefined) localStorage.setItem(CAM_KEY, camId || '');
    if (speakerId !== undefined) localStorage.setItem(SPEAKER_KEY, speakerId || '');
  } catch {
    // localStorage indisponível — preferência simplesmente não persiste
  }
}
