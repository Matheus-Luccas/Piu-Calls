const express = require('express');
const http = require('http');
const cors = require('cors');
const session = require('express-session');
const sharedSession = require('express-socket.io-session');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const serverRoutes = require('./routes/servers');
const channelRoutes = require('./routes/channels');
const { registerChat } = require('./socket/chat');
const { registerVoice } = require('./socket/voice');

const PORT = process.env.PORT || 4000;
// Confia no cabeçalho X-Forwarded-* quando o servidor roda atrás de um proxy
// (Render, Cloudflare Tunnel, Nginx etc.), necessário para cookies "secure" funcionarem.
const app = express();
app.set('trust proxy', 1);
const httpServer = http.createServer(app);

const cookieSecure = process.env.SESSION_COOKIE_SECURE === 'true';

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'troque-este-segredo-em-producao',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias
    // O app desktop (Electron) carrega a página de file:// — uma origem
    // diferente do servidor (ex.: https://squad-servidor.onrender.com) em
    // qualquer definição de "mesmo site". Cookies SameSite=Lax não são
    // enviados nesse cenário "cross-site", então o login parece funcionar
    // (o servidor manda o cookie) mas todo pedido seguinte falha em silêncio.
    // Por isso usamos SameSite=None quando publicado com HTTPS — exigido pelos
    // navegadores só funciona junto com "secure". Em http local (sem
    // SESSION_COOKIE_SECURE=true) mantemos "lax", que já basta porque tudo
    // roda em localhost.
    sameSite: cookieSecure ? 'none' : 'lax',
    // Ative com SESSION_COOKIE_SECURE=true quando o app estiver publicado com HTTPS
    // (Render, Cloudflare Tunnel etc.). Deixe desligado para uso só em http local.
    secure: cookieSecure,
  },
});

// CORS "aberto, mas com credenciais": o app tem clientes rodando em origens bem
// diferentes (localhost:5173 em dev, o app desktop Electron carregando de
// file:// — origem "null" —, e o link público de produção), então em vez de
// travar em uma única origem fixa, refletimos a origem recebida. Como o
// cookie de sessão agora pode viajar entre sites (SameSite=None em produção),
// a segurança aqui depende do ID de sessão ser longo e imprevisível (o
// express-session já garante isso) — é o mesmo modelo de confiança de uma API
// autenticada por token.
const corsOptions = {
  origin: (origin, callback) => callback(null, true),
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(sessionMiddleware);

app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/channels', channelRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const io = new Server(httpServer, {
  cors: corsOptions,
});

io.use(sharedSession(sessionMiddleware, { autoSave: true }));

// Bloqueia conexões de socket sem sessão autenticada
io.use((socket, next) => {
  if (socket.handshake.session && socket.handshake.session.userId) {
    return next();
  }
  next(new Error('unauthorized'));
});

io.on('connection', (socket) => {
  registerChat(io, socket);
  registerVoice(io, socket);
});

httpServer.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
