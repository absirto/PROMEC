import { Request } from 'express';
import { AuthRequest } from '../../../middleware/auth';

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export const FinancialService = {
  canSeeFinance(req: Request) {
    const authReq = req as AuthRequest;
    const permissions = authReq.user?.permissions || [];
    const isAdmin = authReq.user?.role === 'admin';
    if (isAdmin) return true;
    return permissions.some(p => p === 'financeiro:visualizar' || p === 'financeiro:gerenciar' || p === 'financeiro:*');
  },

  sanitizeOrder(order: any, req: Request) {
    if (!order) return order;
    if (this.canSeeFinance(req)) return order;

    const sanitized = { ...order };
    delete sanitized.profitPercent;
    delete sanitized.taxPercent;
    delete sanitized.financials;

    if (Array.isArray(sanitized.transactions)) {
      delete sanitized.transactions;
    }

    if (Array.isArray(sanitized.materials)) {
      sanitized.materials = sanitized.materials.map((m: any) => {
        const { unitPrice, totalPrice, ...rest } = m;
        return rest;
      });
    }

    if (Array.isArray(sanitized.services)) {
      sanitized.services = sanitized.services.map((s: any) => {
        const { unitPrice, totalPrice, ...rest } = s;
        return rest;
      });
    }

    return sanitized;
  },

  enrichFinancials(order: any) {
    if (!order) return { financials: {} };
    
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
};
