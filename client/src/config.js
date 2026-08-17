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
