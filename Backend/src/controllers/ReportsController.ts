import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../services/prisma';
import { generateAccountsPDF } from '../utils/pdfAccounts';
import { getSettings } from '../utils/pdfSettings';
import { generateUsersSummaryPDF } from '../utils/pdfUsersSummary';
import { generateTeamPerformancePDF } from '../utils/pdfTeamPerformance';
import { generateFinancialFlowPDF } from '../utils/pdfFinancialFlow';
import { generateStockMovementsPDF } from '../utils/pdfStockMovements';
import { generateServiceOrdersPDF } from '../utils/pdfServiceOrders';
import { generatePurchasesPDF } from '../utils/pdfPurchases';
import { AuthRequest } from '../middleware/auth';

function getReportActor(req: Request) {
  const authReq = req as AuthRequest;
  return {
    id: authReq.user?.id ? Number(authReq.user.id) : null,
    email: authReq.user?.email ? String(authReq.user.email) : null,
    fullName: [authReq.user?.firstName, authReq.user?.lastName].filter(Boolean).join(' ').trim() || authReq.user?.email || 'Usuário autenticado',
  };
}

async function registerReportEmission(params: {
  reportKey: string;
  exportFormat: string;
  fileName?: string | null;
  fileHash?: string | null;
  filters?: any;
  generatedByUserId?: number | null;
  generatedByEmail?: string | null;
}) {
  await (prisma as any).reportEmission.create({
    data: {
      reportKey: params.reportKey,
      exportFormat: params.exportFormat,
      fileName: params.fileName || null,
      fileHash: params.fileHash || null,
      filters: params.filters || null,
      generatedByUserId: params.generatedByUserId || null,
      generatedByEmail: params.generatedByEmail || null,
    }
  });
}

