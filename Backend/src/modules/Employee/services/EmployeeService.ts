import prisma from '../../../core/prisma';
import { AuditService } from '../../Audit/services/AuditService';

type Actor = { id?: number; email?: string };

const employeeInclude = {
  person: { include: { naturalPerson: true } },
  jobRole: true,
  workArea: true,
  user: true
};

export const EmployeeService = {
  async list(skip?: number, take?: number) {
    return Promise.all([
      prisma.employee.findMany({
        include: employeeInclude,
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
      include: employeeInclude
    });
  },
  async create(data: any, actor?: Actor) {
    const employee = await prisma.employee.create({
      data: {
        personId: data.personId,
        jobRoleId: data.jobRoleId,
        workAreaId: data.workAreaId,
        userId: data.userId || undefined,
        status: data.status,
        matricula: data.matricula
      },
      include: employeeInclude
    });

    await AuditService.log({
      entity: 'Employee',
      entityId: employee.id,
      action: 'CREATE',
      userId: actor?.id,
      userEmail: actor?.email,
      newData: employee,
    });

    return employee;
  },
  async update(id: number, data: any, actor?: Actor) {
    const oldEmployee = await prisma.employee.findUnique({ where: { id }, include: employeeInclude });
    if (!oldEmployee) {
      throw new Error('NOT_FOUND');
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        jobRoleId: data.jobRoleId,
        workAreaId: data.workAreaId,
        userId: data.userId || undefined,
        status: data.status,
        matricula: data.matricula
      },
      include: employeeInclude
    });

    await AuditService.log({
      entity: 'Employee',
      entityId: employee.id,
      action: 'UPDATE',
      userId: actor?.id,
      userEmail: actor?.email,
      oldData: oldEmployee,
      newData: employee,
    });

    return employee;
  },
  async delete(id: number, actor?: Actor) {
    const oldEmployee = await prisma.employee.findUnique({ where: { id }, include: employeeInclude });
    if (!oldEmployee) {
      throw new Error('NOT_FOUND');
    }

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

    const deleted = await prisma.employee.delete({ where: { id } });

    await AuditService.log({
      entity: 'Employee',
      entityId: id,
      action: 'DELETE',
      userId: actor?.id,
      userEmail: actor?.email,
      oldData: oldEmployee,
    });

    return deleted;
  },
};
