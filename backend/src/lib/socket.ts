import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';

let io: Server | null = null;

export function initSocket(server: HttpServer, corsOrigin: string) {
  io = new Server(server, { cors: { origin: corsOrigin, credentials: true } });
  io.on('connection', (socket) => {
    socket.on('join', (userId: string) => socket.join(`user:${userId}`));
  });
  return io;
}

export function getIo() {
  if (!io) throw new Error('Socket.io ainda não foi inicializado.');
  return io;
}

export function emitToAll(event: string, payload: unknown) {
  io?.emit(event, payload);
}
