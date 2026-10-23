import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Company from "./Company";

// "Números sem IA" — contatos que nunca recebem resposta automática do
// Assistente IA (conexão ou nó do Flowbuilder), mesmo com tudo configurado
// certo. Checado em `wbotMessageListener.ts` antes de chamar `handleOpenAi`.
@Table
class PromptBlockedNumber extends Model<PromptBlockedNumber> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  // Sempre só dígitos (sem +, espaço, parênteses, sufixo @s.whatsapp.net
  // etc.) — mesma normalização usada no resto do sistema pra comparar
  // número de WhatsApp.
  @AllowNull(false)
  @Column
  number: string;

  @Column
  label: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default PromptBlockedNumber;
