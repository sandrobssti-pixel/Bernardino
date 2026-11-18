import { QueryInterface } from "sequelize";

// Liga a caixinha pequena (FinanceAmmoVolume) à "caixa grande" de onde
// ela veio (FinanceAmmoBigBox, v2.3.300) — `bigBoxId` nullable: ONDELETE
// SET NULL (nunca apaga a caixinha junto; o service já impede excluir
// uma caixa grande que ainda tenha caixinha vinculada, isso é só uma
// rede de segurança a mais no banco). `lotNumber` deixa de ser
// obrigatório: caixinha ligada a uma caixa grande passa a herdar o
// lote dela (LE/LF), em vez de digitar de novo — caixinha SEM caixa
// grande (cadastro antigo, antes desta versão) continua funcionando
// exatamente como antes, com o próprio `lotNumber` preenchido. `IF NOT
// EXISTS`/checagem de coluna já existente: idempotente, mesmo padrão
// já usado nas outras migrations deste módulo.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FinanceAmmoVolumes"
      ADD COLUMN IF NOT EXISTS "bigBoxId" INTEGER
      REFERENCES "FinanceAmmoBigBoxes"("id") ON DELETE SET NULL;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "FinanceAmmoVolumes" ALTER COLUMN "lotNumber" DROP NOT NULL;
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "FinanceAmmoVolumes" ALTER COLUMN "lotNumber" SET NOT NULL;
    `);
    await queryInterface.removeColumn("FinanceAmmoVolumes", "bigBoxId");
  }
};
