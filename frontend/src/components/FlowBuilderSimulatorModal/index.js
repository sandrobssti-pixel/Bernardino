import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField
} from "@material-ui/core";
import CloseIcon from "@material-ui/icons/Close";
import ReplayIcon from "@mui/icons-material/Replay";
import SendIcon from "@mui/icons-material/Send";

const MAX_STEPS = 80;

const botMsg = text => ({
  id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  from: "bot",
  text
});

const userMsg = text => ({
  id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  from: "user",
  text
});

const sysMsg = text => ({
  id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  from: "system",
  text
});

const normalizeText = value => String(value || "").trim();

const toNumber = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const evaluateCondition = (leftValue, opCode, rightValue) => {
  const leftNum = toNumber(leftValue);
  const rightNum = toNumber(rightValue);
  const useNumeric = leftNum !== null && rightNum !== null;
  const left = useNumeric ? leftNum : normalizeText(leftValue).toLowerCase();
  const right = useNumeric ? rightNum : normalizeText(rightValue).toLowerCase();

  if (opCode === 1) return left === right;
  if (opCode === 2) return left >= right;
  if (opCode === 3) return left <= right;
  if (opCode === 4) return left < right;
  if (opCode === 5) return left > right;
  return false;
};

const FlowBuilderSimulatorModal = ({ open, onClose, nodes = [], edges = [] }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [pendingInput, setPendingInput] = useState(null);
  const [hasStarted, setHasStarted] = useState(false);
  const variablesRef = useRef({});
  const chatBodyRef = useRef(null);

  const nodesById = useMemo(() => {
    const map = new Map();
    (nodes || []).forEach(node => map.set(String(node.id), node));
    return map;
  }, [nodes]);

  const startNodeId = useMemo(() => {
    const startNode = (nodes || []).find(node => node.type === "start");
    if (startNode) return String(startNode.id);
    if (nodes?.length) return String(nodes[0].id);
    return null;
  }, [nodes]);

  const edgeList = useMemo(() => edges || [], [edges]);

  const getNextTarget = useCallback(
    (sourceId, sourceHandle) => {
      const source = String(sourceId);
      const direct = edgeList.find(
        edge =>
          String(edge.source) === source &&
          String(edge.sourceHandle || "") === String(sourceHandle || "")
      );
      if (direct?.target) return String(direct.target);

      const fallback = edgeList.find(edge => String(edge.source) === source && edge.target);
      return fallback?.target ? String(fallback.target) : null;
    },
    [edgeList]
  );

  const appendMessages = useCallback(next => {
    if (!next?.length) return;
    setMessages(prev => [...prev, ...next]);
  }, []);

  const runFromNode = useCallback(
    (entryNodeId, stepContext = {}) => {
      let cursor = entryNodeId ? String(entryNodeId) : null;
      let steps = 0;
      const out = [];

      while (cursor && steps < MAX_STEPS) {
        steps += 1;
        const node = nodesById.get(String(cursor));
        if (!node) {
          out.push(sysMsg("Simulação encerrada: nó não encontrado."));
          cursor = null;
          break;
        }

        const { type, data = {} } = node;

        if (type === "start") {
          cursor = getNextTarget(node.id, "a");
          continue;
        }

        if (type === "message") {
          out.push(botMsg(normalizeText(data.label) || "(mensagem vazia)"));
          cursor = getNextTarget(node.id, "a");
          continue;
        }

        if (type === "interval") {
          out.push(sysMsg(`Aguardaria ${normalizeText(data.sec) || "0"} segundos (simulado).`));
          cursor = getNextTarget(node.id, "a");
          continue;
        }

        if (type === "img" || type === "audio" || type === "video") {
          out.push(botMsg(`[${type.toUpperCase()}] ${normalizeText(data.url || data.label || "")}`));
          cursor = getNextTarget(node.id, "a");
          continue;
        }

        if (type === "singleBlock") {
          const seq = Array.isArray(data.seq) ? data.seq : [];
          const elements = Array.isArray(data.elements) ? data.elements : [];
          if (!seq.length) {
            out.push(botMsg("[Conteudo] Bloco sem itens."));
          } else {
            seq.forEach(itemRef => {
              const element = elements.find(el => String(el.number) === String(itemRef));
              if (!element) return;
              const txt = normalizeText(element.value || element.original || "");
              if (element.type === "interval") {
                out.push(sysMsg(`Aguardaria ${txt || "0"} segundos (simulado).`));
              } else {
                out.push(botMsg(txt || `[${String(element.type || "item").toUpperCase()}]`));
              }
            });
          }
          cursor = getNextTarget(node.id, "a");
          continue;
        }

        if (type === "randomizer") {
          const percentA = Math.max(0, Math.min(100, Number(data.percent) || 0));
          const random = Math.random() * 100;
          const branch = random < percentA ? "a" : "b";
          out.push(sysMsg(`Randomizador escolheu a saida ${branch.toUpperCase()} (${random.toFixed(1)}%).`));
          cursor = getNextTarget(node.id, branch);
          continue;
        }

        if (type === "condition") {
          const left = variablesRef.current?.[data.key];
          const result = evaluateCondition(left, Number(data.condition), data.value);
          out.push(
            sysMsg(
              `Condicao ${normalizeText(data.key)} ${normalizeText(data.condition)} ${normalizeText(
                data.value
              )} => ${result ? "verdadeiro" : "falso"}`
            )
          );
          cursor = getNextTarget(node.id, result ? "a" : "b");
          continue;
        }

        if (type === "question") {
          const prompt =
            normalizeText(data?.typebotIntegration?.message) ||
            normalizeText(data.label) ||
            "Digite sua resposta:";
          out.push(botMsg(prompt));
          setPendingInput({
            kind: "question",
            nodeId: String(node.id),
            answerKey: data?.typebotIntegration?.answerKey || "answer"
          });
          cursor = null;
          break;
        }

        if (type === "menu") {
          const options = Array.isArray(data.arrayOption) ? data.arrayOption : [];
          const lines = [];
          lines.push(normalizeText(data.message) || "Selecione uma opcao:");
          lines.push("");
          options.forEach(option => {
            lines.push(`[${option.number}] ${normalizeText(option.value)}`);
          });
          if (data.includeMainMenuOption) {
            lines.push(`[#] ${normalizeText(data.mainMenuOptionText) || "Retornar ao Menu Principal"}`);
          }
          if (data.includeExitOption) {
            lines.push(`[Sair] ${normalizeText(data.exitOptionText) || "Encerrar atendimento"}`);
          }

          out.push(botMsg(lines.join("\n")));
          setPendingInput({
            kind: "menu",
            nodeId: String(node.id),
            options,
            includeMainMenuOption: Boolean(data.includeMainMenuOption),
            includeExitOption: Boolean(data.includeExitOption)
          });
          cursor = null;
          break;
        }

        if (type === "ticket") {
          out.push(botMsg(`[Simulacao] Encaminharia para fila/setor: ${normalizeText(data.name || "sem nome")}`));
          cursor = null;
          break;
        }

        if (type === "openai" || type === "typebot") {
          out.push(
            botMsg(
              `[Simulacao] Bloco ${type.toUpperCase()} identificado. No simulador local ele nao executa integracao externa.`
            )
          );
          cursor = getNextTarget(node.id, "a");
          continue;
        }

        if (type === "billingSecondCopy" || type === "httpRequest") {
          out.push(
            botMsg(
              `[Simulacao] Bloco ${type} identificado. No simulador local ele nao consulta servicos externos.`
            )
          );
          cursor = getNextTarget(node.id, "success") || getNextTarget(node.id, "a");
          continue;
        }

        out.push(sysMsg(`Tipo de bloco nao suportado no simulador: ${type}`));
        cursor = getNextTarget(node.id, "a");
      }

      if (steps >= MAX_STEPS) {
        out.push(sysMsg("Simulação interrompida por limite de passos para evitar loop infinito."));
      }

      appendMessages(out);
      if (!stepContext?.keepPending) {
        setPendingInput(prev => prev);
      }
    },
    [appendMessages, getNextTarget, nodesById]
  );

  const startSimulation = useCallback(() => {
    variablesRef.current = {};
    setInputValue("");
    setPendingInput(null);
    setMessages([]);
    setHasStarted(false);
  }, []);

  useEffect(() => {
    if (open) {
      startSimulation();
    }
  }, [open, startSimulation]);

  useEffect(() => {
    if (!chatBodyRef.current) return;
    chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [messages]);

  const handleUserSubmit = useCallback(() => {
    const text = normalizeText(inputValue);
    if (!text) return;

    appendMessages([userMsg(text)]);
    setInputValue("");

    if (!hasStarted) {
      setHasStarted(true);
      if (!startNodeId) {
        appendMessages([sysMsg("Fluxo vazio para simular.")]);
        return;
      }
      runFromNode(startNodeId);
      return;
    }

    if (!pendingInput) {
      appendMessages([sysMsg("Nao ha entrada pendente no fluxo neste momento.")]);
      return;
    }

    if (pendingInput.kind === "question") {
      const nextVars = {
        ...variablesRef.current,
        [pendingInput.answerKey]: text
      };
      variablesRef.current = nextVars;
      setPendingInput(null);
      const nextNode = getNextTarget(pendingInput.nodeId, "a");
      if (!nextNode) {
        appendMessages([sysMsg("Pergunta sem conexao de saida.")]);
        return;
      }
      runFromNode(nextNode);
      return;
    }

    if (pendingInput.kind === "menu") {
      const lower = text.toLowerCase();
      if (pendingInput.includeExitOption && ["sair", "exit"].includes(lower)) {
        setPendingInput(null);
        appendMessages([botMsg("Fluxo encerrado (simulacao).")]);
        return;
      }

      if (pendingInput.includeMainMenuOption && text === "#") {
        setPendingInput(null);
        if (!startNodeId) {
          appendMessages([sysMsg("Nao foi possivel retornar ao inicio: inicio nao encontrado.")]);
          return;
        }
        runFromNode(startNodeId);
        return;
      }

      const selected = pendingInput.options.find(
        option => String(option.number) === text || normalizeText(option.value).toLowerCase() === lower
      );

      if (!selected) {
        appendMessages([botMsg("Opcao invalida. Digite um numero valido do menu.")]);
        return;
      }

      setPendingInput(null);
      const handleId = `a${selected.number}`;
      const nextNode = getNextTarget(pendingInput.nodeId, handleId);
      if (!nextNode) {
        appendMessages([sysMsg(`Opcao ${selected.number} sem conexao de saida.`)]);
        return;
      }
      runFromNode(nextNode);
    }
  }, [
    appendMessages,
    getNextTarget,
    hasStarted,
    inputValue,
    pendingInput,
    runFromNode,
    startNodeId
  ]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" classes={{ paper: "fb-sim-modal-paper" }}>
      <DialogTitle className="fb-sim-modal-title">
        <span className="fb-sim-title-text">🤖 Simulador de Chat</span>
        <IconButton onClick={onClose} size="small" className="fb-sim-close-btn">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers className="fb-sim-modal-content">
        <div className="fb-sim-chat" ref={chatBodyRef}>
          {!hasStarted && (
            <div className="fb-sim-empty-state">
              Para inicar uma conversa, envie uma mensagem
            </div>
          )}
          {messages.map(message => (
            <div key={message.id} className={`fb-sim-row fb-sim-row--${message.from}`}>
              <div className={`fb-sim-bubble fb-sim-bubble--${message.from}`}>{message.text}</div>
            </div>
          ))}
        </div>

        <div className="fb-sim-input-row">
          <TextField
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleUserSubmit();
              }
            }}
            placeholder="Digite sua mensagem aqui"
            variant="outlined"
            size="small"
            fullWidth
            className="fb-sim-textfield"
          />
          <Button
            variant="contained"
            onClick={handleUserSubmit}
            startIcon={<SendIcon />}
            className="fb-sim-send-btn"
          >
            Enviar
          </Button>
        </div>
      </DialogContent>

      <DialogActions className="fb-sim-actions">
        <Button onClick={startSimulation} startIcon={<ReplayIcon />} className="fb-sim-restart-btn">
          Reiniciar Simulação
        </Button>
        <Button onClick={onClose}>
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FlowBuilderSimulatorModal;
