# Squad — seu mini-Discord

Um app de chat e chamada em grupo (texto + voz + vídeo + compartilhamento de tela),
com múltiplos servidores e canais, parecido com o Discord. Tem duas partes:

1. **Um servidor** (`server/`) que alguém do grupo hospeda — é ele que guarda as
   contas, mensagens e faz a "ponte" das chamadas. Veja **[DEPLOY.md](./DEPLOY.md)**
   para colocá-lo no ar, acessível de qualquer casa.
2. **Um app desktop instalável** (`desktop/`) que cada pessoa do grupo baixa e
   instala no computador — é o que todo mundo abre no dia a dia, parecido com
   o app oficial do Discord.

## O que tem

- **Múltiplos servidores ("guilds")**: crie servidores e convide pessoas por código de convite.
- **Canais de texto**: chat em tempo real por canal, com histórico salvo.
- **Canais de voz**: sala de chamada em grupo (até 10 pessoas por sala) via WebRTC.
- **Câmera**: ligue/desligue seu vídeo a qualquer momento durante a chamada.
- **Compartilhamento de tela**: compartilhe sua tela com quem estiver na chamada.
- **App desktop instalável** (Windows/Mac/Linux), com tela para configurar/trocar
  o endereço do servidor.
- Login/cadastro simples com usuário e senha. Tema escuro, visual inspirado no Discord.

## Passo a passo recomendado

1. Uma pessoa do grupo hospeda o servidor seguindo o **[DEPLOY.md](./DEPLOY.md)**
   e fica com um link (ex.: `https://squad-servidor.onrender.com`).
2. Essa pessoa manda pro resto do grupo apenas o **link do servidor com `/download`
   no final** (ex.: `https://squad-servidor.onrender.com/download`) — é uma
   página com botões de baixar para Windows/Mac/Linux, sempre com a versão mais
   recente. Não precisa mandar o arquivo do instalador manualmente pra cada
   pessoa, nem toda vez que sair uma atualização.
3. Cada pessoa instala o app, na primeira abertura cola o link do servidor,
   e cria sua conta.

## Como gerar os instaladores do app desktop (Windows .exe / Mac .dmg / Linux)

Isso já acontece automaticamente: toda vez que o workflow do GitHub Actions
roda com sucesso, ele publica os três instaladores numa **Release pública**
chamada `latest` no seu repositório, e a página `/download` do servidor (veja
acima) sempre puxa os arquivos dessa release — então você só precisa rodar o
workflow uma vez por atualização, e ninguém precisa baixar/reenviar nada à mão.

Pra gerar (ou atualizar) os instaladores:

1. Suba esta pasta para um repositório no GitHub.
2. Na aba **Actions** do repositório, escolha o workflow **"Build desktop app
   (Windows / Mac / Linux)"** e clique em **Run workflow**.
3. Espere terminar (uns 5-10 minutos). Pronto — a Release `latest` (aba
   **Releases** do repositório) e a página `/download` do servidor já mostram
   os instaladores novos, sem mais nenhum passo manual.

(Se preferir, ainda dá pra baixar os arquivos direto da execução do workflow,
na seção **Artifacts** — mas isso exige estar logado no GitHub, então não é
uma boa forma de compartilhar com amigos que não têm conta lá.)

Detalhes completos em [`.github/workflows/build-desktop.yml`](./.github/workflows/build-desktop.yml)
(o próprio arquivo explica o passo a passo em comentários).

Se preferir gerar localmente (precisa ter Node.js instalado):
```bash
cd desktop
npm install
npm run dist:win     # gera o instalador do Windows (também roda em Mac/Linux com wine)
npm run dist:mac     # só funciona rodando em um Mac
npm run dist:linux   # gera o AppImage do Linux
```
Os arquivos saem em `desktop/release/`.

## Desenvolvimento (rodar tudo localmente, para testar/mexer no código)

Abra dois terminais.

**Terminal 1 — backend:**
```bash
cd server
npm install
npm start
```
Sobe a API em `http://localhost:4000` e cria o banco de dados automaticamente
em `server/data/app.db` na primeira execução.

**Terminal 2 — frontend (no navegador, mais rápido para desenvolver que o app desktop):**
```bash
cd client
npm install
npm run dev
```
Abre em `http://localhost:5173`. Na primeira tela, informe `http://localhost:4000`
como endereço do servidor.

Para testar o app desktop de verdade (Electron) localmente:
```bash
cd desktop
npm install
npm run predist   # builda o frontend e copia para desktop/renderer
npm start
```

## Como funciona (arquitetura)

- **`server/`** — backend em Node.js: Express (API REST + sessões), Socket.IO
  (chat em tempo real e sinalização de chamadas) e SQLite (banco de dados em
  arquivo único).
- **`client/`** — frontend em React + Vite. Fala com o backend via REST (login,
  servidores, canais, histórico) e via WebSocket (mensagens em tempo real,
  sinalização das chamadas). O endereço do servidor é configurado pelo usuário
  na primeira abertura do app (não fica fixo no código).
- **`desktop/`** — empacota o frontend com Electron, gerando o app instalável.
- **Chamadas de voz/vídeo** usam **WebRTC** no formato "mesh": cada participante
  se conecta diretamente com todos os outros da sala; o servidor só ajuda as
  pontas a se encontrarem (sinalização). Funciona bem até uns 10-12
  participantes por sala — o limite configurado é 10.

## Limitações conhecidas (é um app funcional, feito sob medida — não um produto comercial)

- **Sem servidor TURN**: as chamadas usam apenas um STUN público. Funciona bem
  na mesma rede Wi-Fi ou entre redes "abertas"; em combinações de rede mais
  restritas (ex.: 4G com NAT simétrico) a conexão direta pode falhar. Para mais
  robustez, dá pra adicionar um TURN (veja `client/src/voice/useVoiceRoom.js`).
- **Câmera e compartilhamento de tela são alternados, não simultâneos.**
- **Compartilhamento de tela no app desktop** compartilha a tela toda (não tem
  ainda um seletor de janela específica).
- Sem upload de arquivos/imagens no chat, sem mensagens diretas, sem cargos/permissões.

## Próximos passos sugeridos

- Servidor TURN para chamadas mais confiáveis fora da rede local.
- Seletor de janela no compartilhamento de tela do app desktop.
- Notificações de novas mensagens, indicador de "digitando...".
- Upload de imagens/arquivos no chat.
- Cargos e permissões por servidor.

---

Feito sob medida para o seu grupo — sinta-se à vontade para pedir ajustes
(cores, nome do app, funcionalidades extras) a qualquer momento.
