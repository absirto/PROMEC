import { Request, Response } from 'express';
import prisma from '../../../core/prisma';

export const FinanceController = {
  async list(req: Request, res: Response) {
    try {
      const transactions = await (prisma as any).transaction.findMany({
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
      const transaction = await (prisma as any).transaction.create({
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
      const transactions = await (prisma as any).transaction.findMany();
      const summary = transactions.reduce((acc: any, current: any) => {
        if (current.type === 'RECEIVABLE') acc.totalIncome += current.amount;
        else acc.totalExpense += current.amount;
        return acc;
      }, { totalIncome: 0, totalExpense: 0 });
      
      res.json({ ...summary, balance: summary.totalIncome - summary.totalExpense });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao calcular resumo financeiro.' });
    }
  }
};
