import prisma from '../../../core/prisma';
import { SocketService } from '../../../core/SocketService';
import { logger } from '../../../utils/logger';

export const NotificationService = {
  async notify(params: {
    title: string;
    message: string;
    type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
    userId?: number;
    link?: string;
  }) {
    try {
      const notification = await (prisma as any).notification.create({
        data: {
          title: params.title,
          message: params.message,
          type: params.type,
          userId: params.userId || null,
          link: params.link || null,
        }
      });

      // Emite via WebSocket
      const channel = params.userId ? `user_${params.userId}` : 'global';
      SocketService.emit('notification', notification, channel);

      return notification;
    } catch (error: any) {
      logger.error('Erro ao criar notificação:', error);
    }
  },

  async markAsRead(notificationId: number) {
    return (prisma as any).notification.update({
      where: { id: notificationId },
      data: { read: true }
    });
  },

  async listByUser(userId: number) {
    return (prisma as any).notification.findMany({
      where: {
        OR: [
          { userId },
          { userId: null }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }
};
