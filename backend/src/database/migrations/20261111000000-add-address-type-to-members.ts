import { QueryInterface } from "sequelize";

// "Tipo"/"Descrição" do endereço PRINCIPAL do associado (campos de
// endereço em si — zipCode/street/number/complement/neighborhood/city/
// state — já existiam desde a Fase 1). Referência real do
// clube-atirador.techsofttecnologia.com.br (tela "Endereço"). Ver
// docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE \"Members\" ADD COLUMN IF NOT EXISTS \"addressType\" VARCHAR(255) NOT NULL DEFAULT 'residencial';"
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE "Members" ADD COLUMN IF NOT EXISTS "addressDescription" VARCHAR(255) NOT NULL DEFAULT \'\';'
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Members", "addressType");
    await queryInterface.removeColumn("Members", "addressDescription");
  }
};
