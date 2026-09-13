import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { initSocket } from './lib/socket';
import { restoreActiveSessions } from './modules/whatsapp/whatsapp.service';

const server = http.createServer(app);
initSocket(server, env.corsOrigin);

server.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`AtendeFlow API (v1.0.0) rodando na porta ${env.port}`);
  restoreActiveSessions().catch((err) =>
    // eslint-disable-next-line no-console
    console.error('Erro ao restaurar sessões do WhatsApp:', err)
  );
});
