import prisma from '../../services/prisma';

export const EmployeeService = {
  async list() {
    return prisma.employee.findMany({
      include: {
        person: { include: { naturalPerson: true } },
        jobRole: true,
        workArea: true,
        user: true
      }
    });
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
    return prisma.employee.delete({ where: { id } });
  },
};