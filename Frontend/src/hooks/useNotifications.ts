import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import api from '../services/api';

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  read: boolean;
  link?: string;
  createdAt: string;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data);
      setUnreadCount(response.data.filter((n: Notification) => !n.read).length);
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    
    // Conecta ao WebSocket (usando o baseURL do axios como base)
    const socketUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
    const newSocket = io(socketUrl);
    setSocket(newSocket);

    if (user?.id) {
      newSocket.emit('join_room', `user_${user.id}`);
    }
    newSocket.emit('join_room', 'global');

    newSocket.on('notification', (n: Notification) => {
      setNotifications(prev => [n, ...prev].slice(0, 20));
      setUnreadCount(prev => prev + 1);
      
      // Feedback visual nativo (opcional)
      if (window.Notification && window.Notification.permission === 'granted') {
        new window.Notification(n.title, { body: n.message });
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [fetchNotifications]);

  const markAsRead = async (id: number) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  return { notifications, unreadCount, markAsRead, markAllAsRead };
};
