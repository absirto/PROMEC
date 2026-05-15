import { Router } from 'express';
import { PeopleController } from '../controllers/PeopleController';
import { authenticateToken, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validateBody';
import { personCreateSchema, personUpdateSchema } from '../peopleSchema';

const router = Router();

router.get('/', authenticateToken, requirePermission('pessoas:visualizar'), PeopleController.list);
router.get('/:id', authenticateToken, requirePermission('pessoas:visualizar'), PeopleController.get);
router.post('/', authenticateToken, requirePermission('pessoas:gerenciar'), validateBody(personCreateSchema), PeopleController.create);
router.put('/:id', authenticateToken, requirePermission('pessoas:gerenciar'), validateBody(personUpdateSchema), PeopleController.update);
router.delete('/:id', authenticateToken, requirePermission('pessoas:gerenciar'), PeopleController.delete);

export default router;
