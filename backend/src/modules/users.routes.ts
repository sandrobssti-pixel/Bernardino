import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireRole } from '../middleware/auth';

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  })
);

usersRouter.patch(
  '/:id/role',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { role } = req.body as { role: 'ADMIN' | 'AGENT' };
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
    res.json(user);
  })
);
