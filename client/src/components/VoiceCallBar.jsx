// Barra flutuante que aparece quando a pessoa está numa chamada de voz mas
// está vendo outra coisa no momento (ex.: foi mandar mensagem num canal de
// texto). Sem isso, a única forma de "ver" que ainda está conectado era
// voltar pro canal de voz — e ficava fácil pensar que tinha saído da call.
export default function VoiceCallBar({ channel, micOn, toggleMic, onJump, onLeave }) {
  if (!channel) return null;

  return (
    <div className="voice-call-bar">
      <button className="voice-call-bar-info" onClick={onJump} title="Voltar para a chamada">
        <span className="voice-call-bar-dot" />
        <span>
          Conectado em <strong>{channel.name}</strong>
        </span>
      </button>
      <button
        className={`ctrl-btn ctrl-btn-sm ${micOn ? '' : 'ctrl-off'}`}
        onClick={toggleMic}
        title="Ligar/desligar microfone"
      >
        {micOn ? '🎤' : '🔇'}
      </button>
      <button className="ctrl-btn ctrl-btn-sm ctrl-danger" onClick={onLeave} title="Desconectar da chamada">
        📵
      </button>
    </div>
  );
}
