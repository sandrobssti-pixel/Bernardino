import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { signToken } from '../utils/jwt';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, AuthRequest } from '../middleware/auth';

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

// O primeiro usuário cadastrado no sistema vira ADMIN automaticamente.
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(409).json({ message: 'E-mail já cadastrado.' });
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    const isFirstUser = (await prisma.user.count()) === 0;
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, passwordHash, role: isFirstUser ? 'ADMIN' : 'AGENT' },
    });
    const token = signToken({ sub: user.id, role: user.role });
    res.status(201).json({ token, user: sanitize(user) });
  })
);

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }
    await prisma.user.update({ where: { id: user.id }, data: { status: 'ONLINE' } });
    const token = signToken({ sub: user.id, role: user.role });
    res.json({ token, user: sanitize(user) });
  })
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
    res.json(sanitize(user));
  })
);

authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    await prisma.user.update({ where: { id: req.user!.id }, data: { status: 'OFFLINE' } });
    res.status(204).send();
  })
);

function sanitize(user: { id: string; name: string; email: string; role: string; status: string }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status };
}
