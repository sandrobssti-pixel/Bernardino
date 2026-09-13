import formatBody from "../helpers/Mustache";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import emitOutgoingMessageFallback from "../helpers/EmitOutgoingMessageFallback";
import persistWuzapiOutgoingMessage from "../helpers/PersistWuzapiOutgoingMessage";
import {
  FLOW_REENGAGEMENT_ENABLED,
  FLOW_REENGAGEMENT_QUEUE_KEY,
  buildUniqueFlowReengagementJobId,
  parseFlowReengagementSettings
} from "../helpers/FlowReengagementSettings";
import { FlowBuilderModel } from "../models/FlowBuilder";
import Ticket from "../models/Ticket";
import BullQueues from "../libs/queue";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";

interface IJobData {
  ticketId: number;
  companyId: number;
  flowId: number;
  lastFlowId: string;
  action: "message" | "close";
  stepIndex?: number;
}

export default {
  key: FLOW_REENGAGEMENT_QUEUE_KEY,

  async handle({ data }) {
    try {
      if (!FLOW_REENGAGEMENT_ENABLED) {
        return;
      }

      const {
        ticketId,
        companyId,
        flowId,
        lastFlowId,
        action,
        stepIndex
      } = data as IJobData;

      const ticket = await Ticket.findOne({
        where: {
          id: ticketId,
          companyId
        }
      });

      if (!ticket) {
        return;
      }

      if (ticket.status === "closed") {
        return;
      }

      if (!ticket.flowWebhook) {
        return;
      }

      // Se o ticket já não estiver mais parado no mesmo fluxo/nó, o contato
      // seguiu em frente (ou o fluxo mudou) entre o agendamento e o disparo
      // deste job — não faz sentido mandar follow-up nem fechar o ticket.
      if (String(ticket.flowStopped || "") !== String(flowId)) {
        return;
      }

      if (String(ticket.lastFlowId || "") !== String(lastFlowId || "")) {
        return;
      }

      const flow = await FlowBuilderModel.findOne({
        where: {
          id: flowId,
          company_id: companyId
        }
      });

      if (!flow?.flow) {
        return;
      }

      const settings = parseFlowReengagementSettings(flow.flow["settings"]);

      if (!settings.enabled) {
        return;
      }

      if (action === "close") {
        if (!settings.autoClose.enabled) {
          return;
        }

        await UpdateTicketService({
          ticketData: {
            status: "closed",
            sendFarewellMessage: true,
            amountUsedBotQueues: 0
          },
          ticketId: ticket.id,
          companyId
        });

        return;
      }

      const step = settings.steps[stepIndex || 0];

      if (!step) {
        return;
      }

      const ticketDetails = await ShowTicketService(ticket.id, companyId);

      const sentMessage = await SendWhatsAppMessage({
        body: step.message,
        ticket: ticketDetails,
        quotedMsg: null
      });

      SetTicketMessagesAsRead(ticketDetails);
      await ticketDetails.update({
        lastMessage: formatBody(step.message, ticketDetails)
      });

      const isWuzapiTicket =
        String((ticketDetails as any)?.whatsapp?.provider || "").toLowerCase() ===
        "wuzapi";

      // Conexões WuzAPI não têm eco próprio de mensagem enviada, então a
      // Message nunca era criada e o chat não atualizava (só o resumo do
      // ticket, gravado acima).
      if (isWuzapiTicket) {
        await persistWuzapiOutgoingMessage({
          ticket: ticketDetails,
          sentMessage,
          body: formatBody(step.message, ticketDetails),
          isForwarded: false
        }).catch(() => {});
      }

      // Sem isso, a mensagem chega pro contato e atualiza o resumo do
      // ticket na lista, mas não aparece ao vivo na tela de atendimento
      // até o usuário recarregar — o eco do Baileys que cria a Message
      // nem sempre dispara o evento de socket a tempo neste contexto de
      // job em background.
      emitOutgoingMessageFallback({
        companyId,
        wid: (sentMessage as any)?.key?.id
      }).catch(() => {});

      const nextStepIndex = (stepIndex || 0) + 1;
      const nextStep = settings.steps[nextStepIndex];

      if (nextStep) {
        await BullQueues.add(
          FLOW_REENGAGEMENT_QUEUE_KEY,
          {
            ticketId,
            companyId,
            flowId,
            lastFlowId,
            action: "message",
            stepIndex: nextStepIndex
          },
          {
            delay: nextStep.minutes * 60 * 1000,
            jobId: buildUniqueFlowReengagementJobId(ticketId)
          }
        );
      } else if (settings.autoClose.enabled && settings.autoClose.minutes >= 1) {
        await BullQueues.add(
          FLOW_REENGAGEMENT_QUEUE_KEY,
          {
            ticketId,
            companyId,
            flowId,
            lastFlowId,
            action: "close"
          },
          {
            delay: settings.autoClose.minutes * 60 * 1000,
            jobId: buildUniqueFlowReengagementJobId(ticketId)
          }
        );
      }
    } catch (error) {
      console.log("flowReengagementQueue error", error);
    }
  }
};
