import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';

export const contactsRouter = Router();
contactsRouter.use(requireAuth);

contactsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const search = (req.query.search as string) || '';
    const contacts = await prisma.contact.findMany({
      where: search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(contacts);
  })
);

contactsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const contact = await prisma.contact.findUnique({ where: { id: req.params.id } });
    if (!contact) return res.status(404).json({ message: 'Contato não encontrado.' });
    res.json(contact);
  })
);
