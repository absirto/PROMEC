import prisma from '../../../core/prisma';

export const EmployeeService = {
  async list(skip?: number, take?: number) {
    return Promise.all([
      prisma.employee.findMany({
        include: {
          person: { include: { naturalPerson: true } },
          jobRole: true,
          workArea: true,
          user: true
        },
        skip,
        take,
        orderBy: { person: { naturalPerson: { name: 'asc' } } }
      }),
      prisma.employee.count()
    ]);
  },
  async get(id: number) {
    return prisma.employee.findUnique({
      where: { id },
      include: {
        person: { include: { naturalPerson: true } },
        jobRole: true,
        workArea: true,
        user: true
      }
    });
  },
  async create(data: any) {
    return prisma.employee.create({
      data: {
        personId: data.personId,
        jobRoleId: data.jobRoleId,
        workAreaId: data.workAreaId,
        userId: data.userId || undefined,
        status: data.status,
        matricula: data.matricula
      },
      include: {
        person: { include: { naturalPerson: true } },
        jobRole: true,
        workArea: true,
        user: true
      }
    });
  },
  async update(id: number, data: any) {
    return prisma.employee.update({
      where: { id },
      data: {
        jobRoleId: data.jobRoleId,
        workAreaId: data.workAreaId,
        userId: data.userId || undefined,
        status: data.status,
        matricula: data.matricula
      },
      include: {
        person: { include: { naturalPerson: true } },
        jobRole: true,
        workArea: true,
        user: true
      }
    });
  },
  async delete(id: number) {
    // 1. Verificar se está vinculado a inspeções de qualidade
    const qcCount = await prisma.qualityControl.count({
      where: { inspectorId: id }
    });
    if (qcCount > 0) {
      throw new Error(`Não é possível excluir: funcionário vinculado a ${qcCount} inspeção(ões) de qualidade.`);
    }

    // 2. Verificar se possui registros de operação (apontamentos)
    const logCount = await prisma.serviceOrderOperationLog.count({
      where: { employeeId: id }
    });
    if (logCount > 0) {
      throw new Error(`Não é possível excluir: funcionário possui ${logCount} registro(s) de operação em Ordens de Serviço.`);
    }

    // 3. Verificar se está vinculado a serviços prestados em OS
    const serviceCount = await prisma.serviceOrderService.count({
      where: { employeeId: id }
    });
    if (serviceCount > 0) {
      throw new Error(`Não é possível excluir: funcionário vinculado a ${serviceCount} serviço(s) em Ordens de Serviço.`);
    }

    return prisma.employee.delete({ where: { id } });
  },
};