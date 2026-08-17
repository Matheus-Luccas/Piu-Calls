# Colocando o servidor no ar

O app desktop (o que cada pessoa instala) sempre precisa se conectar a **um
servidor** rodando em algum lugar acessível pela internet — é o servidor que
guarda as contas, as mensagens e faz a ponte das chamadas. Só uma pessoa do
grupo precisa cuidar disso.

Duas formas, dá pra escolher pela sua prioridade:

| | Sem cadastro em nada | Link fixo, sempre no ar |
|---|---|---|
| **Opção 1 — Cloudflare Quick Tunnel** | ✅ Zero cadastro | ❌ Link muda toda vez que reinicia |
| **Opção 2 — Render.com (grátis)** | Precisa de conta grátis | ✅ Link fixo (mas "dorme" após 15 min sem uso) |

Se o grupo costuma combinar um horário pra jogar/conversar, a **Opção 1** é a
mais simples. Se você quer que o pessoal entre a qualquer hora sem avisar
ninguém, vá de **Opção 2**.

---

## Opção 1 — rodar no seu próprio computador (Cloudflare Quick Tunnel)

Vantagens: grátis, sem criar conta em lugar nenhum, seus dados (mensagens,
contas) ficam no seu computador. Desvantagem: seu computador precisa ficar
ligado e conectado à internet enquanto o pessoal usa, e o link de acesso muda
toda vez que você reinicia o servidor (então você reenvia o link novo pro
grupo a cada sessão).

1. **Instale o `cloudflared`** (uma ferramenta gratuita da Cloudflare):
   - Windows: baixe o instalador em https://github.com/cloudflare/cloudflared/releases/latest (arquivo `cloudflared-windows-amd64.msi`).
   - Mac: `brew install cloudflared` (ou baixe pelo mesmo link acima).
   - Linux: baixe o `.deb`/`.rpm` correspondente no mesmo link, ou `sudo apt install cloudflared` se seu sistema já tiver o repositório da Cloudflare configurado.

2. **Suba o servidor** (na pasta do projeto):
   ```bash
   cd server
   npm install   # só na primeira vez
   npm start
   ```
   Isso deixa o servidor rodando em `http://localhost:4000`.

3. **Em outro terminal, abra o túnel:**
   ```bash
   cloudflared tunnel --url http://localhost:4000
   ```
   Depois de alguns segundos aparece uma linha parecida com:
   ```
   https://algumas-palavras-aleatorias.trycloudflare.com
   ```
   **Esse é o link que você compartilha com o grupo** — é ele que cada pessoa
   vai colar no app desktop na tela de "conectar ao servidor".

4. Quando terminar a sessão, pode fechar os dois terminais (`Ctrl+C`). Na
   próxima vez que for usar, repita os passos 2 e 3 — vai gerar um link novo,
   é só reenviar pro grupo.

> Dica: dá pra deixar os dois comandos (`npm start` e `cloudflared tunnel...`)
> num único script (`.bat` no Windows ou `.sh` no Mac/Linux) pra não precisar
> digitar tudo de novo. Posso preparar esse script pra você, é só pedir.

---

## Opção 2 — hospedar no Render.com (link fixo, grátis)

Vantagens: link fixo (não muda), seu computador pode ficar desligado.
Desvantagens do plano grátis: o serviço "dorme" depois de 15 minutos sem
acessos — a primeira pessoa a entrar depois disso espera uns 30-60 segundos
pra ele acordar. Além disso, **o plano grátis não tem disco persistente**:
toda vez que o serviço "dorme" e "acorda" de novo, o banco de dados (contas,
servidores, mensagens) é reiniciado do zero. Ou seja, é ótimo pra testar e
colocar no ar rapidinho, mas se seu grupo quiser manter contas e histórico de
verdade por muito tempo, o ideal depois é migrar pro plano pago com disco
persistente (a partir de uns $7/mês) — nesse ponto, me avise que ajudo a
configurar.

O projeto já vem com um arquivo `render.yaml` (na pasta raiz) que deixa esse
deploy quase em um clique — o Render lê esse arquivo sozinho e já configura
tudo certinho (comando de build, comando de start, e até gera um
`SESSION_SECRET` aleatório pra você). Você só precisa colocar o código no
GitHub e apontar o Render pra ele.

### Passo 1 — colocar o projeto no GitHub (sem precisar usar terminal)

1. Crie uma conta gratuita em https://github.com, se ainda não tiver.
2. Clique no **+** no canto superior direito → **New repository**. Dê um
   nome (ex.: `meu-squad`), deixe como **Private** ou **Public** (tanto faz) e
   clique em **Create repository**.
3. Na página do repositório recém-criado, clique no link **"uploading an
   existing file"**.
4. Abra a pasta onde você descompactou este projeto no seu computador,
   selecione **todos os arquivos e pastas** (`server`, `client`, `desktop`,
   `render.yaml`, `README.md` etc.) e arraste tudo para a área de upload do
   GitHub (isso funciona bem no navegador Chrome; se seu navegador não
   aceitar arrastar pastas inteiras, veja a alternativa com `git` mais abaixo).
5. Role até o fim da página e clique em **Commit changes**.

*Alternativa para quem já usa terminal/git:*
```bash
cd discord-clone
git init
git add .
git commit -m "primeira versão"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/meu-squad.git
git push -u origin main
```

### Passo 2 — deploy no Render via Blueprint

1. Crie uma conta gratuita em https://render.com — o mais simples é clicar em
   **"Sign in with GitHub"**, assim ele já fica com acesso ao repositório.
2. No painel do Render, clique em **New +** → **Blueprint**.
3. Selecione o repositório que você acabou de criar (`meu-squad`).
4. O Render vai detectar o arquivo `render.yaml` sozinho e mostrar o serviço
   **squad-servidor** já configurado (plano Free, comandos de build/start
   certos, variável `SESSION_SECRET` gerada automaticamente). É só clicar em
   **Apply** / **Create**.
5. Espere o deploy terminar (a barra de progresso mostra "Live" quando
   pronto). O Render te dá uma URL fixa, algo como
   `https://squad-servidor.onrender.com` — **esse é o link que você
   compartilha com o grupo.**

Pronto — esse link funciona sempre, de qualquer casa, sem precisar deixar seu
computador ligado. Cole esse link no app desktop de cada pessoa, na telinha
de "conectar ao servidor".

---

## E o app desktop?

Depois que o servidor estiver no ar (por qualquer uma das opções acima), veja
o [README.md](./README.md) na seção **"Como gerar os instaladores do app
desktop"** para criar o `.exe`/`.dmg`/`.AppImage` e distribuir pro grupo,
junto com o link do servidor.
