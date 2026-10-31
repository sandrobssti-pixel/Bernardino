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
  AllowNull,
  Default
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

  // Botão dedicado em Arquivos da IA (v2.3.228) — "a IA pode mandar isso
  // automaticamente?" independente de "Permitir visão"/"Permitir editar"
  // da Mensagem Rápida de origem (esses dois só controlam se o item
  // ENTRA no catálogo; nunca controlaram se ele fica ativo pra IA usar).
  // `false` tira o item do que é mandado pro prompt da IA
  // (`OpenAiService.ts`) sem precisar apagar o item do catálogo.
  @Default(true)
  @Column
  aiEnabled: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default PromptFiles;
