import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireRole } from '../middleware/auth';

export const queuesRouter = Router();
queuesRouter.use(requireAuth);

queuesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await prisma.queue.findMany({ orderBy: { name: 'asc' } }));
  })
);

const upsertSchema = z.object({ name: z.string().min(2), description: z.string().optional() });

queuesRouter.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = upsertSchema.parse(req.body);
    res.status(201).json(await prisma.queue.create({ data }));
  })
);

queuesRouter.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    await prisma.queue.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
