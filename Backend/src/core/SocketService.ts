import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger';

let io: Server;

export const SocketService = {
  init(server: HttpServer) {
    io = new Server(server, {
      cors: {
        origin: '*', // Ajustar em produção
        methods: ['GET', 'POST']
      }
    });

    io.on('connection', (socket) => {
      logger.info(`Novo cliente conectado via WebSocket: ${socket.id}`);

      socket.on('join_room', (room) => {
        socket.join(room);
        logger.info(`Socket ${socket.id} entrou na sala: ${room}`);
      });

      socket.on('disconnect', () => {
        logger.info(`Cliente desconectado: ${socket.id}`);
      });
    });

    return io;
  },

  emit(event: string, data: any, room?: string) {
    if (!io) {
      logger.warn('Tentativa de emitir evento Socket.io antes da inicialização.');
      return;
    }

    if (room) {
      io.to(room).emit(event, data);
    } else {
      io.emit(event, data);
    }
  }
};
