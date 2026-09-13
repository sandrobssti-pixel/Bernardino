import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { WhatsappOficialService } from '../whatsapp-oficial/whatsapp-oficial.service';
import { WhatsAppOficial } from 'src/@core/domain/entities/whatsappOficial.model';
import { AppError } from 'src/@core/infra/errors/app.error';
import { RedisService } from 'src/@core/infra/redis/RedisService.service';
import { RabbitMQService } from 'src/@core/infra/rabbitmq/RabbitMq.service';
import {
  IWebhookWhatsApp,
  IWebhookWhatsAppEntryChangesValueMessages,
} from './interfaces/IWebhookWhatsApp.inteface';
import { SocketService } from 'src/@core/infra/socket/socket.service';
import {
  IMessageReceived,
  IReceivedWhatsppOficial,
} from 'src/@core/interfaces/IWebsocket.interface';
import { MetaService } from 'src/@core/infra/meta/meta.service';

@Injectable()
export class WebhookService {
  private logger: Logger = new Logger(`${WebhookService.name}`);
  private messagesPermitidas = [
    'text',
    'image',
    'audio',
    'document',
    'video',
    'location',
    'contacts',
    'order',
    'interactive',
    'referral',
    'sticker',
  ];

  constructor(
    private readonly rabbit: RabbitMQService,
    private readonly whatsAppService: WhatsappOficialService,
    private readonly redis: RedisService,
    private readonly socket: SocketService,
    private readonly meta: MetaService,
  ) {}

  /**
   * Função auxiliar para serializar objetos com segurança,
   * evitando referências circulares e stack overflow
   */
  private safeStringify(obj: any, maxDepth: number = 5): string {
    try {
      // Cria uma cópia segura do objeto antes de serializar
      const safeCopy = this.createSafeCopy(obj, maxDepth);
      return JSON.stringify(safeCopy);
    } catch (error: any) {
      this.logger.error(`Erro ao serializar objeto: ${error.message}`);
      return JSON.stringify({ 
        error: 'Failed to stringify object',
        type: typeof obj 
      });
    }
  }

  /**
   * Cria uma cópia segura do objeto, limitando profundidade e removendo circularidade
   */
  private createSafeCopy(
    obj: any,
    maxDepth: number,
    currentDepth: number = 0,
    seen: WeakSet<any> = new WeakSet(),
  ): any {
    // Limite de profundidade alcançado
    if (currentDepth >= maxDepth) {
      return '[Max Depth Reached]';
    }

    // Valores primitivos e null/undefined
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    // Detecta referências circulares
    if (seen.has(obj)) {
      return '[Circular Reference]';
    }

    // Adiciona à lista de objetos já vistos
    seen.add(obj);

    try {
      // Arrays
      if (Array.isArray(obj)) {
        // Limita arrays muito grandes
        const maxArrayLength = 100;
        const arraySlice = obj.slice(0, maxArrayLength);
        const result = arraySlice.map((item) =>
          this.createSafeCopy(item, maxDepth, currentDepth + 1, seen),
        );
        
        if (obj.length > maxArrayLength) {
          result.push(`[Array truncated: ${obj.length - maxArrayLength} more items]`);
        }
        
        return result;
      }

      // Objetos
      const result: any = {};
      const keys = Object.keys(obj);

      // Limita número de propriedades para evitar objetos muito grandes
      const maxKeys = 50;
      const keysToProcess = keys.slice(0, maxKeys);

      for (const key of keysToProcess) {
        try {
          const value = obj[key];

          // Pula funções
          if (typeof value === 'function') {
            continue;
          }

          // Pula valores muito grandes (ex: buffers enormes)
          if (typeof value === 'string' && value.length > 10000) {
            result[key] = `[String too large: ${value.length} chars]`;
            continue;
          }

          result[key] = this.createSafeCopy(
            value,
            maxDepth,
            currentDepth + 1,
            seen,
          );
        } catch (error) {
          result[key] = '[Error accessing property]';
        }
      }

      if (keys.length > maxKeys) {
        result['_truncated'] = `${keys.length - maxKeys} more properties`;
      }

      return result;
    } finally {
      // Remove da lista após processar (permite que o mesmo objeto apareça em diferentes ramos)
      seen.delete(obj);
    }
  }

