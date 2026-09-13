import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { emitToAll } from '../lib/socket';

export const conversationsRouter = Router();
conversationsRouter.use(requireAuth);

conversationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const conversations = await prisma.conversation.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        contact: true,
        assignedAgent: { select: { id: true, name: true } },
        queue: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
    res.json(conversations);
  })
);

conversationsRouter.get(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json(messages);
  })
);

conversationsRouter.patch(
  '/:id/assign',
  asyncHandler(async (req, res) => {
    const { agentId } = req.body as { agentId: string | null };
    const conversation = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { assignedAgentId: agentId, status: agentId ? 'OPEN' : 'PENDING' },
      include: { contact: true, assignedAgent: { select: { id: true, name: true } } },
    });
    emitToAll('conversation:updated', conversation);
    res.json(conversation);
  })
);

conversationsRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = req.body as { status: 'OPEN' | 'PENDING' | 'CLOSED' };
    const conversation = await prisma.conversation.update({ where: { id: req.params.id }, data: { status } });
    emitToAll('conversation:updated', conversation);
    res.json(conversation);
  })
);
