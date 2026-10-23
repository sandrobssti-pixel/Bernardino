import { QueryInterface, DataTypes } from "sequelize";

interface ExistingTables {
  [key: string]: any;
}

// Cliente do Despachante Bélico — ver backend/src/models/WeaponDispatchClient.ts
// e docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "WeaponDispatchClients";
    const existingTables: ExistingTables = await queryInterface.showAllTables();

    if (!existingTables.includes(table)) {
      await queryInterface.createTable(table, {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false
        },
        cpf: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        whatsapp: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: ""
        },
        // Sem DEFAULT de propósito — nulo até o cliente de verdade ter uma
        // senha salva (ver weaponDispatchCrypto.ts).
        govBrPasswordEncrypted: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        govBrPasswordUpdatedAt: {
          type: DataTypes.DATE(6),
          allowNull: true
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        contactId: {
          type: DataTypes.INTEGER,
          references: { model: "Contacts", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
          allowNull: true
        },
        companyId: {
          type: DataTypes.INTEGER,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: false
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

    // CPF único por empresa, mas só quando preenchido (índice parcial —
    // mesmo padrão de FinanceProduct.serialNumber, ver skill atendeflow-dev
    // seção 11) — cliente sem CPF cadastrado ainda não colide com outro.
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_weapon_dispatch_clients_company_cpf
      ON "WeaponDispatchClients" ("companyId", "cpf")
      WHERE "cpf" IS NOT NULL AND "cpf" <> '';
    `);
  },
  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("WeaponDispatchClients");
  }
};
