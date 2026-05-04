import { Request, Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middleware/auth';

function generateTraceCode() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `OS-${y}${m}${day}-${rand}`;
}

function getActor(req: Request) {
  const authReq = req as AuthRequest;
  const id = authReq.user?.id ? Number(authReq.user.id) : null;
  const email = authReq.user?.email ? String(authReq.user.email) : null;
  return { id, email };
}

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

const OPERATION_TYPES = ['USINAGEM', 'CALDEIRARIA', 'MONTAGEM'];
const SHIFTS = ['MORNING', 'AFTERNOON', 'NIGHT'];
const DOWNTIME_CATEGORIES = ['MACHINE', 'MATERIAL', 'SETUP', 'RETRABALHO', 'QUALIDADE', 'OUTROS'];

function hasValidPlanWindow(workCenter: string | null, plannedStartDate: Date | null, plannedEndDate: Date | null) {
  return Boolean(workCenter && plannedStartDate && plannedEndDate);
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA <= endB && endA >= startB;
}

async function findPlanConflicts(
  tx: any,
  params: {
    workCenter: string;
    plannedStartDate: Date;
    plannedEndDate: Date;
    excludeIds?: number[];
  }
) {
  return tx.serviceOrder.findMany({
    where: {
      id: { notIn: params.excludeIds || [] },
      status: { notIn: ['Concluída', 'Cancelada'] },
      workCenter: params.workCenter,
      plannedStartDate: {
        not: null,
        lte: params.plannedEndDate,
      },
      plannedEndDate: {
        not: null,
        gte: params.plannedStartDate,
      },
    },
    select: {
      id: true,
      traceCode: true,
      description: true,
      plannedStartDate: true,
      plannedEndDate: true,
      workCenter: true,
      status: true,
    }
  });
}

function enrichFinancials(order: any) {
  const materials = Array.isArray(order.materials) ? order.materials : [];
  const services = Array.isArray(order.services) ? order.services : [];
  const transactions = Array.isArray(order.transactions) ? order.transactions : [];

  const materialCost = materials.reduce((acc: number, m: any) => acc + toNumber(m.totalPrice), 0);
  const laborCost = services.reduce((acc: number, s: any) => acc + toNumber(s.totalPrice), 0);
  const directCost = materialCost + laborCost;

  const profitPercent = toNumber(order.profitPercent);
  const taxPercent = toNumber(order.taxPercent);
  const profitAmount = directCost * (profitPercent / 100);
  const baseForTax = directCost + profitAmount;
  const taxAmount = baseForTax * (taxPercent / 100);
  const totalEstimated = baseForTax + taxAmount;

  const receivables = transactions
    .filter((t: any) => t.type === 'RECEIVABLE')
    .reduce((acc: number, t: any) => acc + toNumber(t.amount), 0);
  const payables = transactions
    .filter((t: any) => t.type === 'PAYABLE')
    .reduce((acc: number, t: any) => acc + toNumber(t.amount), 0);
  const realizedMargin = receivables - payables - directCost;

  return {
    ...order,
    financials: {
      materialCost,
      laborCost,
      directCost,
      profitPercent,
      profitAmount,
      taxPercent,
      taxAmount,
      totalEstimated,
      receivables,
      payables,
      realizedMargin,
    },
  };
}

