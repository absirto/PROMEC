import prisma from '../../../core/prisma';
import { PCPService } from './PCPService';
import { AuditService } from '../../Audit/services/AuditService';

function generateTraceCode() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `OS-${y}${m}${day}-${rand}`;
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export const ServiceOrderService = {
  async create(data: any, actor: any) {
    const traceCode = typeof data.traceCode === 'string' && data.traceCode.trim()
      ? data.traceCode.trim().toUpperCase()
      : generateTraceCode();

    return prisma.$transaction(async (tx) => {
      if (PCPService.hasValidPlanWindow(data.workCenter, data.plannedStartDate, data.plannedEndDate)) {
        const conflicts = await PCPService.findPlanConflicts(tx, {
          workCenter: data.workCenter,
          plannedStartDate: new Date(data.plannedStartDate),
          plannedEndDate: new Date(data.plannedEndDate)
        });
        // We log conflicts but do not throw, matching original behavior
      }

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
          payload: created
        }
      });

      await AuditService.log({
        entity: 'ServiceOrder',
        entityId: created.id,
        action: 'CREATE',
        userId: actor.id,
        userEmail: actor.email,
        newData: created,
      }, tx);

      return tx.serviceOrder.findUnique({
        where: { id: created.id },
        include: {
          person: { include: { naturalPerson: true, legalPerson: true } },
          services: { include: { service: true, employee: true } },
          materials: { include: { material: true } },
        }
      });
    });
  },

  async update(id: number, data: any, actor: any) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.serviceOrder.findUnique({ where: { id } });
      if (!existing) {
        throw new Error('NOT_FOUND');
      }

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
  },

  async updatePlan(id: number, data: any, actor: any) {
    return prisma.$transaction(async (tx) => {
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

      if (PCPService.hasValidPlanWindow(targetWorkCenter, targetPlannedStartDate, targetPlannedEndDate)) {
        const conflicts = await PCPService.findPlanConflicts(tx, {
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
  },

  async updatePlanBatch(ids: number[], data: any, actor: any) {
    const updateData: any = {};
    if (data.workCenter !== undefined) updateData.workCenter = data.workCenter || null;
    if (data.plannedStartDate !== undefined) updateData.plannedStartDate = data.plannedStartDate ? new Date(data.plannedStartDate) : null;
    if (data.plannedEndDate !== undefined) updateData.plannedEndDate = data.plannedEndDate ? new Date(data.plannedEndDate) : null;
    if (data.plannedHours !== undefined) updateData.plannedHours = data.plannedHours !== null ? Number(data.plannedHours) : null;

    if (!Object.keys(updateData).length) {
      throw new Error('NO_DATA');
    }

    return prisma.$transaction(async (tx) => {
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
        PCPService.hasValidPlanWindow(p.workCenter || null, p.plannedStartDate || null, p.plannedEndDate || null)
      );

      const externalConflicts: Array<{ id: number; conflicts: any[] }> = [];

      for (const targetPlan of completeTargetPlans) {
        const conflicts = await PCPService.findPlanConflicts(tx, {
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

          if (PCPService.overlaps(
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
  },

  async addOperation(id: number, data: any, actor: any) {
    const operationType = String(data.operationType || '').toUpperCase();
    const shift = data.shift ? String(data.shift).toUpperCase() : null;
    const downtimeCategory = data.downtimeCategory ? String(data.downtimeCategory).toUpperCase() : null;
    const startAt = data.startAt ? new Date(data.startAt) : null;
    const endAt = data.endAt ? new Date(data.endAt) : null;
    const downtimeMinutes = Math.max(0, toNumber(data.downtimeMinutes));

    const OPERATION_TYPES = ['USINAGEM', 'CALDEIRARIA', 'MONTAGEM'];
    const SHIFTS = ['MORNING', 'AFTERNOON', 'NIGHT'];
    const DOWNTIME_CATEGORIES = ['MACHINE', 'MATERIAL', 'SETUP', 'RETRABALHO', 'QUALIDADE', 'OUTROS'];

    if (!OPERATION_TYPES.includes(operationType)) throw new Error('INVALID_OPERATION_TYPE');
    if (shift && !SHIFTS.includes(shift)) throw new Error('INVALID_SHIFT');
    if (downtimeCategory && !DOWNTIME_CATEGORIES.includes(downtimeCategory)) throw new Error('INVALID_DOWNTIME_CATEGORY');
    if (!startAt || Number.isNaN(startAt.getTime())) throw new Error('INVALID_START_DATE');
    if (endAt && Number.isNaN(endAt.getTime())) throw new Error('INVALID_END_DATE');
    if (endAt && endAt < startAt) throw new Error('END_BEFORE_START');

    const employeeId = data.employeeId ? Number(data.employeeId) : null;
    if (employeeId && (!Number.isFinite(employeeId) || employeeId <= 0)) throw new Error('INVALID_EMPLOYEE');

    return prisma.$transaction(async (tx) => {
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
  },

  async delete(id: number, actor: any) {
    return prisma.$transaction(async (tx) => {
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
  }
};
