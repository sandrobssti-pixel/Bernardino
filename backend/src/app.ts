import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { authRouter } from './modules/auth.routes';
import { usersRouter } from './modules/users.routes';
import { contactsRouter } from './modules/contacts.routes';
import { queuesRouter } from './modules/queues.routes';
import { conversationsRouter } from './modules/conversations.routes';
import { messagesRouter } from './modules/messages.routes';
import { whatsappRouter } from './modules/whatsapp/whatsapp.routes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0' }));

app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/contacts', contactsRouter);
app.use('/queues', queuesRouter);
app.use('/conversations', conversationsRouter);
app.use('/messages', messagesRouter);
app.use('/whatsapp', whatsappRouter);

app.use(errorHandler);
