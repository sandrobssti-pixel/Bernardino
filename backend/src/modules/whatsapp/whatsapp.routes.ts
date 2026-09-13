import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth, requireRole } from '../../middleware/auth';
import { startWhatsAppSession, stopWhatsAppSession } from './whatsapp.service';

export const whatsappRouter = Router();
whatsappRouter.use(requireAuth);

whatsappRouter.get(
  '/sessions',
  asyncHandler(async (_req, res) => {
    res.json(await prisma.whatsAppSession.findMany({ orderBy: { createdAt: 'asc' } }));
  })
);

whatsappRouter.post(
  '/sessions',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { name } = req.body as { name: string };
    if (!name?.trim()) return res.status(400).json({ message: 'Informe um nome para a sessão.' });
    await startWhatsAppSession(name.trim());
    const session = await prisma.whatsAppSession.findUnique({ where: { name: name.trim() } });
    res.status(201).json(session);
  })
);

whatsappRouter.post(
  '/sessions/:name/disconnect',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    await stopWhatsAppSession(req.params.name);
    res.status(204).send();
  })
);
