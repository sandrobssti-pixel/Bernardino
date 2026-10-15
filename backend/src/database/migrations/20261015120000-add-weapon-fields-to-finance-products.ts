import { QueryInterface, DataTypes } from "sequelize";

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
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("FinanceProducts", "weaponType", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ""
    });
    await queryInterface.addColumn("FinanceProducts", "brand", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ""
    });
    await queryInterface.addColumn("FinanceProducts", "model", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ""
    });
    await queryInterface.addColumn("FinanceProducts", "caliber", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ""
    });
    // Número de série — identifica fisicamente a arma, único por empresa.
    // Sem defaultValue de propósito: produtos que não são armas ficam NULL
    // (não ""), pra não colidir no índice único parcial abaixo.
    await queryInterface.addColumn("FinanceProducts", "serialNumber", {
      type: DataTypes.STRING,
      allowNull: true
    });
    await queryInterface.addColumn("FinanceProducts", "cartridgeCapacity", {
      type: DataTypes.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn("FinanceProducts", "operatingMode", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ""
    });
    await queryInterface.addColumn("FinanceProducts", "barrelCount", {
      type: DataTypes.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn("FinanceProducts", "barrelLength", {
      type: DataTypes.FLOAT,
      allowNull: true
    });
    await queryInterface.addColumn("FinanceProducts", "boreType", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ""
    });
    await queryInterface.addColumn("FinanceProducts", "kineticEnergyJ", {
      type: DataTypes.FLOAT,
      allowNull: true
    });
    await queryInterface.addColumn("FinanceProducts", "useClassification", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ""
    });
    await queryInterface.addColumn("FinanceProducts", "sigmaRegistrationNumber", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ""
    });
    await queryInterface.addColumn("FinanceProducts", "origin", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ""
    });
    await queryInterface.addColumn("FinanceProducts", "weaponStatus", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ""
    });
    await queryInterface.addColumn("FinanceProducts", "manufacturingLotNumber", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ""
    });
    await queryInterface.addColumn("FinanceProducts", "packageBarcode", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ""
    });

    // Índice único parcial: dois produtos da mesma empresa não podem ter o
    // mesmo número de série (ele é físico/único na arma real). Parcial pra
    // não afetar produtos/serviços comuns, que ficam com serialNumber NULL.
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_finance_products_company_serial_unique
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
