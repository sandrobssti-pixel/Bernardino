import { Request, Response } from "express";
import { GetPaymentAccessStatus } from "../services/FinanceService/EnsurePaymentAccess";

// Usado pelo frontend pra decidir se mostra o conteúdo da aba Configuração
// de Pagamento / os botões "Gerar Pix"/"Gerar boleto" em Contas a Receber —
// mesmo padrão do FiscalAccessController.
export const show = async (req: Request, res: Response): Promise<Response> => {
  const status = await GetPaymentAccessStatus(req.user as any);
  return res.status(200).json(status);
};