  /**
   * Cria uma versão simplificada do body para logs
   */
  private createSafeLogObject(body: any): any {
    try {
      return {
        object: body?.object,
        entry: body?.entry?.map((e: any) => ({
          id: e?.id,
          changes: e?.changes?.map((c: any) => ({
            field: c?.field,
            value: {
              messaging_product: c?.value?.messaging_product,
              metadata: c?.value?.metadata,
              messages_count: c?.value?.messages?.length || 0,
              statuses_count: c?.value?.statuses?.length || 0,
            },
          })),
        })),
      };
    } catch (error) {
      return { error: 'Could not create safe log object' };
    }
  }

  async forwardToWebhook(whats: WhatsAppOficial, body: any) {
    try {
      const {
        n8n_webhook_url,
        auth_token_n8n,
        chatwoot_webhook_url,
        auth_token_chatwoot,
        typebot_webhook_url,
        auth_token_typebot,
        crm_webhook_url,
        auth_token_crm,
      } = whats;

      try {
        if (!!n8n_webhook_url) {
          this.sendToWebhook(n8n_webhook_url, auth_token_n8n, body);
        }

        if (!!chatwoot_webhook_url) {
          this.sendToWebhook(chatwoot_webhook_url, auth_token_chatwoot, body);
        }

        if (!!typebot_webhook_url) {
          this.sendToWebhook(typebot_webhook_url, auth_token_typebot, body);
        }

        if (!!crm_webhook_url) {
          this.sendToWebhook(crm_webhook_url, auth_token_crm, body);
        }
      } catch (error: any) {
        this.logger.error(
          `forwardToWebhook - Erro ao enviar webhook - ${error.message}`,
        );
        throw new AppError(error.message, HttpStatus.BAD_REQUEST);
      }
    } catch (error: any) {
      this.logger.error(
        `forwardToWebhook - Erro nos webhook - ${error.message}`,
      );
      throw new AppError(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async sendToWebhook(webhook_url: string, token: string, body: any) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const response = await fetch(webhook_url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      this.logger.log('Resposta do encaminhamento do webhook', {
        webhook_url,
        status: response.status,
        hasData: !!responseData,
      });
    } catch (error: any) {
      this.logger.error('Erro ao encaminhar para o webhook', {
        erro: error.message,
        webhook_url,
      });
      return null;
    }
  }

  async webhookCompanyConexao(companyId: number, conexaoId: number, data: any) {
    try {
      const company = await this.whatsAppService.prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) throw new Error('Empresa não encontrada');

      const whats = await this.whatsAppService.prisma.whatsappOficial.findFirst(
        {
          where: { id: conexaoId, companyId, deleted_at: null },
          include: { company: true },
        },
      );

      if (!whats) throw new Error('Configuração não encontrada');

      const body: IWebhookWhatsApp = data?.body || data;

      if (body.object == 'whatsapp_business_account') {
        const { entry } = body;

        for (const e of entry) {
          for (const change of e.changes) {
            if (change.field == 'messages') {
              const { value } = change;

              if (value?.statuses != null) {
                this.logger.log('Webhook recebido (status):', {
                  companyId,
                  statuses: value.statuses.map((s) => ({
                    id: s.id,
                    status: s.status,
                  })),
                });
                for (const status of value.statuses) {
                  this.socket.readMessage({
                    companyId: company.idEmpresaMult100,
                    messageId: status.id,
                    token: whats.token_mult100,
                  });
                }
              } else {
                const contact = value.contacts[0];

                for (const message of value.messages) {
                  if (this.messagesPermitidas.some((m) => m == message.type)) {
                    this.logger.log('Webhook recebido (mensagem):', {
                      companyId,
                      messageType: message.type,
                      messageId: message.id,
                      from: message.from,
                    });

                    if (!!whats.use_rabbitmq) {
                      const exchange = companyId;
                      const queue = `${whats.phone_number}`.replace('+', '');
                      const routingKey = whats.rabbitmq_routing_key;

                      await this.rabbit.sendToRabbitMQ(whats, body);
                      this.logger.log(
                        `Enviado para o RabbitMQ com sucesso. Vinculando fila '${queue}' à exchange '${exchange}' ${!!routingKey ? `com routing key '${routingKey}` : ''} '...`,
                      );
                    }

                    const messages = await this.redis.get(
                      `messages:${companyId}:${conexaoId}`,
                    );

                    if (!!messages) {
                      try {
                        const messagesStored: Array<any> = JSON.parse(
                          messages,
                        ) as Array<any>;

                        messagesStored.push(body);

                        await this.redis.set(
                          `messages:${companyId}:${conexaoId}`,
                          this.safeStringify(messagesStored),
                        );
                      } catch (error: any) {
                        this.logger.error(
                          `Erro ao processar mensagens do Redis: ${error.message}`,
                        );
                        // Em caso de erro, substitui com a mensagem atual
                        await this.redis.set(
                          `messages:${companyId}:${conexaoId}`,
                          this.safeStringify([body]),
                        );
                      }
                    } else {
                      await this.redis.set(
                        `messages:${companyId}:${conexaoId}`,
                        this.safeStringify([body]),
                      );
                    }

                    this.logger.log(
                      'Enviando mensagem para o servidor do websocket',
                    );

                    let file;
                    let idFile;
                    let bodyMessage;
                    let quoteMessageId;
                    switch (message.type) {
                      case 'video':
                        idFile = message.video.id;
                        file = await this.meta.downloadFileMeta(
                          idFile,
                          change.value.metadata.phone_number_id,
                          whats.send_token,
                          company.id,
                          whats.id,
                        );
                        break;
                      case 'document':
                        idFile = message.document.id;
                        file = await this.meta.downloadFileMeta(
                          idFile,
                          change.value.metadata.phone_number_id,
                          whats.send_token,
                          company.id,
                          whats.id,
                        );
                        break;
                      case 'image':
                        idFile = message.image.id;
                        file = await this.meta.downloadFileMeta(
                          idFile,
                          change.value.metadata.phone_number_id,
                          whats.send_token,
                          company.id,
                          whats.id,
                        );
                        break;
                      case 'audio':
                        idFile = message.audio.id;
                        file = await this.meta.downloadFileMeta(
                          idFile,
                          change.value.metadata.phone_number_id,
                          whats.send_token,
                          company.id,
                          whats.id,
                        );
                        break;
                      case 'interactive':
                        file = null;
                        bodyMessage =
                          message.interactive.button_reply?.id ||
                          message.interactive.list_reply?.id;
                        break;
                      case 'location':
                        bodyMessage = JSON.stringify(message.location);
                        break;
                      case 'contacts':
                        bodyMessage = {
                          contacts: message.contacts,
                        };
                        break;
                      case 'sticker':
                        idFile = message.sticker.id;
                        file = await this.meta.downloadFileMeta(
                          idFile,
                          change.value.metadata.phone_number_id,
                          whats.send_token,
                          company.id,
                          whats.id,
                        );
                        break;
                      case 'order':
                        bodyMessage = JSON.stringify(message.order);
                        break;
                      default:
                        file = null;
                        bodyMessage = message.text.body;
                        quoteMessageId = message.context?.id;
                        break;
                    }

                    const msg: IMessageReceived = {
                      timestamp: +message.timestamp,
                      type: message.type,
                      text: bodyMessage,
                      file: !!file ? file.base64 : null,
                      mimeType: !!file ? file.mimeType : null,
                      idFile,
                      idMessage: message.id,
                      quoteMessageId,
                    };

                    const data: IReceivedWhatsppOficial = {
                      companyId: company.idEmpresaMult100,
                      nameContact: contact.profile.name,
                      message: msg,
                      token: whats.token_mult100,
                      fromNumber: message.from,
                    };

                    this.socket.sendMessage(data);

                    await this.forwardToWebhook(whats, body);
                    this.logger.log('Enviado para o Webhook com sucesso.');
                  }
                }
              }
            }
          }
        }

        return true;
      } else {
        this.logger.error(`Evento não tratado: ${JSON.stringify(body)}`);
      }

      return true;
    } catch (error: any) {
      this.logger.error(
        `Erro no POST /webhook/:companyId/:conexaoId - ${error.message}`,
      );
      throw new AppError(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async webhookCompany(
    companyId: number,
    conexaoId: number,
    mode: string,
    verify_token: string,
    challenge: string,
  ) {
    try {
      const whats = await this.whatsAppService.prisma.whatsappOficial.findFirst(
        { where: { id: conexaoId, companyId, deleted_at: null } },
      );

      if (!whats) throw new Error('Configuração não encontrada');

      if (mode === 'subscribe' && verify_token === whats.token_mult100) {
        this.logger.log('WEBHOOK VERIFICADO para a empresa:', companyId);

        return challenge;
      } else {
        this.logger.error(
          'Falha na verificação do webhook para a empresa:',
          companyId,
        );
        throw new Error(
          `Falha na verificação do webhook para a empresa: ${companyId}`,
        );
      }
    } catch (error: any) {
      this.logger.error(`webhookCompany - ${error.message}`);
      throw new AppError(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}
