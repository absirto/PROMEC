import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import prisma from '../../../core/prisma';

type PhotoRow = {
  id: number;
  description: string;
  fileName: string | null;
  fileType: string | null;
  uploadedAt: Date | null;
  storagePath: string | null;
  base64: string | null;
};

function toPhotoDto(photo: PhotoRow) {
  const dto: Record<string, unknown> = {
    id: photo.id,
    description: photo.description,
    fileName: photo.fileName,
    fileType: photo.fileType,
    uploadedAt: photo.uploadedAt,
    downloadUrl: photo.storagePath ? `/v1/quality-controls/photos/${photo.id}/file` : null,
  };
  if (photo.storagePath) dto.storagePath = photo.storagePath;
  if (photo.base64 && !photo.storagePath) dto.base64 = photo.base64;
  return dto;
}

function mapControlPhotos<T extends { photos?: PhotoRow[] }>(control: T) {
  if (!control.photos?.length) return control;
  return {
    ...control,
    photos: control.photos.map(toPhotoDto),
  };
}

async function unlinkStorage(rel: string | null) {
  if (!rel) return;
  const safe = rel.replace(/^(\.\.(\/|\\|$))+/, '').replace(/\\/g, '/');
  const abs = path.join(process.cwd(), 'uploads', safe);
  await fs.unlink(abs).catch(() => {});
}

export const QualityControlController = {
  async list(req: Request, res: Response) {
    try {
      const controls = await prisma.qualityControl.findMany({
        include: {
          serviceOrder: true,
          inspector: { include: { person: { include: { naturalPerson: true } } } },
          photos: true,
        },
      });
      res.json(controls.map((c) => mapControlPhotos(c)));
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao buscar controles de qualidade.' });
    }
  },

  async get(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const control = await prisma.qualityControl.findUnique({
        where: { id },
        include: {
          serviceOrder: true,
          inspector: true,
          nonConformities: true,
          measurements: true,
          photos: true,
        },
      });
      if (!control) return res.status(404).json({ status: 'error', message: 'Controle não encontrado.' });
      res.json(mapControlPhotos(control));
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao buscar controle de qualidade.' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { serviceOrderId, inspectorId, status, finalVerdict } = req.body;
      const control = await (prisma.qualityControl as any).create({
        data: {
          serviceOrderId: serviceOrderId ? Number(serviceOrderId) : null,
          inspectorId: inspectorId ? Number(inspectorId) : null,
          status,
          finalVerdict,
          inspectionDate: new Date(),
        },
      });
      res.status(201).json(control);
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao registrar controle.' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const data = req.body;
      const control = await (prisma.qualityControl as any).update({
        where: { id },
        data: {
          status: data.status,
          finalVerdict: data.finalVerdict,
          serviceOrderId: data.serviceOrderId ? Number(data.serviceOrderId) : null,
          inspectorId: data.inspectorId ? Number(data.inspectorId) : null,
        },
      });
      res.json(control);
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao atualizar controle.' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const photos = await prisma.qualityPhoto.findMany({ where: { qualityControlId: id } });
      for (const p of photos) {
        await unlinkStorage(p.storagePath);
      }
      await prisma.qualityControl.delete({ where: { id } });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao deletar controle.' });
    }
  },

  async uploadPhoto(req: Request, res: Response) {
    try {
      const qcId = Number(req.params.qualityControlId);
      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file) {
        return res.status(400).json({ status: 'error', message: 'Ficheiro de imagem obrigatório (campo file).' });
      }
      const qc = await prisma.qualityControl.findUnique({ where: { id: qcId } });
      if (!qc) {
        await fs.unlink(file.path).catch(() => {});
        return res.status(404).json({ status: 'error', message: 'Controle não encontrado.' });
      }
      const description = String(req.body.description ?? 'Anexo').slice(0, 500);
      const uploadsRoot = path.join(process.cwd(), 'uploads');
      const relative = path.relative(uploadsRoot, file.path).replace(/\\/g, '/');
      const row = await prisma.qualityPhoto.create({
        data: {
          qualityControlId: qcId,
          description,
          storagePath: relative,
          fileName: file.originalname,
          fileType: file.mimetype,
          uploadedAt: new Date(),
        },
      });
      res.status(201).json(toPhotoDto(row as PhotoRow));
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao guardar foto.' });
    }
  },

  async downloadPhoto(req: Request, res: Response) {
    try {
      const photoId = Number(req.params.photoId);
      const photo = await prisma.qualityPhoto.findUnique({ where: { id: photoId } });
      if (!photo?.storagePath) {
        return res.status(404).json({ status: 'error', message: 'Ficheiro não encontrado.' });
      }
      const safe = photo.storagePath.replace(/^(\.\.(\/|\\|$))+/, '').replace(/\\/g, '/');
      const abs = path.join(process.cwd(), 'uploads', safe);
      res.setHeader('Content-Type', photo.fileType || 'application/octet-stream');
      res.sendFile(abs, (err) => {
        if (err && !res.headersSent) res.status(404).json({ status: 'error', message: 'Ficheiro em falta no disco.' });
      });
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao ler foto.' });
    }
  },

  async deletePhoto(req: Request, res: Response) {
    try {
      const photoId = Number(req.params.photoId);
      const photo = await prisma.qualityPhoto.findUnique({ where: { id: photoId } });
      if (!photo) return res.status(404).json({ status: 'error', message: 'Foto não encontrada.' });
      await unlinkStorage(photo.storagePath);
      await prisma.qualityPhoto.delete({ where: { id: photoId } });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Erro ao remover foto.' });
    }
  },
};
