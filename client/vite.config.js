import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Servidor de desenvolvimento acessível na rede local (útil para testar câmera/áudio
// de outro dispositivo). Para câmera/microfone funcionarem em outra máquina que não
// seja localhost, o navegador exige HTTPS - veja o README para instruções de HTTPS local.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});
