import prisma from '../../../core/prisma';

export const PCPService = {
  hasValidPlanWindow(workCenter: string | null, plannedStartDate: Date | null, plannedEndDate: Date | null) {
    return Boolean(workCenter && plannedStartDate && plannedEndDate);
  },

  overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
    return startA <= endB && endA >= startB;
  },

  async findPlanConflicts(
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
};