export const ServiceOrderController = {
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

  async listOperations(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ status: 'error', message: 'ID de OS inválido.' });
      }

      const exists = await prisma.serviceOrder.findUnique({ where: { id }, select: { id: true } });
      if (!exists) {
        return res.status(404).json({ status: 'error', message: 'Ordem de serviço não encontrada.' });
      }

      const logs = await prisma.serviceOrderOperationLog.findMany({
        where: { serviceOrderId: id },
        include: {
          employee: {
            include: {
              person: { include: { naturalPerson: true, legalPerson: true } }
            }
          }
        },
        orderBy: { startAt: 'desc' },
      });

      return res.json(logs);
    } catch (error) {
      return res.status(500).json({ status: 'error', message: 'Erro ao listar apontamentos operacionais.' });
    }
  },

  async addOperation(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ status: 'error', message: 'ID de OS inválido.' });
      }

      const data = req.body || {};
      const actor = getActor(req);
      const operationType = String(data.operationType || '').toUpperCase();
      const shift = data.shift ? String(data.shift).toUpperCase() : null;
      const downtimeCategory = data.downtimeCategory ? String(data.downtimeCategory).toUpperCase() : null;
      const startAt = data.startAt ? new Date(data.startAt) : null;
      const endAt = data.endAt ? new Date(data.endAt) : null;
      const downtimeMinutes = Math.max(0, toNumber(data.downtimeMinutes));

      if (!OPERATION_TYPES.includes(operationType)) {
        return res.status(400).json({ status: 'error', message: 'Tipo de operação inválido.' });
      }
      if (shift && !SHIFTS.includes(shift)) {
        return res.status(400).json({ status: 'error', message: 'Turno inválido.' });
      }
      if (downtimeCategory && !DOWNTIME_CATEGORIES.includes(downtimeCategory)) {
        return res.status(400).json({ status: 'error', message: 'Categoria de parada inválida.' });
      }
      if (!startAt || Number.isNaN(startAt.getTime())) {
        return res.status(400).json({ status: 'error', message: 'Data/hora de início inválida.' });
      }
      if (endAt && Number.isNaN(endAt.getTime())) {
        return res.status(400).json({ status: 'error', message: 'Data/hora de fim inválida.' });
      }
      if (endAt && endAt < startAt) {
        return res.status(400).json({ status: 'error', message: 'Fim não pode ser menor que início.' });
      }

      const employeeId = data.employeeId ? Number(data.employeeId) : null;
      if (employeeId && (!Number.isFinite(employeeId) || employeeId <= 0)) {
        return res.status(400).json({ status: 'error', message: 'Funcionário inválido.' });
      }

      const result = await prisma.$transaction(async (tx) => {
        const order = await tx.serviceOrder.findUnique({ where: { id } });
        if (!order) throw new Error('NOT_FOUND');

        if (employeeId) {
          const employee = await tx.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
          if (!employee) throw new Error('EMPLOYEE_NOT_FOUND');
        }

        const calculatedWorkedHours = endAt
          ? Math.max(0, ((endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60)) - (downtimeMinutes / 60))
          : null;

        const created = await tx.serviceOrderOperationLog.create({
          data: {
            serviceOrderId: id,
            employeeId,
            operationType,
            shift,
            startAt,
            endAt,
            workedHours: data.workedHours !== undefined && data.workedHours !== null
              ? Math.max(0, toNumber(data.workedHours))
              : calculatedWorkedHours,
            downtimeMinutes,
            downtimeCategory,
            downtimeReason: data.downtimeReason ? String(data.downtimeReason) : null,
            notes: data.notes ? String(data.notes) : null,
          },
          include: {
            employee: {
              include: {
                person: { include: { naturalPerson: true, legalPerson: true } }
              }
            }
          }
        });

        await (tx.serviceOrderTrace as any).create({
          data: {
            serviceOrderId: id,
            serviceOrderCode: order.traceCode,
            action: 'OP_LOG_CREATE',
            changedByUserId: actor.id,
            changedByEmail: actor.email,
            payload: {
              operationType,
              shift,
              startAt,
              endAt,
              workedHours: created.workedHours,
              downtimeMinutes,
              downtimeCategory,
              employeeId,
            }
          }
        });

        return created;
      });

      return res.status(201).json(result);
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        return res.status(404).json({ status: 'error', message: 'Ordem de serviço não encontrada.' });
      }
      if (error.message === 'EMPLOYEE_NOT_FOUND') {
        return res.status(404).json({ status: 'error', message: 'Funcionário não encontrado.' });
      }

      return res.status(400).json({ status: 'error', message: 'Erro ao registrar apontamento operacional.', details: error.message });
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
  },

  async list(req: Request, res: Response) {
    try {
      const orders = await prisma.serviceOrder.findMany({
        include: {
          person: { include: { naturalPerson: true, legalPerson: true } },
          services: { include: { service: true, employee: true } },
          materials: { include: { material: true } },
          qualityControls: true,
          transactions: true,
          traces: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              action: true,
              changedByEmail: true,
              createdAt: true,
            },
          }
        },
        orderBy: { openingDate: 'desc' }
      });
      res.json(orders.map(enrichFinancials));
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao listar ordens de serviço.' });
    }
  },

  async get(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const order = await prisma.serviceOrder.findUnique({
        where: { id },
        include: {
          person: { include: { naturalPerson: true, legalPerson: true } },
          services: { include: { service: true, employee: true } },
          materials: { include: { material: true } },
          qualityControls: true,
          transactions: true,
          traces: {
            orderBy: { createdAt: 'desc' },
          }
        }
      });
      if (!order) return res.status(404).json({ status: 'error', message: 'Ordem de serviço não encontrada' });
      res.json(enrichFinancials(order));
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao buscar ordem de serviço.' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const data = req.body;
      const actor = getActor(req);
      const traceCode = typeof data.traceCode === 'string' && data.traceCode.trim()
        ? data.traceCode.trim().toUpperCase()
        : generateTraceCode();

      const order = await prisma.$transaction(async (tx) => {
        const created = await (tx.serviceOrder as any).create({
          data: {
            traceCode,
            partCode: data.partCode || null,
            batchCode: data.batchCode || null,
            workCenter: data.workCenter || null,
            plannedStartDate: data.plannedStartDate ? new Date(data.plannedStartDate) : null,
            plannedEndDate: data.plannedEndDate ? new Date(data.plannedEndDate) : null,
            plannedHours: data.plannedHours !== undefined && data.plannedHours !== null ? Number(data.plannedHours) : null,
            description: data.description,
            personId: Number(data.personId),
            status: data.status,
            openingDate: data.openingDate ? new Date(data.openingDate) : new Date(),
            closingDate: data.closingDate ? new Date(data.closingDate) : undefined,
            problemDescription: data.problemDescription,
            technicalDiagnosis: data.technicalDiagnosis,
            taxPercent: Number(data.taxPercent) || 0,
            profitPercent: Number(data.profitPercent) || 0,
            services: { create: (data.services || []).map((s: any) => ({
              serviceId: Number(s.serviceId),
              employeeId: s.employeeId ? Number(s.employeeId) : null,
              description: s.description,
              hoursWorked: Number(s.hoursWorked) || 0,
              unitPrice: Number(s.unitPrice) || 0,
              totalPrice: Number(s.totalPrice) || 0
            })) },
            materials: { create: (data.materials || []).map((m: any) => ({
              materialId: Number(m.materialId),
              quantity: Number(m.quantity) || 0,
              unitPrice: Number(m.unitPrice) || 0,
              totalPrice: Number(m.totalPrice) || 0
            })) },
          }
        });

        await (tx.serviceOrderTrace as any).create({
          data: {
            serviceOrderId: created.id,
            serviceOrderCode: created.traceCode,
            action: 'CREATE',
            changedByUserId: actor.id,
            changedByEmail: actor.email,
            payload: {
              status: created.status,
              partCode: created.partCode,
              batchCode: created.batchCode,
              workCenter: created.workCenter,
              plannedStartDate: created.plannedStartDate,
              plannedEndDate: created.plannedEndDate,
              plannedHours: created.plannedHours,
            }
          }
        });

        return tx.serviceOrder.findUnique({
          where: { id: created.id },
          include: {
            person: { include: { naturalPerson: true, legalPerson: true } },
            services: { include: { service: true, employee: true } },
            materials: { include: { material: true } },
            qualityControls: true,
            transactions: true,
            traces: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            }
          }
        });
      });

      res.status(201).json(enrichFinancials(order));
    } catch (error: any) {
      console.error('Erro ao criar OS:', error);
      res.status(400).json({ status: 'error', message: 'Erro ao criar ordem de serviço.', details: error.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const data = req.body;
      const actor = getActor(req);

      const order = await prisma.$transaction(async (tx) => {
        const updated = await (tx.serviceOrder as any).update({
          where: { id },
          data: {
            traceCode: data.traceCode ? String(data.traceCode).trim().toUpperCase() : undefined,
            partCode: data.partCode !== undefined ? data.partCode : undefined,
            batchCode: data.batchCode !== undefined ? data.batchCode : undefined,
            workCenter: data.workCenter !== undefined ? data.workCenter : undefined,
            plannedStartDate: data.plannedStartDate !== undefined
              ? (data.plannedStartDate ? new Date(data.plannedStartDate) : null)
              : undefined,
            plannedEndDate: data.plannedEndDate !== undefined
              ? (data.plannedEndDate ? new Date(data.plannedEndDate) : null)
              : undefined,
            plannedHours: data.plannedHours !== undefined
              ? (data.plannedHours !== null ? Number(data.plannedHours) : null)
              : undefined,
            description: data.description,
            personId: Number(data.personId),
            status: data.status,
            openingDate: data.openingDate ? new Date(data.openingDate) : undefined,
            closingDate: data.closingDate ? new Date(data.closingDate) : undefined,
            problemDescription: data.problemDescription,
            technicalDiagnosis: data.technicalDiagnosis,
            taxPercent: Number(data.taxPercent) || 0,
            profitPercent: Number(data.profitPercent) || 0
          }
        });

        if (data.services) {
          await tx.serviceOrderService.deleteMany({ where: { serviceOrderId: id } });
          await tx.serviceOrderService.createMany({
            data: data.services.map((s: any) => ({
              serviceOrderId: id,
              serviceId: Number(s.serviceId),
              employeeId: s.employeeId ? Number(s.employeeId) : null,
              description: s.description,
              hoursWorked: Number(s.hoursWorked) || 0,
              unitPrice: Number(s.unitPrice) || 0,
              totalPrice: Number(s.totalPrice) || 0
            }))
          });
        }

        if (data.materials) {
          await tx.serviceOrderMaterial.deleteMany({ where: { serviceOrderId: id } });
          await tx.serviceOrderMaterial.createMany({
            data: data.materials.map((m: any) => ({
              serviceOrderId: id,
              materialId: Number(m.materialId),
              quantity: Number(m.quantity) || 0,
              unitPrice: Number(m.unitPrice) || 0,
              totalPrice: Number(m.totalPrice) || 0
            }))
          });
        }

        await (tx.serviceOrderTrace as any).create({
          data: {
            serviceOrderId: id,
            serviceOrderCode: updated.traceCode,
            action: 'UPDATE',
            changedByUserId: actor.id,
            changedByEmail: actor.email,
            payload: {
              status: updated.status,
              partCode: updated.partCode,
              batchCode: updated.batchCode,
              workCenter: updated.workCenter,
              plannedStartDate: updated.plannedStartDate,
              plannedEndDate: updated.plannedEndDate,
              plannedHours: updated.plannedHours,
            }
          }
        });

        return tx.serviceOrder.findUnique({
          where: { id },
          include: {
            person: { include: { naturalPerson: true, legalPerson: true } },
            services: { include: { service: true, employee: true } },
            materials: { include: { material: true } },
            qualityControls: true,
            transactions: true,
            traces: {
              orderBy: { createdAt: 'desc' },
              take: 20,
            }
          }
        });
      });

      res.json(enrichFinancials(order));
    } catch (error: any) {
      console.error('Erro ao atualizar OS:', error);
      res.status(400).json({ status: 'error', message: 'Erro ao atualizar ordem de serviço.', details: error.message });
    }
  },

  async updatePlan(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ status: 'error', message: 'ID de OS inválido.' });
      }

      const data = req.body || {};
      const actor = getActor(req);

      const order = await prisma.$transaction(async (tx) => {
        const existing = await tx.serviceOrder.findUnique({ where: { id } });
        if (!existing) {
          throw new Error('NOT_FOUND');
        }

        const targetWorkCenter = data.workCenter !== undefined ? (data.workCenter || null) : (existing.workCenter || null);
        const targetPlannedStartDate = data.plannedStartDate !== undefined
          ? (data.plannedStartDate ? new Date(data.plannedStartDate) : null)
          : existing.plannedStartDate;
        const targetPlannedEndDate = data.plannedEndDate !== undefined
          ? (data.plannedEndDate ? new Date(data.plannedEndDate) : null)
          : existing.plannedEndDate;

        if (targetPlannedStartDate && targetPlannedEndDate && targetPlannedStartDate > targetPlannedEndDate) {
          throw new Error('INVALID_PLAN_WINDOW');
        }

        if (hasValidPlanWindow(targetWorkCenter, targetPlannedStartDate, targetPlannedEndDate)) {
          const conflicts = await findPlanConflicts(tx, {
            workCenter: String(targetWorkCenter),
            plannedStartDate: targetPlannedStartDate as Date,
            plannedEndDate: targetPlannedEndDate as Date,
            excludeIds: [id],
          });

          if (conflicts.length) {
            const err: any = new Error('PLAN_CONFLICT');
            err.conflicts = conflicts;
            throw err;
          }
        }

        const updated = await tx.serviceOrder.update({
          where: { id },
          data: {
            workCenter: data.workCenter !== undefined ? (data.workCenter || null) : undefined,
            plannedStartDate: data.plannedStartDate !== undefined
              ? (data.plannedStartDate ? new Date(data.plannedStartDate) : null)
              : undefined,
            plannedEndDate: data.plannedEndDate !== undefined
              ? (data.plannedEndDate ? new Date(data.plannedEndDate) : null)
              : undefined,
            plannedHours: data.plannedHours !== undefined
              ? (data.plannedHours !== null ? Number(data.plannedHours) : null)
              : undefined,
          }
        });

        await (tx.serviceOrderTrace as any).create({
          data: {
            serviceOrderId: id,
            serviceOrderCode: updated.traceCode,
            action: 'PLAN_UPDATE',
            changedByUserId: actor.id,
            changedByEmail: actor.email,
            payload: {
              workCenter: updated.workCenter,
              plannedStartDate: updated.plannedStartDate,
              plannedEndDate: updated.plannedEndDate,
              plannedHours: updated.plannedHours,
            }
          }
        });

        return tx.serviceOrder.findUnique({
          where: { id },
          include: {
            person: { include: { naturalPerson: true, legalPerson: true } },
            services: { include: { service: true, employee: true } },
            materials: { include: { material: true } },
            qualityControls: true,
            transactions: true,
            traces: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            }
          }
        });
      });

      return res.json(enrichFinancials(order));
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        return res.status(404).json({ status: 'error', message: 'Ordem de serviço não encontrada.' });
      }

      if (error.message === 'INVALID_PLAN_WINDOW') {
        return res.status(400).json({ status: 'error', message: 'Janela de planejamento inválida: início maior que fim.' });
      }

      if (error.message === 'PLAN_CONFLICT') {
        return res.status(409).json({
          status: 'error',
          message: 'Conflito de agenda no centro de trabalho para o período informado.',
          conflicts: error.conflicts || [],
        });
      }

      return res.status(400).json({ status: 'error', message: 'Erro ao atualizar planejamento da OS.', details: error.message });
    }
  },

  async updatePlanBatch(req: Request, res: Response) {
    try {
      const data = req.body || {};
      const actor = getActor(req);
      const idsInput = Array.isArray(data.ids) ? data.ids : [];
      const parsedIds = idsInput
        .map((v: unknown) => Number(v))
        .filter((v: number) => Number.isFinite(v) && v > 0);
      const ids: number[] = Array.from(new Set(parsedIds));

      if (!ids.length) {
        return res.status(400).json({ status: 'error', message: 'Informe ao menos uma OS para replanejamento em lote.' });
      }

      const updateData: any = {};
      if (data.workCenter !== undefined) {
        updateData.workCenter = data.workCenter || null;
      }
      if (data.plannedStartDate !== undefined) {
        updateData.plannedStartDate = data.plannedStartDate ? new Date(data.plannedStartDate) : null;
      }
      if (data.plannedEndDate !== undefined) {
        updateData.plannedEndDate = data.plannedEndDate ? new Date(data.plannedEndDate) : null;
      }
      if (data.plannedHours !== undefined) {
        updateData.plannedHours = data.plannedHours !== null ? Number(data.plannedHours) : null;
      }

      if (!Object.keys(updateData).length) {
        return res.status(400).json({ status: 'error', message: 'Nenhum campo de planejamento foi informado para atualização.' });
      }

      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.serviceOrder.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            traceCode: true,
            workCenter: true,
            plannedStartDate: true,
            plannedEndDate: true,
          }
        });

        const existingIds = existing.map((o) => o.id);
        const notFoundIds = ids.filter((id) => !existingIds.includes(id));

        if (!existingIds.length) {
          throw new Error('NOT_FOUND');
        }

        const targetPlans = existing.map((order) => {
          const targetWorkCenter = data.workCenter !== undefined ? (data.workCenter || null) : order.workCenter;
          const targetPlannedStartDate = data.plannedStartDate !== undefined
            ? (data.plannedStartDate ? new Date(data.plannedStartDate) : null)
            : order.plannedStartDate;
          const targetPlannedEndDate = data.plannedEndDate !== undefined
            ? (data.plannedEndDate ? new Date(data.plannedEndDate) : null)
            : order.plannedEndDate;

          return {
            id: order.id,
            traceCode: order.traceCode,
            workCenter: targetWorkCenter,
            plannedStartDate: targetPlannedStartDate,
            plannedEndDate: targetPlannedEndDate,
          };
        });

        const invalidWindow = targetPlans.find((p) => p.plannedStartDate && p.plannedEndDate && p.plannedStartDate > p.plannedEndDate);
        if (invalidWindow) {
          throw new Error('INVALID_PLAN_WINDOW');
        }

        const completeTargetPlans = targetPlans.filter((p) =>
          hasValidPlanWindow(p.workCenter || null, p.plannedStartDate || null, p.plannedEndDate || null)
        );

        const externalConflicts: Array<{ id: number; conflicts: any[] }> = [];

        for (const targetPlan of completeTargetPlans) {
          const conflicts = await findPlanConflicts(tx, {
            workCenter: String(targetPlan.workCenter),
            plannedStartDate: targetPlan.plannedStartDate as Date,
            plannedEndDate: targetPlan.plannedEndDate as Date,
            excludeIds: existingIds,
          });

          if (conflicts.length) {
            externalConflicts.push({ id: targetPlan.id, conflicts });
          }
        }

        const internalConflicts: Array<{ leftId: number; rightId: number; workCenter: string }> = [];
        for (let i = 0; i < completeTargetPlans.length; i += 1) {
          for (let j = i + 1; j < completeTargetPlans.length; j += 1) {
            const left = completeTargetPlans[i];
            const right = completeTargetPlans[j];
            if (left.workCenter !== right.workCenter) continue;

            if (overlaps(
              left.plannedStartDate as Date,
              left.plannedEndDate as Date,
              right.plannedStartDate as Date,
              right.plannedEndDate as Date,
            )) {
              internalConflicts.push({
                leftId: left.id,
                rightId: right.id,
                workCenter: String(left.workCenter),
              });
            }
          }
        }

        if (externalConflicts.length || internalConflicts.length) {
          const err: any = new Error('PLAN_CONFLICT');
          err.externalConflicts = externalConflicts;
          err.internalConflicts = internalConflicts;
          throw err;
        }

        await tx.serviceOrder.updateMany({
          where: { id: { in: existingIds } },
          data: updateData,
        });

        await (tx.serviceOrderTrace as any).createMany({
          data: existingIds.map((id) => {
            const current = existing.find((o) => o.id === id);
            return {
              serviceOrderId: id,
              serviceOrderCode: current?.traceCode || null,
              action: 'PLAN_BATCH_UPDATE',
              changedByUserId: actor.id,
              changedByEmail: actor.email,
              payload: {
                workCenter: updateData.workCenter,
                plannedStartDate: updateData.plannedStartDate,
                plannedEndDate: updateData.plannedEndDate,
                plannedHours: updateData.plannedHours,
              }
            };
          })
        });

        return {
          updatedCount: existingIds.length,
          notFoundIds,
        };
      });

      return res.json(result);
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        return res.status(404).json({ status: 'error', message: 'Nenhuma OS encontrada para os IDs enviados.' });
      }

      if (error.message === 'INVALID_PLAN_WINDOW') {
        return res.status(400).json({ status: 'error', message: 'Janela de planejamento inválida: início maior que fim.' });
      }

      if (error.message === 'PLAN_CONFLICT') {
        return res.status(409).json({
          status: 'error',
          message: 'Conflito de agenda detectado para o replanejamento em lote.',
          externalConflicts: error.externalConflicts || [],
          internalConflicts: error.internalConflicts || [],
        });
      }

      return res.status(400).json({ status: 'error', message: 'Erro ao atualizar planejamento em lote.', details: error.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const actor = getActor(req);

      await prisma.$transaction(async (tx) => {
        const existing = await tx.serviceOrder.findUnique({ where: { id } });
        if (!existing) {
          throw new Error('NOT_FOUND');
        }

        await (tx.serviceOrderTrace as any).create({
          data: {
            serviceOrderId: id,
            serviceOrderCode: existing.traceCode,
            action: 'DELETE',
            changedByUserId: actor.id,
            changedByEmail: actor.email,
            payload: {
              status: existing.status,
              partCode: existing.partCode,
              batchCode: existing.batchCode,
            }
          }
        });

        await tx.serviceOrder.delete({ where: { id } });
      });

      res.status(204).end();
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        return res.status(404).json({ status: 'error', message: 'Ordem de serviço não encontrada.' });
      }
      res.status(500).json({ status: 'error', message: 'Erro ao excluir ordem de serviço.' });
    }
  },
};
