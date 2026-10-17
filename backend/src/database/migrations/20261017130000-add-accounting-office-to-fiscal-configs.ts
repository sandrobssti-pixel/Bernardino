import { QueryInterface } from "sequelize";

// Suporte ao CNPJ/CPF do escritório de contabilidade, exigido por alguns
// estados (ex. BA) via o grupo autXML da NF-e — rejeição 487 da Sefaz
// ("Escritório de Contabilidade não cadastrado") quando ausente/errado.
// Esse dado NÃO vai no payload da nota: é um campo de nível EMPRESA na
// própria Focus NFe (API "Empresas", `PUT /v2/empresas/{id}`, campo
// `cpf_cnpj_contabilidade`), autenticado com um token de conta/master
// (`focusAccountToken`) diferente do `gatewayTokenSandbox`/
// `gatewayTokenProduction` já usado pra emitir nota — e precisa do id
// interno da empresa na Focus (`focusCompanyId`, visível na URL do painel
// deles, não é o CNPJ). `FocusAccountService.updateAccountingOffice`
// (v2.3.128) chama essa API quando `accountingOfficeDocument` muda.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "accountingOfficeDocument" VARCHAR(255) DEFAULT '';
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "focusAccountToken" VARCHAR(255) DEFAULT '';
      ALTER TABLE "FiscalConfigs" ADD COLUMN IF NOT EXISTS "focusCompanyId" VARCHAR(255) DEFAULT '';
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FiscalConfigs", "accountingOfficeDocument");
    await queryInterface.removeColumn("FiscalConfigs", "focusAccountToken");
    await queryInterface.removeColumn("FiscalConfigs", "focusCompanyId");
  }
};
