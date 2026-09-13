import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { sendWhatsAppMessage } from './whatsapp/whatsapp.service';

export const messagesRouter = Router();
messagesRouter.use(requireAuth);

const sendSchema = z.object({ conversationId: z.string(), content: z.string().min(1) });

messagesRouter.post(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const data = sendSchema.parse(req.body);
    const conversation = await prisma.conversation.findUnique({
      where: { id: data.conversationId },
      include: { contact: true },
    });
    if (!conversation) return res.status(404).json({ message: 'Conversa não encontrada.' });

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        senderType: 'AGENT',
        authorId: req.user!.id,
        content: data.content,
        status: 'PENDING',
      },
    });
    await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });

    try {
      const waMessageId = await sendWhatsAppMessage(conversation.contact.whatsappJid, data.content);
      const updated = await prisma.message.update({
        where: { id: message.id },
        data: { status: 'SENT', whatsappMessageId: waMessageId },
      });
      return res.status(201).json(updated);
    } catch (err) {
      const failed = await prisma.message.update({ where: { id: message.id }, data: { status: 'FAILED' } });
      return res.status(502).json({ message: 'Falha ao enviar mensagem pelo WhatsApp.', data: failed });
    }
  })
);
