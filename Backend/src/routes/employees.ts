import { Router } from 'express';
import { EmployeeController } from '../controllers/EmployeeController';
import { validateBody } from '../middleware/validation/validateBody';
import { employeeCreateSchema, employeeUpdateSchema } from '../middleware/validation/employeeSchema';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, requirePermission('funcionarios:visualizar'), EmployeeController.list);
router.get('/:id', authenticateToken, requirePermission('funcionarios:visualizar'), EmployeeController.get);
router.post('/', authenticateToken, requirePermission('funcionarios:gerenciar'), validateBody(employeeCreateSchema), EmployeeController.create);
router.put('/:id', authenticateToken, requirePermission('funcionarios:gerenciar'), validateBody(employeeUpdateSchema), EmployeeController.update);
router.delete('/:id', authenticateToken, requirePermission('funcionarios:gerenciar'), EmployeeController.delete);

export default router;
