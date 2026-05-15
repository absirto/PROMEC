
import { Router } from 'express';
import { authenticateToken, requirePermission } from '../../../middleware/auth';
import { QualityControlController } from '../controllers/QualityControlController';
import { qcPhotoUpload } from '../../../middleware/qcPhotoUpload';

const router = Router();

router.get('/photos/:photoId/file', authenticateToken, requirePermission('qualidade:visualizar'), QualityControlController.downloadPhoto);

router.delete('/photos/:photoId', authenticateToken, requirePermission('qualidade:gerenciar'), QualityControlController.deletePhoto);

router.get('/', authenticateToken, requirePermission('qualidade:visualizar'), QualityControlController.list);
router.get('/:id', authenticateToken, requirePermission('qualidade:visualizar'), QualityControlController.get);
router.post('/', authenticateToken, requirePermission('qualidade:gerenciar'), QualityControlController.create);
router.post(
  '/:qualityControlId/photos',
  authenticateToken,
  requirePermission('qualidade:gerenciar'),
  qcPhotoUpload.single('file'),
  QualityControlController.uploadPhoto,
);
router.put('/:id', authenticateToken, requirePermission('qualidade:gerenciar'), QualityControlController.update);
router.delete('/:id', authenticateToken, requirePermission('qualidade:gerenciar'), QualityControlController.delete);

export default router;
