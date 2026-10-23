import {
  AfterFind,
  AllowNull,
  AutoIncrement,
  BeforeCreate,
  BeforeUpdate,
  BelongsTo,
  Column,
  CreatedAt,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from "sequelize-typescript";
import Queue from "./Queue";
import Company from "./Company";
import { encryptApiKey, decryptApiKey } from "../utils/promptApiKeyCrypto";

@Table
class Prompt extends Model<Prompt> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @AllowNull(false)
  @Column
  prompt: string;

  @AllowNull(false)
  @Column
  apiKey: string;

  // v2.3.196 — cifra a API key antes de gravar (AES-256-GCM, ver
  // promptApiKeyCrypto.ts) e decifra toda vez que um Prompt é carregado
  // do banco — pro resto do sistema (OpenAiService.ts e afins) nunca
  // precisar saber que ela está cifrada: sempre recebem o valor real em
  // texto puro, exatamente como antes. Sem a variável de ambiente
  // `PROMPT_API_KEY_ENCRYPTION_KEY` configurada, `encryptApiKey` devolve
  // o texto como veio (sem cifrar) — não quebra o cadastro/edição nem o
  // atendimento via IA enquanto a variável não existir no servidor.
  @BeforeCreate
  @BeforeUpdate
  static encryptApiKeyHook(instance: Prompt): void {
    if (instance.apiKey) {
      instance.apiKey = encryptApiKey(instance.apiKey);
    }
  }

  @AfterFind
  static decryptApiKeyHook(instances: Prompt | Prompt[] | null): void {
    if (!instances) return;
    const list = Array.isArray(instances) ? instances : [instances];
    list.forEach(instance => {
      if (instance?.apiKey) {
        instance.apiKey = decryptApiKey(instance.apiKey);
      }
    });
  }

  @Default("openai")
  @AllowNull(false)
  @Column
  provider: string;

  @Column({ defaultValue: 10 })
  maxMessages: number;

  @Column({ defaultValue: 3 })
  maxResponseMessages: number;

  @Column({ defaultValue: 100 })
  maxTokens: number;

  @Column({ defaultValue: 1 })
  temperature: number;

  @Column({ defaultValue: 0 })
  promptTokens: number;

  @Column({ defaultValue: 0 })
  completionTokens: number;

  @Column({ defaultValue: 0 })
  totalTokens: number;

  @AllowNull(false)
  @Column
  voice: string;

  @AllowNull(true)
  @Column
  voiceKey: string;

  @AllowNull(true)
  @Column
  voiceRegion: string;

  @AllowNull(false)
  @Column
  model: string; // Added model as a STRING column

  @AllowNull
  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Prompt;
