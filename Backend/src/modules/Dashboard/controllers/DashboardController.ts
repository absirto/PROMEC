import { Request, Response } from 'express';
import prisma from '../../../core/prisma';
import { startOfDay, subDays, endOfDay, format } from 'date-fns';
import { logger } from '../../../utils/logger';
import { getPaginationParams, formatPaginatedResponse } from '../../../utils/pagination';

function isSchemaDriftError(error: any) {
  const code = error?.code;
  const message = String(error?.message || '').toLowerCase();
  return code === 'P2021' || code === 'P2022' || message.includes('does not exist') || message.includes('does not exist in the current database');
}

export const DashboardController = {
  async getStats(req: Request, res: Response) {
    try {
      const { personId, startDate, endDate } = req.query;
      
      const whereClause: any = {};
      if (personId) whereClause.personId = Number(personId);
      if (startDate || endDate) {
        whereClause.openingDate = {
          ...(startDate && { gte: new Date(startDate as string) }),
          ...(endDate && { lte: new Date(endDate as string) })
        };
      }

      const [peopleCount, employeesCount, ordersCount, materialsCount] = await Promise.all([
        prisma.person.count(),
        prisma.employee.count(),
        prisma.serviceOrder.count({ where: whereClause }),
        prisma.material.count()
      ]);

      const ordersByStatus = await prisma.serviceOrder.groupBy({
        by: ['status'],
        where: whereClause,
        _count: { id: true }
      });

      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), i);
        return {
          start: startOfDay(date),
          end: endOfDay(date),
          label: format(date, 'eee', { locale: (require('date-fns/locale').ptBR) })
        };
      }).reverse();

      const financialPerformance = await Promise.all(last7Days.map(async (day) => {
        const orders = await prisma.serviceOrder.findMany({
          where: {
            ...whereClause,
            openingDate: { gte: day.start, lte: day.end },
            status: 'Concluída'
          },
          include: {
            services: true,
            materials: true
          }
        });

        const totalRevenue = orders.reduce((acc, order: any) => {
          const servicesTotal = order.services.reduce((sAcc: number, s: any) => sAcc + s.totalPrice, 0);
          const materialsTotal = order.materials.reduce((mAcc: number, m: any) => mAcc + m.totalPrice, 0);
          const subtotal = servicesTotal + materialsTotal;
          const profitAmount = subtotal * ((order.profitPercent || 0) / 100);
          const baseForTax = subtotal + profitAmount;
          const taxAmount = baseForTax * ((order.taxPercent || 0) / 100);
          return acc + baseForTax + taxAmount;
        }, 0);

        return {
          name: day.label,
          revenue: totalRevenue,
          costs: totalRevenue * 0.4
        };
      }));

      const operationsWhere: any = {};
      if (startDate || endDate) {
        operationsWhere.startAt = {
          ...(startDate && { gte: new Date(startDate as string) }),
          ...(endDate && { lte: new Date(endDate as string) })
        };
      }
      if (personId) {
        operationsWhere.serviceOrder = {
          personId: Number(personId)
        };
      }

      let operationLogs: any[] = [];
      try {
        operationLogs = await prisma.serviceOrderOperationLog.findMany({
          where: operationsWhere,
          include: {
            serviceOrder: {
              select: {
                workCenter: true,
              }
            }
          }
        });
      } catch (error: any) {
        if (isSchemaDriftError(error)) {
          logger.warn('Dashboard sem logs operacionais por drift de schema: %s', error?.message || 'erro desconhecido');
          operationLogs = [];
        } else {
          throw error;
        }
      }

      const efficiencyByCenterMap: Record<string, any> = {};
      const downtimeByCategory: Record<string, number> = {};

      operationLogs.forEach((log) => {
        const center = log.serviceOrder?.workCenter?.trim() || 'Sem centro definido';
        if (!efficiencyByCenterMap[center]) {
          efficiencyByCenterMap[center] = {
            workCenter: center,
            workedHours: 0,
            downtimeMinutes: 0,
            logsCount: 0,
            efficiencyPercent: 0,
          };
        }

        const workedHours = Number(log.workedHours || 0);
        const downtimeMinutes = Number(log.downtimeMinutes || 0);

        efficiencyByCenterMap[center].workedHours += workedHours;
        efficiencyByCenterMap[center].downtimeMinutes += downtimeMinutes;
        efficiencyByCenterMap[center].logsCount += 1;

        const category = (log.downtimeCategory || 'OUTROS').toUpperCase();
        downtimeByCategory[category] = (downtimeByCategory[category] || 0) + downtimeMinutes;
      });

      const efficiencyByCenter = Object.values(efficiencyByCenterMap).map((row: any) => {
        const downtimeHours = row.downtimeMinutes / 60;
        const denominator = row.workedHours + downtimeHours;
        return {
          ...row,
          efficiencyPercent: denominator > 0 ? (row.workedHours / denominator) * 100 : 0,
        };
      });

      const totalWorkedHours = efficiencyByCenter.reduce((acc: number, row: any) => acc + Number(row.workedHours || 0), 0);
      const totalDowntimeMinutes = efficiencyByCenter.reduce((acc: number, row: any) => acc + Number(row.downtimeMinutes || 0), 0);
      const totalDowntimeHours = totalDowntimeMinutes / 60;
      const efficiencyDenominator = totalWorkedHours + totalDowntimeHours;
      const globalEfficiencyPercent = efficiencyDenominator > 0 ? (totalWorkedHours / efficiencyDenominator) * 100 : 0;

      const trendReferenceDate = endDate ? new Date(endDate as string) : new Date();
      const trend7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(trendReferenceDate, i);
        return {
          start: startOfDay(date),
          end: endOfDay(date),
          key: format(date, 'yyyy-MM-dd'),
          label: format(date, 'dd/MM')
        };
      }).reverse();

      const trendStart = trend7Days[0].start;
      const trendEnd = trend7Days[trend7Days.length - 1].end;

      const trendWhere: any = {
        startAt: {
          gte: trendStart,
          lte: trendEnd,
        }
      };
      if (personId) {
        trendWhere.serviceOrder = { personId: Number(personId) };
      }

      let trendLogs: any[] = [];
      try {
        trendLogs = await prisma.serviceOrderOperationLog.findMany({
          where: trendWhere,
          include: {
            serviceOrder: {
              select: {
                workCenter: true,
              }
            }
          }
        });
      } catch (error: any) {
        if (isSchemaDriftError(error)) {
          logger.warn('Dashboard sem tendência por drift de schema: %s', error?.message || 'erro desconhecido');
          trendLogs = [];
        } else {
          throw error;
        }
      }

      const trendByCenterMap: Record<string, any> = {};

      trendLogs.forEach((log) => {
        const center = log.serviceOrder?.workCenter?.trim() || 'Sem centro definido';
        const dayKey = format(log.startAt, 'yyyy-MM-dd');

        if (!trendByCenterMap[center]) {
          trendByCenterMap[center] = {
            workCenter: center,
            daily: {},
          };
        }

        if (!trendByCenterMap[center].daily[dayKey]) {
          trendByCenterMap[center].daily[dayKey] = {
            workedHours: 0,
            downtimeMinutes: 0,
          };
        }

        trendByCenterMap[center].daily[dayKey].workedHours += Number(log.workedHours || 0);
        trendByCenterMap[center].daily[dayKey].downtimeMinutes += Number(log.downtimeMinutes || 0);
      });

      const efficiencyTrendByCenter = Object.values(trendByCenterMap).map((row: any) => {
        const trend = trend7Days.map((d) => {
          const item = row.daily[d.key] || { workedHours: 0, downtimeMinutes: 0 };
          const downtimeHours = item.downtimeMinutes / 60;
          const denominator = item.workedHours + downtimeHours;
          const efficiencyPercent = denominator > 0 ? (item.workedHours / denominator) * 100 : 0;

          return {
            day: d.label,
            date: d.key,
            efficiencyPercent,
            workedHours: item.workedHours,
            downtimeMinutes: item.downtimeMinutes,
          };
        });

        return {
          workCenter: row.workCenter,
          trend,
        };
      });

      const recentOrders = await prisma.serviceOrder.findMany({
        where: whereClause,
        take: 5,
        orderBy: { openingDate: 'desc' },
        include: {
          person: { include: { naturalPerson: true, legalPerson: true } }
        }
      });

      const activities = recentOrders.map(order => ({
        id: order.id,
        title: `OS #${order.id} ${order.status}`,
        description: `Cliente: ${order.person?.naturalPerson?.name || order.person?.legalPerson?.corporateName || 'N/A'}`,
        time: order.openingDate,
        type: order.status === 'Concluída' ? 'success' : 'info'
      }));

      const materials = await prisma.material.findMany();

      let lowStockCount = 0;
      try {
        for (const m of materials) {
          const stockLogs = await prisma.stockLog.findMany({ where: { materialId: m.id } });
          const currentStock = stockLogs.reduce((acc: number, log) => {
            return log.type === 'IN' ? acc + log.quantity : acc - log.quantity;
          }, 0);
          if (currentStock < 10) lowStockCount++;
        }
      } catch (error: any) {
        if (isSchemaDriftError(error)) {
          logger.warn('Dashboard sem cálculo de estoque por drift de schema: %s', error?.message || 'erro desconhecido');
          lowStockCount = 0;
        } else {
          throw error;
        }
      }

      const completedOrders = await prisma.serviceOrder.findMany({
        where: { 
          ...whereClause,
          status: 'Concluída' 
        },
        include: { services: true, materials: true }
      });

      let totalMaterials = 0;
      let totalServices = 0;
      let totalTaxes = 0;
      let totalProfit = 0;

      completedOrders.forEach((order: any) => {
        const mTotal = order.materials.reduce((acc: number, m: any) => acc + m.totalPrice, 0);
        const sTotal = order.services.reduce((acc: number, s: any) => acc + s.totalPrice, 0);
        const subtotal = mTotal + sTotal;
        
        const profitAmt = subtotal * ((order.profitPercent || 0) / 100);
        const baseForTax = subtotal + profitAmt;
        const taxAmt = baseForTax * ((order.taxPercent || 0) / 100);

        totalMaterials += mTotal;
        totalServices += sTotal;
        totalTaxes += taxAmt;
        totalProfit += profitAmt;
      });

      const totalRevenue = totalMaterials + totalServices + totalTaxes + totalProfit;

      res.json({
        stats: {
          totalRevenue,
          totalMaterials,
          totalServices,
          totalTaxes,
          totalProfit,
          people: peopleCount,
          activeOrders: ordersCount - (ordersByStatus.find(s => s.status === 'Concluída')?._count.id || 0) - (ordersByStatus.find(s => s.status === 'Cancelada')?._count.id || 0),
          lowStock: lowStockCount,
          totalOrders: ordersCount
        },
        operationsKpi: {
          workedHours: totalWorkedHours,
          downtimeMinutes: totalDowntimeMinutes,
          efficiencyPercent: globalEfficiencyPercent,
          logsCount: operationLogs.length,
        },
        efficiencyByCenter,
        efficiencyTrendByCenter,
        downtimeByCategory,
        financialPerformance,
        distribution: ordersByStatus.map(s => ({
          label: s.status,
          value: s._count.id
        })),
        activities
      });
    } catch (error: any) {
      logger.error('DashboardController.getStats falhou: %s', error?.message || 'erro desconhecido');
      res.status(500).json({ error: 'Erro ao processar dados do dashboard' });
    }
  },

  async getAuditLogs(req: Request, res: Response) {
    try {
      const pagination = getPaginationParams(req, 20);
      const { module, entity } = req.query;
      
      const where: any = {};
      if (entity) where.entity = String(entity);
      if (module) {
        if (module === 'Suprimentos') {
          where.entity = { in: ['Material', 'StockLog', 'PurchaseRequest'] };
        }
      }

      const [logs, total] = await Promise.all([
        (prisma as any).auditLog.findMany({
          where,
          take: pagination.limit,
          skip: pagination.skip,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }),
        (prisma as any).auditLog.count({ where })
      ]);

      res.json(formatPaginatedResponse(logs, total, pagination));
    } catch (error: any) {
      logger.error('DashboardController.getAuditLogs falhou: %s', error?.message);
      res.status(500).json({ error: 'Erro ao buscar logs de auditoria' });
    }
  }
};
