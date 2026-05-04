import { Request, Response } from 'express';
import prisma from '../services/prisma';
import { generateAccountsPDF } from '../utils/pdfAccounts';
import { getSettings } from '../utils/pdfSettings';
import { generateUsersSummaryPDF } from '../utils/pdfUsersSummary';
import { generateTeamPerformancePDF } from '../utils/pdfTeamPerformance';
import { generateFinancialFlowPDF } from '../utils/pdfFinancialFlow';
import { generateStockMovementsPDF } from '../utils/pdfStockMovements';
import { generateServiceOrdersPDF } from '../utils/pdfServiceOrders';
import { generatePurchasesPDF } from '../utils/pdfPurchases';

export const ReportsController = {
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
        }
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="relatorio_compras.pdf"');
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
      const pdfBuffer = generateAccountsPDF(accounts, status as string, (settings?.logoUrl ?? undefined));
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
      const pdfBuffer = generateTeamPerformancePDF(performance, (settings?.logoUrl ?? undefined));
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
      const pdfBuffer = generateFinancialFlowPDF(summary, start as string, end as string, (settings?.logoUrl ?? undefined));
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
      const pdfBuffer = generateStockMovementsPDF(logs, start as string, end as string, (settings?.logoUrl ?? undefined));
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
      const pdfBuffer = generateServiceOrdersPDF(byStatus, start as string, end as string, (settings?.logoUrl ?? undefined));
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
      const { start, end } = req.query;
      const where: any = {};
      if (start && end) {
        where.openingDate = {
          gte: new Date(start as string),
          lte: new Date(end as string)
        };
      }
      const production = await (prisma as any).serviceOrderService.findMany({
        where,
        include: {
          employee: { include: { workArea: true, person: true } },
          serviceOrder: true
        }
      });
      res.json(production);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao gerar relatório de produção.' });
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
        _count: { _all: true }
      });
      res.json(performance);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao gerar relatório de desempenho.' });
    }
  },

  // Relatório: Rentabilidade por OS
  async adminProfitability(req: Request, res: Response) {
    try {
      const { start, end } = req.query;
      const where: any = { status: 'CONCLUIDA' };
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
