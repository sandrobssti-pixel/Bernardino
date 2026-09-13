import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import {
  IReceivedWhatsppOficial,
  IReceivedWhatsppOficialRead,
} from 'src/@core/interfaces/IWebsocket.interface';

@Injectable()
export class SocketService {
  private socket: Socket;
  private url: string;
  id: number;

  private logger: Logger = new Logger(`${SocketService.name}`);

  constructor() {}

  private async connect(id: number): Promise<void> {
    if (this.socket && this.socket.connected && this.id === id) {
      return;
    }

    if (this.socket && this.id !== id) {
      this.socket.removeAllListeners();
      this.socket.close();
    }

    this.url = process.env.URL_BACKEND_MULT100;

    if (!this.url) {
      throw new Error('Nenhuma configuração do url do backend');
    }

    this.id = id;

    await new Promise<void>((resolve, reject) => {
      const timeoutMs = 5000;
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout ao conectar no websocket (${timeoutMs}ms)`));
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(timeout);
        this.socket?.off('connect', onConnect);
        this.socket?.off('connect_error', onConnectError);
      };

      const onConnect = () => {
        cleanup();
        this.logger.log(
          `Conectado ao websocket do servidor ${this.url}/${this.id}`,
        );
        resolve();
      };

      const onConnectError = (error: any) => {
        cleanup();
        reject(error);
      };

      this.socket = io(`${this.url}/${id}`, {
        query: {
          token: `Bearer ${process.env.TOKEN_ADMIN || ''}`,
        },
        transports: ['websocket', 'polling'],
        reconnection: false,
        timeout: timeoutMs,
      });

      this.setupSocketEvents();
      this.socket.once('connect', onConnect);
      this.socket.once('connect_error', onConnectError);
    });
  }

  private async emitSafely(eventName: string, payload: any): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.socket.timeout(5000).emit(
        eventName,
        payload,
        (err: Error | null, response: any) => {
          if (err) {
            return reject(
              new Error(
                `Timeout/erro ao aguardar ACK do backend no evento ${eventName}: ${err.message}`,
              ),
            );
          }

          if (response?.ok === false) {
            return reject(
              new Error(
                `Backend retornou falha no evento ${eventName}: ${response?.error || 'erro desconhecido'}`,
              ),
            );
          }

          this.logger.log(
            `ACK recebido do backend para evento ${eventName} (companyId=${payload?.companyId})`,
          );
          resolve();
        },
      );
    });
  }

  async sendMessage(data: IReceivedWhatsppOficial) {
    try {
      this.logger.warn(`Conectando ao websocket da empresa ${data.companyId}`);
      await this.connect(data.companyId);

      this.logger.warn(
        `Enviando mensagem para o websocket para a empresa ${data.companyId}`,
      );
      await this.emitSafely('receivedMessageWhatsAppOficial', data);
    } catch (error: any) {
      this.logger.error(
        `Erro ao enviar mensagem para websocket da empresa ${data.companyId}: ${error?.message || error}`,
      );
    }
  }

  async readMessage(data: IReceivedWhatsppOficialRead) {
    try {
      this.logger.warn(`Conectando ao websocket da empresa ${data.companyId}`);
      await this.connect(data.companyId);

      this.logger.warn(
        `Enviando mensagem para o websocket para a empresa ${data.companyId}`,
      );
      await this.emitSafely('readMessageWhatsAppOficial', data);
    } catch (error: any) {
      this.logger.error(
        `Erro ao enviar readMessage para websocket da empresa ${data.companyId}: ${error?.message || error}`,
      );
    }
  }

  private setupSocketEvents(): void {
    this.socket.on('connect_error', (error) => {
      this.logger.error(`Erro de conexão: ${error}`);
    });

    this.socket.on('disconnect', () => {
      this.logger.warn(
        `Desconectado do websocket do servidor ${this.url}/${this.id}`,
      );
    });
  }
}
