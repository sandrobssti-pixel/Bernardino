import { QueryInterface } from "sequelize";

// Ficha do cliente (Despachante Bélico) — campos que o cliente pediu no
// modelo de formulário real que ele usa: telefone de contato (separado do
// WhatsApp), identidade (RG), profissão, endereço completo (campo único,
// texto livre) e foto (caminho do arquivo, upload próprio — ver
// WeaponDispatchClientController.uploadPhoto). Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "WeaponDispatchClients" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "WeaponDispatchClients" ADD COLUMN IF NOT EXISTS "rg" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "WeaponDispatchClients" ADD COLUMN IF NOT EXISTS "profession" VARCHAR(255) NOT NULL DEFAULT '';
      ALTER TABLE "WeaponDispatchClients" ADD COLUMN IF NOT EXISTS "address" TEXT NOT NULL DEFAULT '';
      ALTER TABLE "WeaponDispatchClients" ADD COLUMN IF NOT EXISTS "photoUrl" VARCHAR(255) NOT NULL DEFAULT '';
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("WeaponDispatchClients", "phone");
    await queryInterface.removeColumn("WeaponDispatchClients", "rg");
    await queryInterface.removeColumn("WeaponDispatchClients", "profession");
    await queryInterface.removeColumn("WeaponDispatchClients", "address");
    await queryInterface.removeColumn("WeaponDispatchClients", "photoUrl");
  }
};