export const ReportsController = {
  async listEmissions(req: Request, res: Response) {
    try {
      const reportKey = typeof req.query.reportKey === 'string' ? req.query.reportKey : undefined;
      const limit = req.query.limit ? Math.min(100, Math.max(1, Number(req.query.limit))) : 20;
      const where: any = {};
      if (reportKey) where.reportKey = reportKey;

      const emissions = await (prisma as any).reportEmission.findMany({
        where,
        include: {
          generatedBy: {
            select: { id: true, firstName: true, lastName: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return res.json(emissions.map((emission: any) => ({
        ...emission,
        generatedByName: emission.generatedBy ? `${emission.generatedBy.firstName || ''} ${emission.generatedBy.lastName || ''}`.trim() || emission.generatedBy.email : emission.generatedByEmail,
      })));
    } catch {
      return res.status(500).json({ error: 'Erro ao listar histórico de emissões.' });
    }
  },

  async registerEmission(req: Request, res: Response) {
    try {
      const actor = getReportActor(req);
      const reportKey = req.body?.reportKey ? String(req.body.reportKey) : '';
      const exportFormat = req.body?.exportFormat ? String(req.body.exportFormat).toUpperCase() : '';
      if (!reportKey || !exportFormat) {
        return res.status(400).json({ error: 'reportKey e exportFormat são obrigatórios.' });
      }

      await registerReportEmission({
        reportKey,
        exportFormat,
        fileName: req.body?.fileName ? String(req.body.fileName) : null,
        fileHash: req.body?.fileHash ? String(req.body.fileHash) : null,
        filters: req.body?.filters || null,
        generatedByUserId: actor.id,
        generatedByEmail: actor.email,
      });

      return res.status(201).json({ status: 'success' });
    } catch {
      return res.status(500).json({ error: 'Erro ao registrar emissão de relatório.' });
    }
  },

  async operationalPurchases(req: Request, res: Response) {
    try {
      const { start, end, status, supplierPersonId } = req.query;
      const requestWhere: any = {};
      const historyWhere: any = { type: 'IN', unitCost: { not: null } };

      if (status) {
        requestWhere.status = status;
      }

      if (start) {
        const startDate = new Date(start as string);
        if (!Number.isNaN(startDate.getTime())) {
          requestWhere.createdAt = { ...(requestWhere.createdAt || {}), gte: startDate };
          historyWhere.createdAt = { ...(historyWhere.createdAt || {}), gte: startDate };
        }
      }

      if (end) {
        const endDate = new Date(end as string);
        if (!Number.isNaN(endDate.getTime())) {
          endDate.setHours(23, 59, 59, 999);
          requestWhere.createdAt = { ...(requestWhere.createdAt || {}), lte: endDate };
          historyWhere.createdAt = { ...(historyWhere.createdAt || {}), lte: endDate };
        }
      }

      if (supplierPersonId) {
        const parsedSupplierId = Number(supplierPersonId);
        if (Number.isFinite(parsedSupplierId) && parsedSupplierId > 0) {
          historyWhere.supplierPersonId = parsedSupplierId;
        }
      }

      const [purchaseRequests, purchaseHistory] = await Promise.all([
        (prisma as any).purchaseRequest.findMany({
          where: requestWhere,
          include: {
            serviceOrder: { select: { id: true, traceCode: true, description: true } },
            items: {
              include: { material: { select: { id: true, name: true, unit: true, price: true } } },
              orderBy: { id: 'asc' }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        (prisma as any).stockLog.findMany({
          where: historyWhere,
          include: {
            material: true,
            supplierPerson: {
              include: {
                naturalPerson: { select: { name: true } },
                legalPerson: { select: { corporateName: true } },
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        })
      ]);

      return res.json({
        purchaseRequests,
        purchaseHistory: purchaseHistory.map((log: any) => ({
          ...log,
          supplierName: log.supplierPerson?.naturalPerson?.name || log.supplierPerson?.legalPerson?.corporateName || null,
        }))
      });
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao gerar relatório operacional de compras.' });
    }
  },

  async operationalPurchasesPDF(req: Request, res: Response) {
    try {
      const actor = getReportActor(req);
      const emitterName = actor.fullName;
      const { start, end, status, supplierPersonId } = req.query;
      const requestWhere: any = {};
      const historyWhere: any = { type: 'IN', unitCost: { not: null } };
      let supplierName = 'Todos';

      if (status) {
        requestWhere.status = status;
      }

      if (start) {
        const startDate = new Date(start as string);
        if (!Number.isNaN(startDate.getTime())) {
          requestWhere.createdAt = { ...(requestWhere.createdAt || {}), gte: startDate };
          historyWhere.createdAt = { ...(historyWhere.createdAt || {}), gte: startDate };
        }
      }

      if (end) {
        const endDate = new Date(end as string);
        if (!Number.isNaN(endDate.getTime())) {
          endDate.setHours(23, 59, 59, 999);
          requestWhere.createdAt = { ...(requestWhere.createdAt || {}), lte: endDate };
          historyWhere.createdAt = { ...(historyWhere.createdAt || {}), lte: endDate };
        }
      }

      if (supplierPersonId) {
        const parsedSupplierId = Number(supplierPersonId);
        if (Number.isFinite(parsedSupplierId) && parsedSupplierId > 0) {
          historyWhere.supplierPersonId = parsedSupplierId;
          const supplier = await prisma.person.findUnique({
            where: { id: parsedSupplierId },
            include: { naturalPerson: true, legalPerson: true }
          });
          supplierName = supplier?.naturalPerson?.name || supplier?.legalPerson?.corporateName || 'Todos';
        }
      }

      const [purchaseRequests, purchaseHistory, settings] = await Promise.all([
        (prisma as any).purchaseRequest.findMany({
          where: requestWhere,
          include: {
            serviceOrder: { select: { id: true, traceCode: true, description: true } },
            items: {
              include: { material: { select: { id: true, name: true, unit: true, price: true } } },
              orderBy: { id: 'asc' }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        (prisma as any).stockLog.findMany({
          where: historyWhere,
          include: {
            material: true,
            supplierPerson: {
              include: {
                naturalPerson: { select: { name: true } },
                legalPerson: { select: { corporateName: true } },
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        getSettings(),
      ]);

      const normalizedHistory = purchaseHistory.map((log: any) => ({
        ...log,
        supplierName: log.supplierPerson?.naturalPerson?.name || log.supplierPerson?.legalPerson?.corporateName || null,
      }));

      const pdfBuffer = generatePurchasesPDF(
        purchaseRequests,
        normalizedHistory,
        {
          start: start as string,
          end: end as string,
          status: status as string,
          supplierName,
        },
        settings?.logoUrl ?? undefined,
        {
          companyName: settings?.companyName ?? undefined,
          cnpj: settings?.cnpj ?? undefined,
          phone: settings?.phone ?? undefined,
          contactEmail: settings?.contactEmail ?? undefined,
          address: settings?.address ?? undefined,
          emitterName,
        }
      );

      const fileHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
      await registerReportEmission({
        reportKey: 'purchases',
        exportFormat: 'PDF',
        fileName: 'relatorio_compras.pdf',
        fileHash,
        filters: { start, end, status, supplierPersonId },
        generatedByUserId: actor.id,
        generatedByEmail: actor.email,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="relatorio_compras.pdf"');
      res.setHeader('X-Report-Hash', fileHash);
      return res.send(pdfBuffer);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao gerar PDF do relatório de compras.' });
    }
  },

  // Relatório: Contas a receber/pagar (PDF)
  async adminAccountsPDF(req: Request, res: Response) {
    try {
      const { status } = req.query;
      const where: any = {};
      if (status) where.type = status;
      const accounts = await (prisma as any).transaction.findMany({
        where,
        orderBy: { date: 'asc' }
      });
      const settings = await getSettings();
      const pdfBuffer = await generateAccountsPDF(accounts, status as string, (settings?.logoUrl ?? undefined));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="relatorio_contas.pdf"');
      res.send(pdfBuffer);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao gerar PDF do relatório de contas.' });
    }
  },

  // Relatório: Resumo de usuários ativos (PDF)
  async adminUsersSummaryPDF(req: Request, res: Response) {
    try {
      const total = await (prisma as any).user.count();
      const admins = await (prisma as any).user.count({ where: { role: 'admin' } });
      const users = await (prisma as any).user.count({ where: { role: 'user' } });
      const settings = await getSettings();
      const pdfBuffer = generateUsersSummaryPDF({ total, admins, users }, (settings?.logoUrl ?? undefined));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="resumo_usuarios_ativos.pdf"');
      res.send(pdfBuffer);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao gerar PDF do resumo de usuários.' });
    }
  },

  // Relatório: Desempenho de equipes (PDF)
  async adminTeamPerformancePDF(req: Request, res: Response) {
    try {
      const performance = await (prisma as any).serviceOrderService.groupBy({
        by: ['employeeId'],
        _count: { _all: true }
      });
      const settings = await getSettings();
      const pdfBuffer = await generateTeamPerformancePDF(performance, (settings?.logoUrl ?? undefined));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="relatorio_desempenho_equipes.pdf"');
      res.send(pdfBuffer);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao gerar PDF do relatório de desempenho.' });
    }
  },

  // Relatório: Fluxo financeiro (PDF)
  async adminFinancialFlowPDF(req: Request, res: Response) {
    try {
      const { start, end } = req.query;
      const where: any = {};
      if (start && end) {
        where.date = {
          gte: new Date(start as string),
          lte: new Date(end as string)
        };
      }
      const transactions = await (prisma as any).transaction.findMany({ where });
      const summary = transactions.reduce((acc: any, current: any) => {
        if (current.type === 'RECEIVABLE') acc.totalIncome += current.amount;
        else acc.totalExpense += current.amount;
        return acc;
      }, { totalIncome: 0, totalExpense: 0 });
      summary.balance = summary.totalIncome - summary.totalExpense;
      const settings = await getSettings();
      const pdfBuffer = await generateFinancialFlowPDF(summary, start as string, end as string, (settings?.logoUrl ?? undefined));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="relatorio_fluxo_financeiro.pdf"');
      res.send(pdfBuffer);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao gerar PDF do relatório financeiro.' });
    }
  },

  // Relatório: Movimentação de Estoque (PDF)
  async operationalStockMovementsPDF(req: Request, res: Response) {
    try {
      const { start, end } = req.query;
      const where: any = {};
      if (start && end) {
        where.createdAt = {
          gte: new Date(start as string),
          lte: new Date(end as string)
        };
      }
      const logs = await (prisma as any).stockLog.findMany({
        where,
        include: { material: true },
        orderBy: { createdAt: 'desc' }
      });
      const settings = await getSettings();
      const pdfBuffer = await generateStockMovementsPDF(logs, start as string, end as string, (settings?.logoUrl ?? undefined));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="relatorio_movimentacao_estoque.pdf"');
      res.send(pdfBuffer);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao gerar PDF do relatório de estoque.' });
    }
  },

  // Relatório: Ordens de OS (PDF)
  async operationalServiceOrdersPDF(req: Request, res: Response) {
    try {
      const { start, end } = req.query;
      const where: any = {};
      if (start && end) {
        where.openingDate = {
          gte: new Date(start as string),
          lte: new Date(end as string)
        };
      }
      const byStatus = await (prisma as any).serviceOrder.groupBy({
        by: ['status'],
        _count: { _all: true },
        where
      });
      const settings = await getSettings();
      const pdfBuffer = await generateServiceOrdersPDF(byStatus, start as string, end as string, (settings?.logoUrl ?? undefined));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="relatorio_ordens_servico.pdf"');
      res.send(pdfBuffer);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao gerar PDF do relatório de ordens de serviço.' });
    }
  },

  // Relatório: Ordens de Serviço por status e período
  async operationalServiceOrders(req: Request, res: Response) {
    try {
      const { start, end } = req.query;
      const where: any = {};
      if (start && end) {
        where.openingDate = {
          gte: new Date(start as string),
          lte: new Date(end as string)
        };
      }
      const byStatus = await (prisma as any).serviceOrder.groupBy({
        by: ['status'],
        _count: { _all: true },
        where
      });
      res.json(byStatus);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao gerar relatório de ordens de serviço.' });
    }
  },

  // Relatório: Movimentação de Estoque
  async operationalStockMovements(req: Request, res: Response) {
    try {
      const { start, end } = req.query;
      const where: any = {};
      if (start && end) {
        where.createdAt = {
          gte: new Date(start as string),
          lte: new Date(end as string)
        };
      }
      const logs = await (prisma as any).stockLog.findMany({
        where,
        include: { material: true },
        orderBy: { createdAt: 'desc' }
      });
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao gerar relatório de estoque.' });
    }
  },

  // Relatório: Produção por funcionário/área
  async operationalProduction(req: Request, res: Response) {
    try {
      const { start, end, employeeId, workAreaId } = req.query;
      const where: any = {};

      if (employeeId) {
        const parsedEmployeeId = Number(employeeId);
        if (Number.isFinite(parsedEmployeeId) && parsedEmployeeId > 0) {
          where.employeeId = parsedEmployeeId;
        }
      }

      if (workAreaId) {
        const parsedWorkAreaId = Number(workAreaId);
        if (Number.isFinite(parsedWorkAreaId) && parsedWorkAreaId > 0) {
          where.employee = { ...(where.employee || {}), workAreaId: parsedWorkAreaId };
        }
      }

      if (start || end) {
        const openingDate: Record<string, Date> = {};
        if (start) {
          const startDate = new Date(start as string);
          if (!Number.isNaN(startDate.getTime())) openingDate.gte = startDate;
        }
        if (end) {
          const endDate = new Date(end as string);
          if (!Number.isNaN(endDate.getTime())) {
            endDate.setHours(23, 59, 59, 999);
            openingDate.lte = endDate;
          }
        }
        if (Object.keys(openingDate).length) {
          where.serviceOrder = { ...(where.serviceOrder || {}), openingDate };
        }
      }

      const production = await (prisma as any).serviceOrderService.findMany({
        where,
        include: {
          employee: {
            include: {
              workArea: true,
              jobRole: true,
              person: { include: { naturalPerson: true, legalPerson: true } }
            }
          },
          serviceOrder: {
            select: {
              id: true,
              traceCode: true,
              description: true,
              openingDate: true,
              status: true,
            }
          },
          service: { select: { id: true, name: true, description: true } }
        },
        orderBy: [
          { serviceOrder: { openingDate: 'desc' } },
          { id: 'desc' }
        ]
      });

      res.json(production.map((entry: any) => ({
        id: entry.id,
        employeeId: entry.employeeId,
        employeeName: entry.employee?.person?.naturalPerson?.name || entry.employee?.person?.legalPerson?.corporateName || 'Sem técnico',
        workAreaName: entry.employee?.workArea?.name || 'Sem área',
        jobRoleName: entry.employee?.jobRole?.name || 'Sem função',
        serviceName: entry.service?.name || entry.description || 'Serviço',
        serviceDescription: entry.service?.description || entry.description || null,
        serviceOrderId: entry.serviceOrder?.id || null,
        serviceOrderCode: entry.serviceOrder?.traceCode || null,
        serviceOrderDescription: entry.serviceOrder?.description || null,
        serviceOrderStatus: entry.serviceOrder?.status || null,
        openingDate: entry.serviceOrder?.openingDate || null,
        hoursWorked: Number(entry.hoursWorked || 0),
        unitPrice: Number(entry.unitPrice || 0),
        totalPrice: Number(entry.totalPrice || 0),
      })));
    } catch (error) {
      res.status(500).json({ error: 'Erro ao gerar relatório de produção.' });
    }
  },

  async operationalQuality(req: Request, res: Response) {
    try {
      const { start, end, status, inspectorId } = req.query;
      const where: any = {};

      if (status) {
        where.status = status;
      }

      if (inspectorId) {
        const parsedInspectorId = Number(inspectorId);
        if (Number.isFinite(parsedInspectorId) && parsedInspectorId > 0) {
          where.inspectorId = parsedInspectorId;
        }
      }

      if (start || end) {
        const inspectionDate: Record<string, Date> = {};
        if (start) {
          const startDate = new Date(start as string);
          if (!Number.isNaN(startDate.getTime())) inspectionDate.gte = startDate;
        }
        if (end) {
          const endDate = new Date(end as string);
          if (!Number.isNaN(endDate.getTime())) {
            endDate.setHours(23, 59, 59, 999);
            inspectionDate.lte = endDate;
          }
        }
        if (Object.keys(inspectionDate).length) {
          where.inspectionDate = inspectionDate;
        }
      }

      const controls = await prisma.qualityControl.findMany({
        where,
        include: {
          serviceOrder: {
            select: { id: true, traceCode: true, description: true, status: true }
          },
          inspector: {
            include: {
              workArea: true,
              person: { include: { naturalPerson: true, legalPerson: true } }
            }
          },
          measurements: true,
          nonConformities: true,
          photos: true,
        },
        orderBy: { inspectionDate: 'desc' }
      });

      return res.json(controls.map((control) => ({
        id: control.id,
        inspectionDate: control.inspectionDate,
        status: control.status,
        finalVerdict: control.finalVerdict,
        serviceOrderId: control.serviceOrderId,
        serviceOrderCode: control.serviceOrder?.traceCode || null,
        serviceOrderDescription: control.serviceOrder?.description || null,
        serviceOrderStatus: control.serviceOrder?.status || null,
        inspectorId: control.inspectorId,
        inspectorName: control.inspector?.person?.naturalPerson?.name || control.inspector?.person?.legalPerson?.corporateName || 'Sem inspetor',
        inspectorArea: control.inspector?.workArea?.name || 'Sem área',
        measurementsCount: control.measurements.length,
        approvedMeasurements: control.measurements.filter((measurement) => measurement.result === 'Aprovado').length,
        nonConformitiesCount: control.nonConformities.length,
        openNonConformities: control.nonConformities.filter((item) => item.status !== 'Resolvido').length,
        photosCount: control.photos.length,
      })));
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao gerar relatório de qualidade.' });
    }
  },

  // Relatório: Fluxo financeiro (entradas/saídas por período)
  async adminFinancialFlow(req: Request, res: Response) {
    try {
      const { start, end } = req.query;
      const where: any = {};
      if (start && end) {
        where.date = {
          gte: new Date(start as string),
          lte: new Date(end as string)
        };
      }
      const transactions = await (prisma as any).transaction.findMany({ where });
      const summary = transactions.reduce((acc: any, current: any) => {
        if (current.type === 'RECEIVABLE') acc.totalIncome += current.amount;
        else acc.totalExpense += current.amount;
        return acc;
      }, { totalIncome: 0, totalExpense: 0 });
      res.json({ ...summary, balance: summary.totalIncome - summary.totalExpense });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao gerar relatório financeiro.' });
    }
  },

  // Relatório: Contas a receber/pagar
  async adminAccounts(req: Request, res: Response) {
    try {
      const { status } = req.query;
      const where: any = {};
      if (status) where.type = status;
      const accounts = await (prisma as any).transaction.findMany({
        where,
        orderBy: { date: 'asc' }
      });
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao gerar relatório de contas.' });
    }
  },

  // Relatório: Desempenho de equipes (quantidade de serviços por funcionário)
  async adminTeamPerformance(req: Request, res: Response) {
    try {
      const performance = await (prisma as any).serviceOrderService.groupBy({
        by: ['employeeId'],
        where: { employeeId: { not: null } },
        _count: { _all: true },
        _sum: { hoursWorked: true, totalPrice: true }
      });

      const employeeIds = performance
        .map((item: any) => Number(item.employeeId))
        .filter((value: number) => Number.isFinite(value) && value > 0);

      const employees = employeeIds.length
        ? await prisma.employee.findMany({
            where: { id: { in: employeeIds } },
            include: {
              workArea: true,
              jobRole: true,
              person: { include: { naturalPerson: true, legalPerson: true } }
            }
          })
        : [];

      const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));

      res.json(performance.map((item: any) => {
        const employee = employeeMap.get(Number(item.employeeId));
        return {
          employeeId: item.employeeId,
          employeeName: employee?.person?.naturalPerson?.name || employee?.person?.legalPerson?.corporateName || `Funcionário #${item.employeeId}`,
          workAreaName: employee?.workArea?.name || 'Sem área',
          jobRoleName: employee?.jobRole?.name || 'Sem função',
          servicesCount: item._count?._all || 0,
          totalHours: Number(item._sum?.hoursWorked || 0),
          totalRevenue: Number(item._sum?.totalPrice || 0),
        };
      }));
    } catch (error) {
      res.status(500).json({ error: 'Erro ao gerar relatório de desempenho.' });
    }
  },

  // Relatório: Rentabilidade por OS
  async adminProfitability(req: Request, res: Response) {
    try {
      const { start, end } = req.query;
      const where: any = { status: 'Concluída' };
      if (start && end) {
        where.openingDate = {
          gte: new Date(start as string),
          lte: new Date(end as string)
        };
      }
      
      const orders = await prisma.serviceOrder.findMany({
        where,
        include: {
          materials: true,
          services: true,
          person: { include: { naturalPerson: true, legalPerson: true } }
        }
      });

      const reportData = orders.map(order => {
        const matTotal = order.materials.reduce((sum, m) => sum + m.totalPrice, 0);
        const servTotal = order.services.reduce((sum, s) => sum + s.totalPrice, 0);
        const subtotal = matTotal + servTotal;
        const profitVal = subtotal * ((order.profitPercent || 0) / 100);
        const taxVal = (subtotal + profitVal) * ((order.taxPercent || 0) / 100);
        const finalTotal = subtotal + profitVal + taxVal;

        return {
          id: order.id,
          customer: order.person?.naturalPerson?.name || order.person?.legalPerson?.corporateName || 'N/A',
          subtotal,
          estimatedProfit: profitVal,
          taxes: taxVal,
          finalTotal,
          margin: order.profitPercent
        };
      });

      res.json(reportData);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao gerar relatório de rentabilidade.' });
    }
  },

  // Relatório: Resumo de usuários ativos
  async adminUsersSummary(req: Request, res: Response) {
    try {
      const total = await (prisma as any).user.count();
      const admins = await (prisma as any).user.count({ where: { role: 'admin' } });
      const users = await (prisma as any).user.count({ where: { role: 'user' } });
      res.json({ total, admins, users });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao gerar resumo de usuários.' });
    }
  }
};
