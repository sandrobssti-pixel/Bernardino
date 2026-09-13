import path from 'path';
import qrcode from 'qrcode';
import { Boom } from '@hapi/boom';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  WASocket,
} from '@whiskeysockets/baileys';
import { prisma } from '../../lib/prisma';
import { emitToAll } from '../../lib/socket';

// Etapa 1 (v1.0.0): sessões guardadas em arquivo local via useMultiFileAuthState do Baileys.
// Numa próxima etapa, avaliar mover as credenciais para um armazenamento compartilhado
// (banco de dados/Redis) caso o sistema precise rodar em mais de uma instância.
const SESSIONS_DIR = path.join(process.cwd(), 'sessions');
const sockets = new Map<string, WASocket>();

export async function startWhatsAppSession(sessionName: string) {
  if (sockets.has(sessionName)) return sockets.get(sessionName)!;

  const authFolder = path.join(SESSIONS_DIR, sessionName);
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  const { version } = await fetchLatestBaileysVersion();

  const socket = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false,
  });

  await prisma.whatsAppSession.upsert({
    where: { name: sessionName },
    update: { status: 'QR_PENDING' },
    create: { name: sessionName, status: 'QR_PENDING' },
  });

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const qrDataUrl = await qrcode.toDataURL(qr);
      await prisma.whatsAppSession.update({
        where: { name: sessionName },
        data: { status: 'QR_PENDING', qrCode: qrDataUrl },
      });
      emitToAll('whatsapp:qr', { sessionName, qrCode: qrDataUrl });
    }

    if (connection === 'open') {
      await prisma.whatsAppSession.update({
        where: { name: sessionName },
        data: { status: 'CONNECTED', qrCode: null, connectedAt: new Date() },
      });
      emitToAll('whatsapp:status', { sessionName, status: 'CONNECTED' });
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      await prisma.whatsAppSession.update({
        where: { name: sessionName },
        data: { status: 'DISCONNECTED' },
      });
      emitToAll('whatsapp:status', { sessionName, status: 'DISCONNECTED' });
      sockets.delete(sessionName);

      if (shouldReconnect) {
        startWhatsAppSession(sessionName).catch((err) =>
          // eslint-disable-next-line no-console
          console.error(`Erro ao reconectar sessão "${sessionName}":`, err)
        );
      }
    }
  });

  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      await handleIncomingMessage(msg).catch((err) =>
        // eslint-disable-next-line no-console
        console.error('Erro ao processar mensagem recebida do WhatsApp:', err)
      );
    }
  });

  sockets.set(sessionName, socket);
  return socket;
}

async function handleIncomingMessage(msg: any) {
  const jid = msg.key.remoteJid as string | undefined;
  if (!jid || jid.endsWith('@g.us')) return; // Etapa 1: grupos ficam fora do escopo por enquanto.

  const phone = jid.split('@')[0];
  const text: string =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    '[mensagem não suportada nesta versão]';

  const contact = await prisma.contact.upsert({
    where: { whatsappJid: jid },
    update: {},
    create: { whatsappJid: jid, phone, name: msg.pushName || phone },
  });

  let conversation = await prisma.conversation.findFirst({
    where: { contactId: contact.id, status: { not: 'CLOSED' } },
    orderBy: { createdAt: 'desc' },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { contactId: contact.id, status: 'PENDING' },
    });
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: 'INBOUND',
      senderType: 'CONTACT',
      content: text,
      status: 'DELIVERED',
      whatsappMessageId: msg.key.id,
    },
  });

  await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });

  emitToAll('message:new', { ...message, conversation: { ...conversation, contact } });
}

export async function sendWhatsAppMessage(jid: string, content: string) {
  // Etapa 1: usa a primeira sessão conectada disponível.
  // Em uma próxima etapa, associar cada conversa a uma sessão/número específico.
  const socket = [...sockets.values()][0];
  if (!socket) throw new Error('Nenhuma sessão do WhatsApp conectada.');
  const result = await socket.sendMessage(jid, { text: content });
  return result?.key.id ?? undefined;
}

export async function stopWhatsAppSession(sessionName: string) {
  const socket = sockets.get(sessionName);
  if (socket) {
    await socket.logout().catch(() => undefined);
    sockets.delete(sessionName);
  }
  await prisma.whatsAppSession.update({
    where: { name: sessionName },
    data: { status: 'DISCONNECTED', qrCode: null },
  });
}

export async function restoreActiveSessions() {
  const sessions = await prisma.whatsAppSession.findMany({ where: { status: { not: 'DISCONNECTED' } } });
  for (const session of sessions) {
    startWhatsAppSession(session.name).catch((err) =>
      // eslint-disable-next-line no-console
      console.error(`Erro ao restaurar sessão "${session.name}":`, err)
    );
  }
}
