import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import Company from "../models/Company";
import Plan from "../models/Plan";

// Flowbuilder (criar/editar fluxo) é um add-on separado por plano
// (Plan.useFlowbuilder) — Master libera por contrato, mesmo padrão de
// EnsureFiscalAccess/EnsurePaymentAccess (serviços FinanceService/
// FiscalService). Essa aqui é middleware de Express (não uma função
// chamada de dentro do controller) porque `flowBuilderRoutes.ts` já
// aplica `isAuth` desse jeito em cada rota — mais simples encaixar no
// mesmo padrão do que reescrever cada ação dos controllers do
// Flowbuilder (FlowBuilderController, FlowExportController,
// FlowImportController, DocumentController).
//
// ⚠️ IMPORTANTE: só trava as rotas de GERENCIAR fluxo (criar/editar/
// excluir/listar/ativar/exportar/importar) — nunca a EXECUÇÃO de um
// fluxo já configurado, que roda direto a partir do banco em
// `wbotMessageListener.ts` (e os listeners equivalentes de Facebook/
// Instagram/Webchat/API Oficial), sem passar por essas rotas. Gatear a
// execução quebraria resposta automática/mensagem de boas-vindas de
// clientes que já têm fluxo configurado — fora do que foi pedido.
const EnsureFlowbuilderAccess = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const user = req.user as any;
  if (!user) {
    throw new AppError("ERR_NO_FLOWBUILDER_MODULE_ACCESS", 403);
  }
  if (user.super) {
    return next();
  }

  const company = await Company.findByPk(user.companyId, {
    include: [{ model: Plan, as: "plan", attributes: ["useFlowbuilder"] }]
  });
  const plan = (company as any)?.plan;

  if (!plan?.useFlowbuilder) {
    throw new AppError("ERR_NO_FLOWBUILDER_MODULE_ACCESS", 403);
  }

  return next();
};

export default EnsureFlowbuilderAccess;
