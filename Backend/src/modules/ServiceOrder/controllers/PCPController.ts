import { Request, Response } from 'express';
import prisma from '../../../core/prisma';

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseShiftHours(req: Request) {
  const morningRaw = typeof req.query.morningHours === 'string' ? Number(req.query.morningHours) : 4;
  const afternoonRaw = typeof req.query.afternoonHours === 'string' ? Number(req.query.afternoonHours) : 4;
  const nightRaw = typeof req.query.nightHours === 'string' ? Number(req.query.nightHours) : 0;

  const morningHours = Number.isFinite(morningRaw) && morningRaw >= 0 ? morningRaw : 4;
  const afternoonHours = Number.isFinite(afternoonRaw) && afternoonRaw >= 0 ? afternoonRaw : 4;
  const nightHours = Number.isFinite(nightRaw) && nightRaw >= 0 ? nightRaw : 0;

  return [
    { key: 'morning', label: 'Manha', hours: morningHours },
    { key: 'afternoon', label: 'Tarde', hours: afternoonHours },
    { key: 'night', label: 'Noite', hours: nightHours },
  ];
}

export const PCPController = {
  async checkMaterialsCoverage(req: Request, res: Response) {
    try {
      const data = req.body || {};
      const inputMaterials = Array.isArray(data.materials) ? data.materials : [];

      const requestedMap: Record<number, number> = {};
      inputMaterials.forEach((m: any) => {
        const materialId = Number(m.materialId);
        const quantity = Math.max(0, toNumber(m.quantity));
        if (!Number.isFinite(materialId) || materialId <= 0 || quantity <= 0) return;
        requestedMap[materialId] = (requestedMap[materialId] || 0) + quantity;
      });

      const materialIds = Object.keys(requestedMap).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
      if (!materialIds.length) {
        return res.json({
          items: [],
          totals: {
            requestedQty: 0,
            stockQty: 0,
            shortageQty: 0,
            coveragePercent: 100,
          }
        });
      }

      const [materials, stockLogs] = await Promise.all([
        prisma.material.findMany({
          where: { id: { in: materialIds } },
          select: { id: true, name: true, unit: true }
        }),
        prisma.stockLog.findMany({
          where: { materialId: { in: materialIds } },
          select: { materialId: true, type: true, quantity: true }
        })
      ]);

      const stockMap: Record<number, number> = {};
      stockLogs.forEach((log) => {
        const current = stockMap[log.materialId] || 0;
        stockMap[log.materialId] = log.type === 'IN'
          ? current + toNumber(log.quantity)
          : current - toNumber(log.quantity);
      });

      const items = materialIds.map((materialId) => {
        const requestedQty = requestedMap[materialId] || 0;
        const stockQty = Math.max(0, stockMap[materialId] || 0);
        const shortageQty = Math.max(0, requestedQty - stockQty);
        const coveragePercent = requestedQty > 0 ? Math.min(100, (stockQty / requestedQty) * 100) : 100;
        const material = materials.find((m) => m.id === materialId);

        return {
          materialId,
          materialName: material?.name || `Material #${materialId}`,
          unit: material?.unit || '',
          requestedQty,
          stockQty,
          shortageQty,
          coveragePercent,
          status: shortageQty > 0 ? 'SHORTAGE' : 'OK',
        };
      });

      const totals = items.reduce((acc, item) => {
        acc.requestedQty += item.requestedQty;
        acc.stockQty += item.stockQty;
        acc.shortageQty += item.shortageQty;
        return acc;
      }, { requestedQty: 0, stockQty: 0, shortageQty: 0 });

      const coveragePercent = totals.requestedQty > 0
        ? Math.min(100, (totals.stockQty / totals.requestedQty) * 100)
        : 100;

      return res.json({
        items,
        totals: {
          ...totals,
          coveragePercent,
        }
      });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: 'Erro ao verificar cobertura de materiais.' });
    }
  },

  async operationsEfficiency(req: Request, res: Response) {
    try {
      const startQuery = typeof req.query.startDate === 'string' ? req.query.startDate : '';
      const endQuery = typeof req.query.endDate === 'string' ? req.query.endDate : '';

      const periodStart = startQuery ? new Date(startQuery) : new Date(new Date().setDate(new Date().getDate() - 30));
      const periodEnd = endQuery ? new Date(endQuery) : new Date();

      if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
        return res.status(400).json({ status: 'error', message: 'Período inválido para eficiência operacional.' });
      }

      const logs = await prisma.serviceOrderOperationLog.findMany({
        where: {
          startAt: { gte: periodStart, lte: periodEnd },
        },
        include: {
          serviceOrder: {
            select: {
              id: true,
              workCenter: true,
              status: true,
            }
          }
        }
      });

      const groups: Record<string, any> = {};
      const downtimeByCategory: Record<string, number> = {};

      logs.forEach((log) => {
        const workCenter = log.serviceOrder?.workCenter?.trim() || 'Sem centro definido';
        const operationType = String(log.operationType || 'NAO_INFORMADO').toUpperCase();
        const key = `${workCenter}::${operationType}`;

        if (!groups[key]) {
          groups[key] = {
            workCenter,
            operationType,
            logsCount: 0,
            workedHours: 0,
            downtimeMinutes: 0,
            efficiencyPercent: 0,
            uniqueOrders: new Set<number>(),
          };
        }

        groups[key].logsCount += 1;
        groups[key].workedHours += toNumber(log.workedHours);
        groups[key].downtimeMinutes += toNumber(log.downtimeMinutes);
        if (log.serviceOrderId) groups[key].uniqueOrders.add(Number(log.serviceOrderId));

        const downtimeCategory = log.downtimeCategory ? String(log.downtimeCategory).toUpperCase() : 'OUTROS';
        downtimeByCategory[downtimeCategory] = (downtimeByCategory[downtimeCategory] || 0) + toNumber(log.downtimeMinutes);
      });

      const byCenterAndOperation = Object.values(groups).map((g: any) => {
        const downtimeHours = g.downtimeMinutes / 60;
        const denominator = g.workedHours + downtimeHours;
        const efficiencyPercent = denominator > 0 ? (g.workedHours / denominator) * 100 : 0;
        return {
          workCenter: g.workCenter,
          operationType: g.operationType,
          logsCount: g.logsCount,
          ordersCount: g.uniqueOrders.size,
          workedHours: g.workedHours,
          downtimeMinutes: g.downtimeMinutes,
          efficiencyPercent,
        };
      });

      const totalWorkedHours = byCenterAndOperation.reduce((acc: number, i: any) => acc + toNumber(i.workedHours), 0);
      const totalDowntimeMinutes = byCenterAndOperation.reduce((acc: number, i: any) => acc + toNumber(i.downtimeMinutes), 0);
      const totalDowntimeHours = totalDowntimeMinutes / 60;
      const totalDenominator = totalWorkedHours + totalDowntimeHours;
      const globalEfficiencyPercent = totalDenominator > 0 ? (totalWorkedHours / totalDenominator) * 100 : 0;

      return res.json({
        periodStart,
        periodEnd,
        totals: {
          workedHours: totalWorkedHours,
          downtimeMinutes: totalDowntimeMinutes,
          efficiencyPercent: globalEfficiencyPercent,
        },
        downtimeByCategory,
        byCenterAndOperation,
      });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: 'Erro ao gerar eficiência operacional.' });
    }
  },

  async pcpOverview(req: Request, res: Response) {
    try {
      const startQuery = typeof req.query.startDate === 'string' ? req.query.startDate : '';
      const endQuery = typeof req.query.endDate === 'string' ? req.query.endDate : '';
      const dailyCapacityRaw = typeof req.query.dailyCapacityHours === 'string' ? Number(req.query.dailyCapacityHours) : 8;
      const dailyCapacityHours = Number.isFinite(dailyCapacityRaw) && dailyCapacityRaw > 0 ? dailyCapacityRaw : 8;

      const periodStart = startQuery ? new Date(startQuery) : new Date();
      const periodEnd = endQuery ? new Date(endQuery) : new Date(periodStart.getTime() + (6 * 24 * 60 * 60 * 1000));

      if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
        return res.status(400).json({ status: 'error', message: 'Período inválido para visão PCP.' });
      }

      const orders = await prisma.serviceOrder.findMany({
        where: {
          status: { notIn: ['Concluída', 'Cancelada'] },
          plannedStartDate: { lte: periodEnd },
          plannedEndDate: { gte: periodStart },
        },
        select: {
          id: true,
          traceCode: true,
          description: true,
          status: true,
          workCenter: true,
          plannedStartDate: true,
          plannedEndDate: true,
          plannedHours: true,
        }
      });

      const days = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000)) + 1);
      const overviewByCenter: Record<string, any> = {};

      orders.forEach((order) => {
        const centerName = order.workCenter?.trim() || 'Sem centro definido';
        if (!overviewByCenter[centerName]) {
          overviewByCenter[centerName] = {
            workCenter: centerName,
            ordersCount: 0,
            plannedHours: 0,
            capacityHours: days * dailyCapacityHours,
            loadPercent: 0,
            orders: [],
          };
        }

        overviewByCenter[centerName].ordersCount += 1;
        overviewByCenter[centerName].plannedHours += toNumber(order.plannedHours);
        overviewByCenter[centerName].orders.push(order);
      });

      const centers = Object.values(overviewByCenter).map((center: any) => {
        const loadPercent = center.capacityHours > 0
          ? (center.plannedHours / center.capacityHours) * 100
          : 0;
        return {
          ...center,
          loadPercent,
        };
      });

      return res.json({
        periodStart,
        periodEnd,
        dailyCapacityHours,
        days,
        centers,
      });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: 'Erro ao gerar visão PCP.' });
    }
  },

  async pcpCalendar(req: Request, res: Response) {
    try {
      const startQuery = typeof req.query.startDate === 'string' ? req.query.startDate : '';
      const endQuery = typeof req.query.endDate === 'string' ? req.query.endDate : '';

      const periodStart = startOfDay(startQuery ? new Date(startQuery) : new Date());
      const periodEnd = startOfDay(endQuery ? new Date(endQuery) : new Date(periodStart.getTime() + (6 * 24 * 60 * 60 * 1000)));

      if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
        return res.status(400).json({ status: 'error', message: 'Período inválido para calendário PCP.' });
      }
      if (periodStart > periodEnd) {
        return res.status(400).json({ status: 'error', message: 'Período inválido: início maior que fim.' });
      }

      const shiftConfig = parseShiftHours(req);
      const dailyCapacity = shiftConfig.reduce((acc, s) => acc + s.hours, 0);

      const orders = await prisma.serviceOrder.findMany({
        where: {
          status: { notIn: ['Concluída', 'Cancelada'] },
          plannedStartDate: { not: null, lte: periodEnd },
          plannedEndDate: { not: null, gte: periodStart },
        },
        select: {
          id: true,
          traceCode: true,
          description: true,
          status: true,
          workCenter: true,
          plannedStartDate: true,
          plannedEndDate: true,
          plannedHours: true,
        },
      });

      const dayKeys: string[] = [];
      const dayDates: Date[] = [];
      for (let cursor = new Date(periodStart); cursor <= periodEnd; cursor = new Date(cursor.getTime() + (24 * 60 * 60 * 1000))) {
        dayKeys.push(formatDayKey(cursor));
        dayDates.push(new Date(cursor));
      }

      const centersMap: Record<string, any> = {};

      const ensureCenter = (workCenter: string) => {
        if (!centersMap[workCenter]) {
          centersMap[workCenter] = {
            workCenter,
            days: dayKeys.map((dayKey) => ({
              date: dayKey,
              plannedHours: 0,
              capacityHours: dailyCapacity,
              loadPercent: 0,
              shifts: shiftConfig.map((shift) => ({
                key: shift.key,
                label: shift.label,
                capacityHours: shift.hours,
                plannedHours: 0,
                loadPercent: 0,
              })),
              orderIds: [] as number[],
            })),
          };
        }
        return centersMap[workCenter];
      };

      orders.forEach((order) => {
        const workCenter = order.workCenter?.trim() || 'Sem centro definido';
        const center = ensureCenter(workCenter);
        const orderStart = startOfDay(order.plannedStartDate as Date);
        const orderEnd = startOfDay(order.plannedEndDate as Date);
        const overlapStart = orderStart > periodStart ? orderStart : periodStart;
        const overlapEnd = orderEnd < periodEnd ? orderEnd : periodEnd;

        if (overlapStart > overlapEnd) return;

        const spanDays = Math.max(1, Math.ceil((orderEnd.getTime() - orderStart.getTime()) / (24 * 60 * 60 * 1000)) + 1);
        const dailyPlannedHours = toNumber(order.plannedHours) / spanDays;

        for (let cursor = new Date(overlapStart); cursor <= overlapEnd; cursor = new Date(cursor.getTime() + (24 * 60 * 60 * 1000))) {
          const key = formatDayKey(cursor);
          const dayIndex = dayKeys.indexOf(key);
          if (dayIndex < 0) continue;
          const day = center.days[dayIndex];
          day.plannedHours += dailyPlannedHours;
          if (!day.orderIds.includes(order.id)) {
            day.orderIds.push(order.id);
          }

          day.shifts.forEach((shift: any) => {
            if (dailyCapacity <= 0 || shift.capacityHours <= 0) {
              return;
            }
            shift.plannedHours += dailyPlannedHours * (shift.capacityHours / dailyCapacity);
          });
        }
      });

      const centers = Object.values(centersMap).map((center: any) => {
        const days = center.days.map((day: any) => {
          const loadPercent = day.capacityHours > 0 ? (day.plannedHours / day.capacityHours) * 100 : 0;
          const shifts = day.shifts.map((shift: any) => ({
            ...shift,
            loadPercent: shift.capacityHours > 0 ? (shift.plannedHours / shift.capacityHours) * 100 : 0,
          }));

          return {
            ...day,
            loadPercent,
            shifts,
          };
        });

        return {
          workCenter: center.workCenter,
          days,
        };
      });

      return res.json({
        periodStart,
        periodEnd,
        days: dayDates.map((d) => formatDayKey(d)),
        shiftConfig,
        centers,
      });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: 'Erro ao gerar calendário PCP.' });
    }
  }
};
