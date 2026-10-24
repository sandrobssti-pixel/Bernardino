import { QueryInterface } from "sequelize";

// Etapa 2 (integração arma <-> Venda), autorizada pelo cliente em chat
// direto (não por relay cross-session, diferente do incidente da seção
// 184) — ver docs/MANUAL_TECNICO.md, seção 186. Coluna nullable, sem
// FK declarada no Sequelize pra não criar import circular entre
// SaleItem.ts e FinanceWeaponUnit.ts (mesmo padrão já usado em
// FinanceWeaponUnit.saleItemId, que também é só INTEGER solto) — a
// integridade é garantida em código (FinanceWeaponUnitService), não no
// banco. Puramente aditiva.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "weaponUnitId" INTEGER;
    `);
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("SaleItems", "weaponUnitId");
  }
};
