import { NextFunction, Request, Response } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // eslint-disable-next-line no-console
  console.error(err);
  const status = err.status || (err.name === 'ZodError' ? 400 : 500);
  const message =
    err.name === 'ZodError' ? 'Dados inválidos enviados na requisição.' : err.message || 'Erro interno do servidor.';
  res.status(status).json({ message, issues: err.issues });
}
