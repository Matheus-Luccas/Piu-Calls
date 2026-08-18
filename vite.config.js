import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Servidor de desenvolvimento acessível na rede local (útil para testar câmera/áudio
// de outro dispositivo). Para câmera/microfone funcionarem em outra máquina que não
// seja localhost, o navegador exige HTTPS - veja o README para instruções de HTTPS local.
export default defineConfig({
  plugins: [react()],
  // Caminhos relativos no build de produção — essencial para o app desktop
  // (Electron), que abre o index.html direto do disco (file://). Com caminho
  // absoluto ("/assets/...") o JavaScript não carrega nesse contexto e a
  // janela fica em branco.
  base: './',
  server: {
    host: true,
    port: 5173,
  },
});
