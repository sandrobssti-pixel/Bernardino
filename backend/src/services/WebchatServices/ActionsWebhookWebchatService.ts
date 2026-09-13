import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import Chatbot from "../../models/Chatbot";
import ShowTicketService from "../TicketServices/ShowTicketService";
import ShowQueueService from "../QueueService/ShowQueueService";
import { IConnections, INodes } from "../WebhookService/DispatchWebHookService";
import formatBody from "../../helpers/Mustache";
import CreateLogTicketService from "../TicketServices/CreateLogTicketService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import { sendWebchatMedia, sendWebchatText } from "./sendWebchatMessage";
import { buildWebchatPublicUrl } from "../../helpers/BuildWebchatPublicUrl";

// Espelha ActionsWebhookFacebookService.ts (motor de execução do FlowBuilder),
// trocando apenas a forma de "enviar" a mensagem: aqui não existe API externa,
// então cada envio é só a persistência local via sendWebchatText/sendWebchatMedia
// (o widget recebe via polling). A árvore de nodes/connections do flow é a
// mesma estrutura usada por todos os canais.

interface NumberPhrase {
  number: string;
  name: string;
  email: string;
}

const intervalWhats = (time: string) => {
  const seconds = parseInt(time, 10) * 1000;
  return new Promise(resolve => setTimeout(resolve, Number.isFinite(seconds) ? seconds : 0));
};

async function updateQueueId(ticket: Ticket, companyId: number, queueId: number) {
  await ticket.update({
    status: "pending",
    queueId,
    userId: ticket.userId,
    companyId
  });

  await FindOrCreateATicketTrakingService({
    ticketId: ticket.id,
    companyId,
    whatsappId: ticket.whatsappId,
    userId: ticket.userId
  });

  await UpdateTicketService({
    ticketData: { status: "pending", queueId },
    ticketId: ticket.id,
    companyId
  });

  await CreateLogTicketService({
    ticketId: ticket.id,
    type: "queue",
    queueId
  });
}

const normalizeConditionValue = (value: any): string => String(value ?? "").trim();

