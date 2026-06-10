import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

export const LOGO_UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'public', 'logo');

export function ensureLogoUploadDir(): void {
  fs.mkdirSync(LOGO_UPLOAD_ROOT, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      ensureLogoUploadDir();
      cb(null, LOGO_UPLOAD_ROOT);
    } catch (e) {
      cb(e as Error, LOGO_UPLOAD_ROOT);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 12) || '.bin';
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const logoUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
    ];
    if (allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não suportado. Use apenas JPG, PNG, WEBP, GIF ou SVG.') as any, false);
    }
  },
});
