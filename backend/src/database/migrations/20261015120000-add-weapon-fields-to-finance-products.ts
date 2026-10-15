import { QueryInterface } from "sequelize";

// Extensão do cadastro de Produto do módulo Financeiro pra cobrir armas e
// munições/insumos controlados (Taurus, CBC, Glock, Imbramun...), voltada
// pro contexto de clube de tiro / loja de armas / armaria — decisão do
// cliente foi estender o Produto existente em vez de criar entidades
// dedicadas (FinanceWeapon/FinanceAmmunition). Ver docs/MANUAL_TECNICO.md.
//
// Todas as colunas são opcionais a nível de banco: só se aplicam quando
// FinanceProduct.type é "weapon" ou "ammunition" (financeConfig.js, campo
// `visibleWhen`, controla a exibição condicional no formulário). Produtos
// já existentes (type "product"/"service") continuam com esses campos
// vazios/nulos sem qualquer impacto.
//
// IDEMPOTENTE DE PROPÓSITO (`ADD COLUMN IF NOT EXISTS`/`CREATE ... IF NOT
// EXISTS`, em vez do `queryInterface.addColumn` padrão): a primeira versão
// desta migration usava `addColumn` em sequência, sem transação — uma
// tentativa anterior que falhou no meio (ex.: índice único colidindo, ou
// corrida com outro processo) deixava algumas colunas já criadas, mas a
// migration inteira ficava marcada como "não executada" no SequelizeMeta.
// Rodar `db:migrate` de novo batia em "column already exists" na primeira
// coluna e travava pra sempre, nunca completando (visto em produção,
// 2026-10-15). Com `IF NOT EXISTS`, rodar de novo sempre completa — pula o
// que já existe e cria só o que falta.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const addColumnIfMissing = (column: string, definition: string) =>
      queryInterface.sequelize.query(
        `ALTER TABLE "FinanceProducts" ADD COLUMN IF NOT EXISTS "${column}" ${definition};`
      );

    await addColumnIfMissing("weaponType", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("brand", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("model", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("caliber", "VARCHAR(255) DEFAULT ''");
    // Número de série — identifica fisicamente a arma, único por empresa.
    // Sem DEFAULT de propósito: produtos que não são armas ficam NULL (não
    // ""), pra não colidir no índice único parcial abaixo.
    await addColumnIfMissing("serialNumber", "VARCHAR(255)");
    await addColumnIfMissing("cartridgeCapacity", "INTEGER");
    await addColumnIfMissing("operatingMode", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("barrelCount", "INTEGER");
    await addColumnIfMissing("barrelLength", "FLOAT");
    await addColumnIfMissing("boreType", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("kineticEnergyJ", "FLOAT");
    await addColumnIfMissing("useClassification", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("sigmaRegistrationNumber", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("origin", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("weaponStatus", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("manufacturingLotNumber", "VARCHAR(255) DEFAULT ''");
    await addColumnIfMissing("packageBarcode", "VARCHAR(255) DEFAULT ''");

    // Índice único parcial: dois produtos da mesma empresa não podem ter o
    // mesmo número de série (ele é físico/único na arma real). Parcial pra
    // não afetar produtos/serviços comuns, que ficam com serialNumber NULL.
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_products_company_serial_unique
      ON "FinanceProducts" ("companyId", "serialNumber")
      WHERE "serialNumber" IS NOT NULL AND "serialNumber" <> '';
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_finance_products_company_serial_unique;
    `);
    await queryInterface.removeColumn("FinanceProducts", "packageBarcode");
    await queryInterface.removeColumn("FinanceProducts", "manufacturingLotNumber");
    await queryInterface.removeColumn("FinanceProducts", "weaponStatus");
    await queryInterface.removeColumn("FinanceProducts", "origin");
    await queryInterface.removeColumn("FinanceProducts", "sigmaRegistrationNumber");
    await queryInterface.removeColumn("FinanceProducts", "useClassification");
    await queryInterface.removeColumn("FinanceProducts", "kineticEnergyJ");
    await queryInterface.removeColumn("FinanceProducts", "boreType");
    await queryInterface.removeColumn("FinanceProducts", "barrelLength");
    await queryInterface.removeColumn("FinanceProducts", "barrelCount");
    await queryInterface.removeColumn("FinanceProducts", "operatingMode");
    await queryInterface.removeColumn("FinanceProducts", "cartridgeCapacity");
    await queryInterface.removeColumn("FinanceProducts", "serialNumber");
    await queryInterface.removeColumn("FinanceProducts", "caliber");
    await queryInterface.removeColumn("FinanceProducts", "model");
    await queryInterface.removeColumn("FinanceProducts", "brand");
    await queryInterface.removeColumn("FinanceProducts", "weaponType");
  }
};
