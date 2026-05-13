import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

export const QC_UPLOAD_ROOT = process.env.QC_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'quality');

export function ensureQcUploadDir(): void {
  fs.mkdirSync(QC_UPLOAD_ROOT, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      ensureQcUploadDir();
      cb(null, QC_UPLOAD_ROOT);
    } catch (e) {
      cb(e as Error, QC_UPLOAD_ROOT);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 12) || '.bin';
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const qcPhotoUpload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não suportado. Use apenas JPG, PNG, WEBP ou GIF.') as any, false);
    }
  },
});
