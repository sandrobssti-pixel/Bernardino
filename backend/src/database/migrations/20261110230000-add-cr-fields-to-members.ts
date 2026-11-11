import { QueryInterface } from "sequelize";

// CR (Certificado de Registro) do PRÓPRIO associado — número, órgão
// emissor (Exército/Polícia Federal) e validade. Pedido do cliente a
// partir da referência real do clube-atirador.techsofttecnologia.com.br
// (tela "Editar Usuário"). SEPARADO de arma individual (cadastro de
// arma pessoal do associado fica pra uma entrega futura, por decisão
// explícita do cliente — "depois armas"). Múltiplas colunas num único
// migration: raw SQL com IF NOT EXISTS, nunca addColumn sequencial
// (convenção já documentada neste projeto — idempotência contra retry
// parcial). Ver docs/MANUAL_TECNICO.md.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      'ALTER TABLE "Members" ADD COLUMN IF NOT EXISTS "crNumber" VARCHAR(255) NOT NULL DEFAULT \'\';'
    );
    // Default "none" (não "" vazio) — mesmo motivo de cacCategory acima
    // (bug de exibição do <select> do MUI com "" selecionado, seção 236
    // do manual).
    await queryInterface.sequelize.query(
      "ALTER TABLE \"Members\" ADD COLUMN IF NOT EXISTS \"crIssuingAuthority\" VARCHAR(255) NOT NULL DEFAULT 'none';"
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE "Members" ADD COLUMN IF NOT EXISTS "crValidUntil" DATE;'
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Members", "crNumber");
    await queryInterface.removeColumn("Members", "crIssuingAuthority");
    await queryInterface.removeColumn("Members", "crValidUntil");
  }
};
