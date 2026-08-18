import { useEffect, useRef, useState } from 'react';

// Só existe dentro do app desktop (Electron) — window.squadUpdater é exposto
// pelo preload.js. Rodando no navegador comum (dev do site, etc.) esse objeto
// não existe, e o componente simplesmente não renderiza nada.
export default function UpdateBanner() {
  const [state, setState] = useState({ status: 'idle' });
  const manualRef = useRef(false);

  useEffect(() => {
    if (!window.squadUpdater) return;
    return window.squadUpdater.onStatus((data) => {
      // Checagens automáticas (ao abrir o app) só aparecem na tela quando há
      // mesmo uma atualização pra baixar/instalar. "Checando", "sem novidade"
      // e erro (ex.: sem internet nesse instante) só aparecem quando a pessoa
      // pediu a checagem manualmente pelo botão — senão viraria um aviso toda
      // vez que o app abre, mesmo quando está tudo certo.
      const silentOnly = ['checking', 'not-available', 'error'];
      if (silentOnly.includes(data.status) && !manualRef.current) return;
      setState(data);
      if (data.status === 'not-available' || data.status === 'error') manualRef.current = false;
    });
  }, []);

  if (!window.squadUpdater) return null;

  function handleCheck() {
    manualRef.current = true;
    setState({ status: 'checking' });
    window.squadUpdater.check();
  }

  function handleInstall() {
    window.squadUpdater.install();
  }

  if (state.status === 'downloaded') {
    return (
      <div className="update-banner update-banner-ready">
        <span>🎉 Nova versão do Squad pronta{state.version ? ` (${state.version})` : ''}.</span>
        <button className="btn-primary update-banner-btn" onClick={handleInstall}>
          Reiniciar e atualizar
        </button>
      </div>
    );
  }

  if (state.status === 'downloading') {
    return (
      <div className="update-banner">
        <span>Baixando atualização... {state.percent ?? 0}%</span>
      </div>
    );
  }

  if (state.status === 'available') {
    return (
      <div className="update-banner">
        <span>Nova versão encontrada{state.version ? ` (${state.version})` : ''}, baixando em segundo plano...</span>
      </div>
    );
  }

  if (state.status === 'checking') {
    return (
      <div className="update-banner update-banner-quiet">
        <span>Procurando atualizações...</span>
      </div>
    );
  }

  if (state.status === 'not-available') {
    return (
      <div className="update-banner update-banner-quiet">
        <span>Você já está na versão mais recente.</span>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="update-banner update-banner-quiet">
        <span>Não foi possível checar atualizações agora.</span>
        <button className="btn-secondary update-banner-btn" onClick={handleCheck}>
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <button className="update-check-btn" onClick={handleCheck} title="Checar por atualizações do app">
      ⬇ Checar atualizações
    </button>
  );
}
