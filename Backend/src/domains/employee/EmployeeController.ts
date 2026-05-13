import { Request, Response } from 'express';
import { EmployeeService } from './EmployeeService';

export const EmployeeController = {
  async list(req: Request, res: Response) {
    try {
      const employees = await EmployeeService.list();
      res.json(employees);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao listar funcionários', error: error.message });
    }
  },
  async get(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const employee = await EmployeeService.get(id);
      if (!employee) return res.status(404).json({ message: 'Funcionário não encontrado' });
      res.json(employee);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao buscar funcionário', error: error.message });
    }
  },
  async create(req: Request, res: Response) {
    try {
      const employee = await EmployeeService.create(req.body);
      res.status(201).json(employee);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao criar funcionário', error: error.message });
    }
  },
  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const employee = await EmployeeService.update(id, req.body);
      res.json(employee);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao atualizar funcionário', error: error.message });
    }
  },
  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await EmployeeService.delete(id);
      res.status(204).end();
    } catch (error: any) {
      if (error.message.startsWith('Não é possível excluir')) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: 'Erro ao excluir funcionário', error: error.message });
    }
  },
};