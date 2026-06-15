import { Request, Response } from 'express';
import prisma from '../../../core/prisma';

export const FinanceController = {
  async list(req: Request, res: Response) {
    try {
      const transactions = await prisma.transaction.findMany({
        include: { serviceOrder: true },
        orderBy: { date: 'desc' }
      });
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar transações financeiras.' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { type, amount, category, description, orderId } = req.body;
      const transaction = await prisma.transaction.create({
        data: {
          type,
          amount: Number(amount),
          category,
          description,
          orderId: orderId ? Number(orderId) : null
        }
      });
      res.status(201).json(transaction);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao registrar transação financeira.' });
    }
  },

  async getSummary(req: Request, res: Response) {
    try {
      const transactions = await prisma.transaction.findMany();
      const summary = transactions.reduce((acc: any, current: any) => {
        if (current.type === 'RECEIVABLE') acc.totalIncome += current.amount;
        else acc.totalExpense += current.amount;
        return acc;
      }, { totalIncome: 0, totalExpense: 0 });

      // Calcular margem prevista das Ordens de Serviço (não canceladas)
      const serviceOrders = await prisma.serviceOrder.findMany({
        where: { status: { not: 'Cancelada' } },
        include: { services: true, materials: true }
      });

      let totalRevenue = 0;
      let totalProfit = 0;

      serviceOrders.forEach((order: any) => {
        const mTotal = (order.materials || []).reduce((acc: number, m: any) => acc + Number(m.totalPrice || 0), 0);
        const sTotal = (order.services || []).reduce((acc: number, s: any) => acc + Number(s.totalPrice || 0), 0);
        const subtotal = mTotal + sTotal;

        const profitAmt = subtotal * ((order.profitPercent || 0) / 100);
        const baseForTax = subtotal + profitAmt;
        const taxAmt = baseForTax * ((order.taxPercent || 0) / 100);

        totalRevenue += baseForTax + taxAmt;
        totalProfit += profitAmt;
      });

      const predictedMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
      
      res.json({ 
        ...summary, 
        balance: summary.totalIncome - summary.totalExpense,
        predictedMargin
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao calcular resumo financeiro.' });
    }
  }
};
