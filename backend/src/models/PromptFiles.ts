import {
  Table,
  Column,
  Model,
  ForeignKey,
  PrimaryKey,
  AutoIncrement,
  CreatedAt,
  UpdatedAt,
  BelongsTo,
  AllowNull
} from "sequelize-typescript";
import Company from "./Company";
import QuickMessage from "./QuickMessage";

@Table({
  tableName: "PromptFiles"
})
class PromptFiles extends Model<PromptFiles> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @AllowNull(false)
  @Column
  name: string;

  @AllowNull(false)
  @Column
  description: string;

  // Nulo quando é um item só de texto (mediaType = "text", ver
  // quickMessagePromptFileSync.ts) — sem arquivo físico nenhum.
  @Column
  path: string;

  @AllowNull(false)
  @Column
  mediaType: string;

  // Conteúdo textual do item, usado quando mediaType = "text" (espelho de
  // uma mensagem rápida sem anexo). Nulo pra item com arquivo de verdade.
  @Column
  textContent: string;

  // Preenchido quando este item foi espelhado automaticamente de uma
  // Mensagem Rápida "geral" (ver SyncFromQuickMessageService) — nulo pra
  // item cadastrado manualmente aqui em Arquivos da IA.
  @ForeignKey(() => QuickMessage)
  @Column
  sourceQuickMessageId: number;

  @BelongsTo(() => QuickMessage)
  sourceQuickMessage: QuickMessage;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default PromptFiles;