const toConditionNumber = (value: any): number | null => {
  const normalized = normalizeConditionValue(value).replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const getNestedValue = (source: any, path: string): any => {
  if (!source || !path) return undefined;
  return String(path)
    .split(".")
    .reduce((acc, key) => (acc === null || acc === undefined ? undefined : acc[key]), source);
};

const buildFlowVariables = ({
  ticket,
  numberPhrase
}: {
  ticket?: Ticket | null;
  numberPhrase?: NumberPhrase;
}): Record<string, any> => {
  const ticketDataWebhook = (ticket?.dataWebhook || {}) as {
    variables?: Record<string, unknown>;
    apiResponse?: unknown;
  };

  return {
    nome: ticket?.contact?.name || numberPhrase?.name || "",
    numero: ticket?.contact?.number || numberPhrase?.number || "",
    email: ticket?.contact?.email || numberPhrase?.email || "",
    apiResponse: ticketDataWebhook.apiResponse,
    ...(ticketDataWebhook.variables || {})
  };
};

const resolveConditionLeftValue = (key: string, variables: Record<string, any>): any => {
  const trimmedKey = String(key || "").trim();
  if (!trimmedKey) return undefined;
  if (Object.prototype.hasOwnProperty.call(variables, trimmedKey)) return variables[trimmedKey];
  return getNestedValue(variables, trimmedKey);
};

const evaluateFlowCondition = (leftValue: any, opCode: number, rightValue: any): boolean => {
  const leftNum = toConditionNumber(leftValue);
  const rightNum = toConditionNumber(rightValue);
  const useNumeric = leftNum !== null && rightNum !== null;
  const left = useNumeric ? leftNum : normalizeConditionValue(leftValue);
  const right = useNumeric ? rightNum : normalizeConditionValue(rightValue);

  if (opCode === 1) return left === right;
  if (opCode === 2) return left >= right;
  if (opCode === 3) return left <= right;
  if (opCode === 4) return left < right;
  if (opCode === 5) return left > right;
  return false;
};

export const ActionsWebhookWebchatService = async (
  token: Whatsapp,
  idFlowDb: number,
  companyId: number,
  nodes: INodes[],
  connects: IConnections[],
  nextStage: string,
  dataWebhook: any,
  details: any,
  hashWebhookId: string,
  pressKey?: string,
  idTicket?: number,
  numberPhrase?: NumberPhrase
): Promise<string> => {
  const activeFlow = await FlowBuilderModel.findOne({
    where: { id: idFlowDb, company_id: companyId, active: true }
  });

  if (!activeFlow) {
    return "inactive";
  }

  let next = nextStage;
  const connectStatic = connects;
  const lengthLoop = nodes.length;

  let execCount = 0;
  let execFn = "";
  let ticket: any = null;
  let noAlterNext = false;
  let selectedQueueid = null;

  for (let i = 0; i < lengthLoop; i++) {
    let nodeSelected: any;
    if (idTicket) {
      const ticketInit = await Ticket.findOne({ where: { id: idTicket } });
      if (!ticketInit || ticketInit.status === "closed") {
        break;
      }
      await ticketInit.update({ dataWebhook: { status: "process" } });

      // Garante que "ticket" já esteja populado antes da primeira mensagem
      // ser enviada nesta iteração (ele só seria (re)atribuído no fim do
      // loop, tarde demais para o node inicial de um flow disparado sem
      // pressKey — ex.: flowIdWelcome/flowIdNotPhrase).
      if (!ticket) {
        ticket = ticketInit;
      }
    }

    if (pressKey) {
      if (pressKey === "parar") {
        if (idTicket) {
          const stopTicket = await Ticket.findOne({ where: { id: idTicket } });
          await stopTicket.update({ status: "closed" });
        }
        break;
      }

      if (execFn === "") {
        nodeSelected = { type: "menu" };
      } else {
        nodeSelected = nodes.filter(node => String(node.id) === String(execFn))[0];
      }
    } else {
      const otherNode = nodes.filter(node => String(node.id) === String(next))[0];
      if (otherNode) nodeSelected = otherNode;
    }

    if (!nodeSelected) break;

    if (nodeSelected.type === "ticket") {
      const queue = await ShowQueueService(nodeSelected.data.data.id, companyId);
      selectedQueueid = queue.id;
    }

    if (nodeSelected.type === "singleBlock") {
      for (let iLoc = 0; iLoc < nodeSelected.data.seq.length; iLoc++) {
        const elementNowSelected = nodeSelected.data.seq[iLoc];

        if (elementNowSelected.includes("message")) {
          const bodyFor = nodeSelected.data.elements.filter(
            (item: any) => item.number === elementNowSelected
          )[0].value;

          const ticketDetails = await ShowTicketService(ticket.id, companyId);
          const bodyBot: string = formatBody(`${bodyFor}`, ticket);

          await sendWebchatText(ticketDetails, companyId, bodyBot);

          await ticketDetails.update({
            lastMessage: formatBody(bodyFor, ticket.contact)
          });

          await updateQueueId(ticket, companyId, selectedQueueid);
        }

        if (elementNowSelected.includes("interval")) {
          await intervalWhats(
            nodeSelected.data.elements.filter(
              (item: any) => item.number === elementNowSelected
            )[0].value
          );
        }

        if (
          elementNowSelected.includes("img") ||
          elementNowSelected.includes("audio") ||
          elementNowSelected.includes("video")
        ) {
          const mediaType = elementNowSelected.includes("img")
            ? "image"
            : elementNowSelected.includes("audio")
            ? "audio"
            : "video";
          const relativePath = nodeSelected.data.elements.filter(
            (item: any) => item.number === elementNowSelected
          )[0].value;

          const mediaUrl = buildWebchatPublicUrl(relativePath);
          const ticketDetails = await ShowTicketService(ticket.id, companyId);

          await sendWebchatMedia(ticketDetails, companyId, mediaUrl, mediaType);

          await ticketDetails.update({
            lastMessage: formatBody(relativePath, ticket.contact)
          });
        }
      }
    }

    if (["img", "audio", "video"].includes(nodeSelected.type)) {
      const mediaType = nodeSelected.type === "img" ? "image" : nodeSelected.type;
      const mediaUrl = buildWebchatPublicUrl(nodeSelected.data.url);
      const ticketDetails = await ShowTicketService(ticket.id, companyId);

      await sendWebchatMedia(ticketDetails, companyId, mediaUrl, mediaType);

      await ticketDetails.update({
        lastMessage: formatBody(nodeSelected.data.url, ticket.contact)
      });
    }

    if (nodeSelected.type === "interval") {
      await intervalWhats(nodeSelected.data.sec);
    }

    let isRandomizer = false;
    if (nodeSelected.type === "randomizer") {
      const random = Math.random() < nodeSelected.data.percent / 100 ? "A" : "B";
      const resultConnect = connects.filter(
        connect => String(connect.source) === String(nodeSelected.id)
      );
      const handle = random === "A" ? "a" : "b";
      next = resultConnect.filter(item => item.sourceHandle === handle)[0]?.target || "";
      noAlterNext = true;
      isRandomizer = true;
    }

    let isCondition = false;
    if (nodeSelected.type === "condition") {
      const conditionVariables = buildFlowVariables({ ticket, numberPhrase });
      const leftValue = resolveConditionLeftValue(
        String(nodeSelected?.data?.key || ""),
        conditionVariables
      );
      const resultCondition = evaluateFlowCondition(
        leftValue,
        Number(nodeSelected?.data?.condition),
        nodeSelected?.data?.value
      );
      const resultConnect = connects.filter(
        connect => String(connect.source) === String(nodeSelected.id)
      );
      const targetHandle = resultCondition ? "a" : "b";
      const targetConnection = resultConnect.find(
        item => String(item.sourceHandle || "") === targetHandle
      );

      if (targetConnection?.target) {
        next = String(targetConnection.target);
        noAlterNext = true;
      } else {
        next = "";
        noAlterNext = false;
      }
      isCondition = true;
    }

    let isMenu = false;
    if (nodeSelected.type === "menu") {
      if (pressKey) {
        const normalizedPressKey = String(pressKey || "")
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .trim()
          .toLowerCase();

        if (
          Boolean(nodeSelected?.data?.includeMainMenuOption) &&
          String(pressKey || "").trim() === "#"
        ) {
          const startNode =
            nodes.find(item => item?.type === "start") || nodes.find(item => String(item?.id) === "1");
          const startTarget = startNode
            ? connectStatic.find(connection => String(connection.source) === String(startNode.id))
                ?.target
            : undefined;
          execFn = startTarget;
        } else if (
          Boolean(nodeSelected?.data?.includeExitOption) &&
          normalizedPressKey === "sair"
        ) {
          await UpdateTicketService({
            ticketData: {
              status: "closed",
              sendFarewellMessage: true,
              amountUsedBotQueues: 0
            },
            ticketId: ticket.id,
            companyId
          });
          break;
        }

        if (execFn === undefined || execFn === null || execFn === "") {
          const filterOne = connectStatic.filter(
            confil => String(confil.source) === String(next)
          );
          const filterTwo = filterOne.filter(filt2 => filt2.sourceHandle === "a" + pressKey);
          execFn = filterTwo.length > 0 ? filterTwo[0].target : undefined;
        }

        if (execFn === undefined) break;

        pressKey = "999";

        const isNodeExist = nodes.filter(item => String(item.id) === String(execFn));
        isMenu = isNodeExist.length > 0 ? isNodeExist[0].type === "menu" : false;
      } else {
        const optionsMenu = (nodeSelected?.data?.arrayOption || [])
          .map((item: any) => `[ ${item.number} ] - ${item.value}`)
          .join("\n");
        const mainMenuOptionText =
          String(nodeSelected?.data?.mainMenuOptionText || "").trim() || "Retornar ao Menu Principal";
        const exitOptionText =
          String(nodeSelected?.data?.exitOptionText || "").trim() || "Encerrar atendimento";
        const mainMenuOptionLine = Boolean(nodeSelected?.data?.includeMainMenuOption)
          ? `[ # ] - ${mainMenuOptionText}`
          : "";
        const exitOptionLine = Boolean(nodeSelected?.data?.includeExitOption)
          ? `[ Sair ] - ${exitOptionText}`
          : "";
        const extraLines = [mainMenuOptionLine, exitOptionLine].filter(Boolean).join("\n");
        const extraMenuBlock = extraLines ? `\n\n${extraLines}` : "";
        const menuCreate = `${nodeSelected.data.message}\n\n${optionsMenu}${extraMenuBlock}`;

        const ticketDetails = await ShowTicketService(ticket.id, companyId);
        await ticketDetails.update({
          lastMessage: formatBody(menuCreate, ticket.contact)
        });

        await sendWebchatText(ticketDetails, companyId, menuCreate);

        ticket = await Ticket.findOne({ where: { id: idTicket, companyId } });
        await ticket.update({
          status: "pending",
          queueId: ticket.queueId ? ticket.queueId : null,
          userId: null,
          companyId,
          flowWebhook: true,
          lastFlowId: nodeSelected.id,
          dataWebhook,
          hashFlowId: hashWebhookId,
          flowStopped: idFlowDb.toString()
        });

        break;
      }
    }

    let isContinue = false;
    if (pressKey === "999" && execCount > 0) {
      pressKey = undefined;
      // Após escolher opção de menu, o próximo loop deve executar o nó
      // escolhido (execFn), e não pular direto para o próximo dele.
      if (!noAlterNext) {
        await ticket.reload();
        next = execFn || "";
      }
      execFn = "";
    } else {
      let result: any;
      if (execFn) {
        // Sempre prioriza o destino escolhido no menu (a1/a2/a3...),
        // independente do tipo do próximo nó.
        result = { target: execFn };
        isContinue = true;
        pressKey = undefined;
        execFn = "";
      } else if (isMenu) {
        result = { target: execFn };
        isContinue = true;
        pressKey = undefined;
      } else if (isCondition) {
        result = next;
      } else if (isRandomizer) {
        result = next;
      } else {
        result = connects.filter(connect => String(connect.source) === String(nodeSelected.id))[0];
      }

      if (typeof result === "undefined") {
        next = "";
      } else if (!noAlterNext) {
        next = typeof result === "string" ? result : result.target;
      }
    }

    if (!pressKey && !isContinue) {
      const nextNode = connects.filter(
        connect => String(connect.source) === String(nodeSelected.id)
      ).length;
      if (nextNode === 0) {
        const finishedTicket = await Ticket.findOne({ where: { id: idTicket, companyId } });
        await finishedTicket.update({
          lastFlowId: null,
          dataWebhook: { status: "process" },
          queueId: finishedTicket.queueId ? finishedTicket.queueId : null,
          hashFlowId: null,
          flowWebhook: false,
          flowStopped: idFlowDb.toString()
        });
        break;
      }
    }

    if (next === "") break;

    ticket = await Ticket.findOne({ where: { id: idTicket, companyId } });
    await ticket.update({
      queueId: null,
      userId: null,
      companyId,
      flowWebhook: true,
      lastFlowId: nodeSelected.id,
      dataWebhook,
      hashFlowId: hashWebhookId,
      flowStopped: idFlowDb.toString()
    });

    noAlterNext = false;
    execCount++;
  }

  return "ds";
};
