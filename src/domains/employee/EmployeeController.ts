import { Request, Response } from 'express';
import { EmployeeService } from './EmployeeService';

export const EmployeeController = {
  async list(req: Request, res: Response) {
    const employees = await EmployeeService.list();
    res.json(employees);
  },
  async get(req: Request, res: Response) {
    const id = Number(req.params.id);
    const employee = await EmployeeService.get(id);
    if (!employee) return res.status(404).json({ message: 'Funcionário não encontrado' });
    res.json(employee);
  },
  async create(req: Request, res: Response) {
    const employee = await EmployeeService.create(req.body);
    res.status(201).json(employee);
  },
  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const employee = await EmployeeService.update(id, req.body);
    res.json(employee);
  },
  async delete(req: Request, res: Response) {
    const id = Number(req.params.id);
    await EmployeeService.delete(id);
    res.status(204).end();
  },
};