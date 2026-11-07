import { Op, Sequelize } from "sequelize";

// Reaproveitado por FinanceReceivableService (cliente), SaleService
// (cliente) e FinanceExpenseService (fornecedor) — v2.3.262, pedido do
// cliente: buscar Conta a Pagar/Receber/Venda pelo nome ou CPF/CNPJ da
// pessoa/empresa ligada ao registro, não só pela descrição/observação.
// Mesma técnica de busca (LOWER+LIKE em `name`, LIKE cru em `document`,
// sem normalizar pontuação) já usada em FinanceCustomerService.list.
export const findEntityIdsByNameOrDocument = async (
  Model: any,
  companyId: number,
  searchParam: string
): Promise<number[]> => {
  const term = searchParam.toLowerCase().trim();
  const rows = await Model.findAll({
    where: {
      companyId,
      [Op.or]: [
        Sequelize.where(Sequelize.fn("LOWER", Sequelize.col("name")), "LIKE", `%${term}%`),
        { document: { [Op.like]: `%${searchParam.trim()}%` } }
      ]
    },
    attributes: ["id"]
  });
  return rows.map((row: any) => row.id);
};
