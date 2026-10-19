import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Configuração do gateway de cobrança (Pix/boleto) por empresa — separado de
// FiscalConfig de propósito: FiscalConfig são credenciais do gateway de
// EMISSÃO de nota fiscal (Focus NFe); isso aqui é credencial do gateway de
// COBRANÇA/recebimento (Mercado Pago, e futuramente Asaas) — contratos e
// preocupações diferentes, não dá pra misturar no mesmo registro. Ver
// docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "FinancePaymentConfigs";
    const existingTables: ExistingTables = await queryInterface.showAllTables();

    if (!existingTables.includes(table)) {
      return queryInterface.createTable(table, {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        mercadoPagoAccessTokenSandbox: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        mercadoPagoAccessTokenProduction: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        mercadoPagoWebhookSecret: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        productionEnabled: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        pixExpirationMinutes: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 60
        },
        companyId: {
          type: DataTypes.INTEGER,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: false,
          unique: true
        },
        createdAt: {
          type: DataTypes.DATE(6),
          allowNull: false
        },
        updatedAt: {
          type: DataTypes.DATE(6),
          allowNull: false
        }
      });
    }
  },
  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("FinancePaymentConfigs");
  }
};
