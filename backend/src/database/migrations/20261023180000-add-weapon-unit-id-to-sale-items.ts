import { QueryInterface, DataTypes } from "sequelize";

// Liga o item de venda à unidade física de arma vendida (v2.3.204, Fase 2
// — integração com a Venda). `sigmaSinarm` (migration
// 20261019240000) continua sendo o snapshot digitado/auto-preenchido na
// hora da venda; `weaponUnitId` é a referência de verdade pra marcar a
// unidade como vendida/devolvida ao confirmar/cancelar a venda (ver
// SaleService.ts, `adjustWeaponUnits`). Nulo pra qualquer item que não é
// arma (produto comum, serviço, munição). ON DELETE SET NULL: apagar a
// unidade (não tem rotina pra isso hoje, mas por segurança) não pode
// travar nem apagar o histórico da venda.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE "SaleItems" ADD COLUMN IF NOT EXISTS "weaponUnitId" INTEGER
       REFERENCES "FinanceWeaponUnits" ("id") ON UPDATE CASCADE ON DELETE SET NULL;`
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("SaleItems", "weaponUnitId");
  }
};
