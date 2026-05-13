import prisma from '../services/prisma';

export interface AuditEntry {
  entity: string;
  entityId: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  userId?: number;
  userEmail?: string;
  oldData?: any;
  newData?: any;
}

export const AuditService = {
  async log(entry: AuditEntry) {
    try {
      await (prisma as any).auditLog.create({
        data: {
          entity: entry.entity,
          entityId: entry.entityId,
          action: entry.action,
          userId: entry.userId,
          userEmail: entry.userEmail,
          oldData: entry.oldData,
          newData: entry.newData,
        },
      });
    } catch (error) {
      // Falha silenciosa no log para não travar a operação principal, 
      // mas registramos no console/logger de erro interno.
      console.error('Falha ao registrar log de auditoria:', error);
    }
  },
};
