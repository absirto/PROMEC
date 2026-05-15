import { Request, Response } from 'express';
import { EmployeeService } from '../services/EmployeeService';
import { getPaginationParams, formatPaginatedResponse } from '../../../utils/pagination';

export const EmployeeController = {
  async list(req: Request, res: Response) {
    try {
      const pagination = getPaginationParams(req);
      const [employees, total] = await EmployeeService.list(pagination.skip, pagination.limit);
      res.json(formatPaginatedResponse(employees, total, pagination));
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar funcionários.' });
    }
  },

  async get(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const employee = await EmployeeService.get(id);
      if (!employee) return res.status(404).json({ error: 'Funcionário não encontrado.' });
      res.json(employee);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar funcionário.' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const employee = await EmployeeService.create(req.body);
      res.status(201).json(employee);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao criar funcionário.' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const employee = await EmployeeService.update(id, req.body);
      res.json(employee);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao atualizar funcionário.' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await EmployeeService.delete(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
};
