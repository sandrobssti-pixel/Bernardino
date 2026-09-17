import React, {
  useState,
  useEffect,
  useReducer,
  useContext,
  useCallback,
  useRef,
} from "react";
import { SiOpenai } from "react-icons/si";
import typebotIcon from "../../assets/typebot-ico.png";

import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";

import audioNode from "./nodes/audioNode";
import typebotNode from "./nodes/typebotNode";
import openaiNode from "./nodes/openaiNode";
import messageNode from "./nodes/messageNode.js";
import startNode from "./nodes/startNode";
import menuNode from "./nodes/menuNode";
import intervalNode from "./nodes/intervalNode";
import imgNode from "./nodes/imgNode";
import randomizerNode from "./nodes/randomizerNode";
import videoNode from "./nodes/videoNode";
import questionNode from "./nodes/questionNode";
import conditionNode from "./nodes/conditionNode";
import tagNode from "./nodes/tagNode";
import kanbanNode from "./nodes/kanbanNode";
import switchFlowNode from "./nodes/switchFlowNode";
import httpRequestNode from "./nodes/httpRequestNode";
import billingSecondCopyNode from "./nodes/billingSecondCopyNode";

import api from "../../services/api";

import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import {
  Stack,
  Typography,
} from "@mui/material";
import { useParams } from "react-router-dom/cjs/react-router-dom.min";
import {
  Box,
  CircularProgress,
} from "@material-ui/core";
import BallotIcon from '@mui/icons-material/Ballot';

import "reactflow/dist/style.css";
import "./flowbuilder.css";
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
} from "react-flow-renderer";
import FlowBuilderAddTextModal from "../../components/FlowBuilderAddTextModal";
import FlowBuilderIntervalModal from "../../components/FlowBuilderIntervalModal";
import FlowBuilderConditionModal from "../../components/FlowBuilderConditionModal";
import FlowBuilderMenuModal from "../../components/FlowBuilderMenuModal";
import {
  AccessTime,
  CallSplit,
  DynamicFeed,
  Image,
  ImportExport,
  LibraryBooks,
  Message,
  MicNone,
  LocalOffer,
  ViewKanban,
  Videocam,
} from "@mui/icons-material";
import RemoveEdge from "./nodes/removeEdge";
import FlowBuilderAddImgModal from "../../components/FlowBuilderAddImgModal";
import FlowBuilderTicketModal from "../../components/FlowBuilderAddTicketModal";
import FlowBuilderAddAudioModal from "../../components/FlowBuilderAddAudioModal";

import { useNodeStorage } from "../../stores/useNodeStorage";
import FlowBuilderRandomizerModal from "../../components/FlowBuilderRandomizerModal";
import FlowBuilderAddVideoModal from "../../components/FlowBuilderAddVideoModal";
import FlowBuilderSingleBlockModal from "../../components/FlowBuilderSingleBlockModal";
import singleBlockNode from "./nodes/singleBlockNode";
import { colorPrimary } from "../../styles/styles";
import ticketNode from "./nodes/ticketNode";
import { ConfirmationNumber } from "@material-ui/icons";
import FlowBuilderTypebotModal from "../../components/FlowBuilderAddTypebotModal";
import FlowBuilderOpenAIModal from "../../components/FlowBuilderAddOpenAIModal";
import FlowBuilderAddQuestionModal from "../../components/FlowBuilderAddQuestionModal";
import FlowBuilderAddTagModal from "../../components/FlowBuilderAddTagModal";
import FlowBuilderAddKanbanModal from "../../components/FlowBuilderAddKanbanModal";
import FlowBuilderAddSwitchFlowModal from "../../components/FlowBuilderAddSwitchFlowModal";
import FlowBuilderAddHttpRequestModal from "../../components/FlowBuilderAddHttpRequestModal";
import FlowBuilderAddBillingSecondCopyModal from "../../components/FlowBuilderAddBillingSecondCopyModal";
import GetAppIcon from "@mui/icons-material/GetApp";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import HttpIcon from "@mui/icons-material/Http";
import AltRouteIcon from "@mui/icons-material/AltRoute";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SearchIcon from "@mui/icons-material/Search";
import { exportFlow } from "../../services/flowBuilder";
import FlowImportModal from "../../components/FlowImportModal";
import FlowBuilderSimulatorModal from "../../components/FlowBuilderSimulatorModal";
import FlowBuilderReengagementModal from "../../components/FlowBuilderReengagementModal";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    position: "relative",
    backgroundColor:
      theme.palette.type === "dark"
        ? theme.palette.background.default
        : "#F8F9FA",
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  speeddial: {
    backgroundColor: "red",
  },
}));

function geraStringAleatoria(tamanho) {
  var stringAleatoria = "";
  var caracteres =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < tamanho; i++) {
    stringAleatoria += caracteres.charAt(
      Math.floor(Math.random() * caracteres.length)
    );
  }
  return stringAleatoria;
}

const nodeTypes = {
  message: messageNode,
  start: startNode,
  menu: menuNode,
  interval: intervalNode,
  img: imgNode,
  audio: audioNode,
  randomizer: randomizerNode,
  video: videoNode,
  singleBlock: singleBlockNode,
  ticket: ticketNode,
  typebot: typebotNode,
  openai: openaiNode,
  question: questionNode,
  condition: conditionNode,
  tag: tagNode,
  kanban: kanbanNode,
  switchFlow: switchFlowNode,
  httpRequest: httpRequestNode,
  billingSecondCopy: billingSecondCopyNode,
};

const edgeTypes = {
  buttonedge: RemoveEdge,
};

const initialNodes = [
  {
    id: "1",
    position: { x: 250, y: 100 },
    data: { label: "Inicio do fluxo" },
    type: "start",
  },
];

const initialEdges = [];

const defaultFlowSettings = {
  reengagement: {
    enabled: false,
    steps: [],
    autoClose: { enabled: false, minutes: 30 },
  },
};

const normalizeFlowSettings = (settings) => {
  const raw = settings?.reengagement || {};

  // Compatibilidade com o formato antigo de passo único (minutes/message
  // direto na raiz de reengagement), salvo por versões anteriores do fluxo.
  const rawSteps = Array.isArray(raw.steps)
    ? raw.steps
    : raw.minutes || raw.message
    ? [{ minutes: raw.minutes, message: raw.message }]
    : [];

  const steps = rawSteps.map((step) => ({
    minutes: Number(step?.minutes) > 0 ? Number(step.minutes) : 5,
    message: String(step?.message || ""),
  }));

  const rawAutoClose = raw.autoClose || {};

  return {
    reengagement: {
      enabled: Boolean(raw.enabled),
      steps,
      autoClose: {
        enabled: Boolean(rawAutoClose.enabled),
        minutes: Number(rawAutoClose.minutes) > 0 ? Number(rawAutoClose.minutes) : 30,
      },
    },
  };
};

export const FlowBuilderConfig = () => {
  const classes = useStyles();
  const history = useHistory();
  const { id } = useParams();

  const storageItems = useNodeStorage();

  const { user } = useContext(AuthContext);
  const isMobile = useMediaQuery("(max-width:980px)");

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [dataNode, setDataNode] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [modalAddText, setModalAddText] = useState(null);
  const [modalAddInterval, setModalAddInterval] = useState(false);
  const [modalAddMenu, setModalAddMenu] = useState(null);
  const [modalAddImg, setModalAddImg] = useState(null);
  const [modalAddAudio, setModalAddAudio] = useState(null);
  const [modalAddRandomizer, setModalAddRandomizer] = useState(null);
  const [modalAddCondition, setModalAddCondition] = useState(null);
  const [modalAddVideo, setModalAddVideo] = useState(null);
  const [modalAddSingleBlock, setModalAddSingleBlock] = useState(null);
  const [modalAddTicket, setModalAddTicket] = useState(null);
  const [modalAddTypebot, setModalAddTypebot] = useState(null);
  const [modalAddOpenAI, setModalAddOpenAI] = useState(null);
  const [modalAddQuestion, setModalAddQuestion] = useState(null);
  const [modalAddTag, setModalAddTag] = useState(null);
  const [modalAddKanban, setModalAddKanban] = useState(null);
  const [modalAddSwitchFlow, setModalAddSwitchFlow] = useState(null);
  const [modalAddHttpRequest, setModalAddHttpRequest] = useState(null);
  const [modalAddBillingSecondCopy, setModalAddBillingSecondCopy] = useState(null);
  const [importModal, setImportModal] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [reengagementModalOpen, setReengagementModalOpen] = useState(false);
  // Sempre inicia aberta ao carregar a página; só recolhe se o usuário clicar no botão.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [flowSettings, setFlowSettings] = useState(defaultFlowSettings);
  const [flowActive, setFlowActive] = useState(true);
  const [flowActiveLoading, setFlowActiveLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const autosaveTimeoutRef = useRef(null);
  const hasLoadedFlowRef = useRef(false);

  const [searchTerm, setSearchTerm] = useState("");

  // Visual only: thinner, cleaner connection preview (Typebot-like)
  const connectionLineStyle = { stroke: "#9ca3af", strokeWidth: "2px" };

  const addNode = (type, data) => {
    const posY = nodes[nodes.length - 1].position.y;
    const posX =
      nodes[nodes.length - 1].position.x + nodes[nodes.length - 1].width + 40;
    if (type === "text") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { label: data.text },
            type: "message",
          },
        ];
      });
    }
    if (type === "interval") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { label: `Intervalo ${data.sec} seg.`, sec: data.sec },
            type: "interval",
          },
        ];
      });
    }
    if (type === "condition") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              key: data.key,
              condition: data.condition,
              value: data.value,
            },
            type: "condition",
          },
        ];
      });
    }
    if (type === "menu") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              message: data.message,
              arrayOption: data.arrayOption,
              includeMainMenuOption: Boolean(data.includeMainMenuOption),
              mainMenuOptionText: String(
                data.mainMenuOptionText || "Retornar ao Menu Principal"
              ),
              includeExitOption: Boolean(data.includeExitOption),
              exitOptionText: String(
                data.exitOptionText || "Encerrar atendimento"
              )
            },
            type: "menu",
          },
        ];
      });
    }
    if (type === "img") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url },
            type: "img",
          },
        ];
      });
    }
    if (type === "audio") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url, record: data.record },
            type: "audio",
          },
        ];
      });
    }
    if (type === "randomizer") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { percent: data.percent },
            type: "randomizer",
          },
        ];
      });
    }
    if (type === "video") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url },
            type: "video",
          },
        ];
      });
    }
    if (type === "singleBlock") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "singleBlock",
          },
        ];
      });
    }

    if (type === "ticket") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "ticket",
          },
        ];
      });
    }

    if (type === "typebot") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "typebot",
          },
        ];
      });
    }

    if (type === "openai") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "openai",
          },
        ];
      });
    }

    if (type === "question") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "question",
          },
        ];
      });
    }

    if (type === "tag") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "tag",
          },
        ];
      });
    }

    if (type === "kanban") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "kanban",
          },
        ];
      });
    }

    if (type === "switchFlow") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "switchFlow",
          },
        ];
      });
    }

    if (type === "httpRequest") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "httpRequest",
          },
        ];
      });
    }

    if (type === "billingSecondCopy") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "billingSecondCopy",
          },
        ];
      });
    }
  };

  const textAdd = (data) => {
    addNode("text", data);
  };

  const intervalAdd = (data) => {
    addNode("interval", data);
  };

  const conditionAdd = (data) => {
    addNode("condition", data);
  };

  const menuAdd = (data) => {
    addNode("menu", data);
  };

  const imgAdd = (data) => {
    addNode("img", data);
  };

  const audioAdd = (data) => {
    addNode("audio", data);
  };

  const randomizerAdd = (data) => {
    addNode("randomizer", data);
  };

  const videoAdd = (data) => {
    addNode("video", data);
  };

  const singleBlockAdd = (data) => {
    addNode("singleBlock", data);
  };

  const ticketAdd = (data) => {
    addNode("ticket", data);
  };

  const typebotAdd = (data) => {
    addNode("typebot", data);
  };

  const openaiAdd = (data) => {
    addNode("openai", data);
  };

  const questionAdd = (data) => {
    addNode("question", data);
  };

  const tagAdd = (data) => {
    addNode("tag", data);
  };

  const kanbanAdd = (data) => {
    addNode("kanban", data);
  };

  const switchFlowAdd = (data) => {
    addNode("switchFlow", data);
  };

  const httpRequestAdd = (data) => {
    addNode("httpRequest", data);
  };

  const billingSecondCopyAdd = (data) => {
    addNode("billingSecondCopy", data);
  };

  useEffect(() => {
    setLoading(true);
    hasLoadedFlowRef.current = false;
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get(`/flowbuilder/flow/${id}`);
          setFlowActive(Boolean(data?.flow?.active ?? true));
          if (data.flow.flow !== null) {
            const flowNodes = data.flow.flow.nodes
            setNodes(flowNodes);
            setEdges(data.flow.flow.connections);
            setFlowSettings(normalizeFlowSettings(data.flow.flow.settings));
            const filterVariables = flowNodes.filter(nd  => nd.type === "question")
            const variables = filterVariables.map(variable => variable.data.typebotIntegration.answerKey)
            localStorage.setItem('variables', JSON.stringify(variables))
          } else {
            setFlowSettings(defaultFlowSettings);
          }
          hasLoadedFlowRef.current = true;
          setLoading(false);
        } catch (err) {
          toastError(err);
          setLoading(false);
          hasLoadedFlowRef.current = true;
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [id]);

  useEffect(() => {
    if (storageItems.action === "delete") {
      setNodes((old) => old.filter((item) => item.id !== storageItems.node));
      setEdges((old) => {
        const newData = old.filter((item) => item.source !== storageItems.node);
        const newClearTarget = newData.filter(
          (item) => item.target !== storageItems.node
        );
        return newClearTarget;
      });
      storageItems.setNodesStorage("");
      storageItems.setAct("idle");
    }
    if (storageItems.action === "duplicate") {
      const nodeDuplicate = nodes.filter(
        (item) => item.id === storageItems.node
      )[0];
      const maioresX = nodes.map((node) => node.position.x);
      const maiorX = Math.max(...maioresX);
      const finalY = nodes[nodes.length - 1].position.y;
      const nodeNew = {
        ...nodeDuplicate,
        id: geraStringAleatoria(30),
        position: {
          x: maiorX + 240,
          y: finalY,
        },
        selected: false,
        style: { backgroundColor: "#555555", padding: 0, borderRadius: 8 },
      };
      setNodes((old) => [...old, nodeNew]);
      storageItems.setNodesStorage("");
      storageItems.setAct("idle");
    }
  }, [storageItems.action]);

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "buttonedge", // garante que use RemoveEdge
            data: {
              onDelete: (idToDelete) => {
                setEdges((prev) =>
                  prev.filter((ed) => ed.id !== idToDelete)
                );
              }
            }
          },
          eds
        )
      ),
    [setEdges]
  );


  const saveFlow = async ({ showSuccessToast = true, settingsOverride } = {}) => {
    try {
      await api.post("/flowbuilder/flow", {
        idFlow: id,
        nodes: nodes,
        connections: edges,
        settings: settingsOverride || flowSettings,
      });
      if (showSuccessToast) {
        toast.success("Fluxo salvo com sucesso");
      }
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    if (!id || loading || !hasLoadedFlowRef.current) return;

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      saveFlow({ showSuccessToast: false });
    }, 900);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [nodes, edges, flowSettings, id, loading]);

  const handleToggleFlowActive = async () => {
    const nextActive = !flowActive;
    setFlowActive(nextActive);
    setFlowActiveLoading(true);

    try {
      await api.patch(`/flowbuilder/${id}/active`, { active: nextActive });
      toast.success(
        nextActive ? "Fluxo ativado com sucesso" : "Fluxo desativado com sucesso"
      );
    } catch (err) {
      setFlowActive(!nextActive);
      toastError(err);
    } finally {
      setFlowActiveLoading(false);
    }
  };

  const doubleClick = (event, node) => {
    console.log("NODE", node);
    setDataNode(node);
    if (node.type === "message") {
      setModalAddText("edit");
    }
    if (node.type === "interval") {
      setModalAddInterval("edit");
    }

    if (node.type === "menu") {
      setModalAddMenu("edit");
    }
    if (node.type === "img") {
      setModalAddImg("edit");
    }
    if (node.type === "audio") {
      setModalAddAudio("edit");
    }
    if (node.type === "randomizer") {
      setModalAddRandomizer("edit");
    }
    if (node.type === "condition") {
      setModalAddCondition("edit");
    }
    if (node.type === "singleBlock") {
      setModalAddSingleBlock("edit");
    }
    if (node.type === "ticket") {
      setModalAddTicket("edit");
    }
    if (node.type === "typebot") {
      setModalAddTypebot("edit");
    }
    if (node.type === "openai") {
      setModalAddOpenAI("edit");
    }
    if (node.type === "question") {
      setModalAddQuestion("edit");
    }
    if (node.type === "tag") {
      setModalAddTag("edit");
    }
    if (node.type === "kanban") {
      setModalAddKanban("edit");
    }
    if (node.type === "switchFlow") {
      setModalAddSwitchFlow("edit");
    }
    if (node.type === "httpRequest") {
      setModalAddHttpRequest("edit");
    }
    if (node.type === "billingSecondCopy") {
      setModalAddBillingSecondCopy("edit");
    }
  };

  const clickNode = (event, node) => {
    setNodes((old) =>
      old.map((item) => {
        if (item.id === node.id) {
          return {
            ...item,
            style: { backgroundColor: "#6366F1", padding: 1, borderRadius: 8 },
          };
        }
        return {
          ...item,
          style: { backgroundColor: "#13111C", padding: 0, borderRadius: 8 },
        };
      })
    );
  };
  const clickEdge = (event, edge) => {
    setEdges((edges) =>
      edges.map((e) =>
        e.id === edge.id
          ? {
              ...e,
              data: {
                ...(e.data || {}),
                selected: true,
                onDelete: (id) => {
                  setEdges((eds) => eds.filter((ed) => ed.id !== id));
                }
              }
            }
          : { ...e, data: { ...(e.data || {}), selected: false } }
      )
    );
  };


  const updateNode = (dataAlter) => {
    setNodes((old) =>
      old.map((itemNode) => {
        if (itemNode.id === dataAlter.id) {
          return dataAlter;
        }
        return itemNode;
      })
    );
    setModalAddText(null);
    setModalAddInterval(null);
    setModalAddMenu(null);
    setModalAddOpenAI(null);
    setModalAddTypebot(null);
    setModalAddTag(null);
    setModalAddKanban(null);
    setModalAddCondition(null);
    setModalAddQuestion(null);
    setModalAddSwitchFlow(null);
    setModalAddHttpRequest(null);
    setModalAddBillingSecondCopy(null);
  };

  const actionSections = [
  {
    title: "Mensagens",
    items: [
      {
        icon: (
          <LibraryBooks sx={{ color: "#EC5858" }} />
        ),
        name: "Conteúdo",
        type: "content",
      },
      {
        icon: (
          <DynamicFeed sx={{ color: "#683AC8" }} />
        ),
        name: "Menu",
        type: "menu",
      },
    ],
  },
  {
    title: "Lógica",
    items: [
      {
        icon: (
          <CallSplit sx={{ color: "#1FBADC" }} />
        ),
        name: "Randomizador",
        type: "random",
      },
      {
        icon: (
          <ImportExport sx={{ color: "#6366F1" }} />
        ),
        name: "Condição",
        type: "condition",
      },
      {
        icon: (
          <AccessTime sx={{ color: "#F7953B" }} />
        ),
        name: "Intervalo",
        type: "interval",
      },
      {
        icon: (
          <ConfirmationNumber sx={{ color: "#F7953B" }} />
        ),
        name: "Fila/Setor",
        type: "ticket",
      },
      {
        icon: (
          <LocalOffer sx={{ color: "#0EA5E9" }} />
        ),
        name: "Tag",
        type: "tag",
      },
      {
        icon: (
          <ViewKanban sx={{ color: "#0284C7" }} />
        ),
        name: "Kanban",
        type: "kanban",
      },
      {
        icon: (
          <AltRouteIcon sx={{ color: "#EA580C" }} />
        ),
        name: "Trocar fluxo",
        type: "switchFlow",
      },
    ],
  },
  {
    title: "Integrações",
    items: [
      {
        icon: (
          <Box
            component="img"
            sx={{ width: 18, height: 18 }}
            src={typebotIcon}
            alt="icon"
          />
        ),
        name: "TypeBot",
        type: "typebot",
      },
      {
        icon: (
          <SiOpenai style={{ color: "#0EA5E9", width: 18, height: 18 }} />
        ),
        name: "IA",
        type: "openai",
      },
      {
        icon: (
          <HttpIcon sx={{ color: "#0EA5E9" }} />
        ),
        name: "HTTP Request",
        type: "httpRequest",
      },
      {
        icon: (
          <ReceiptLongIcon sx={{ color: "#EA580C" }} />
        ),
        name: "2a via Boleto",
        type: "billingSecondCopy",
      },
    ],
  },
  {
    title: "Outros",
    items: [
      {
        icon: (
          <BallotIcon sx={{ color: "#F7953B" }} />
        ),
        name: "Pergunta",
        type: "question",
      },
    ],
  },
  {
    title: "Configurações",
    items: [
      {
        icon: (
          <NotificationsActiveIcon sx={{ color: "#F7953B" }} />
        ),
        name: "Follow-up",
        type: "reengagement",
      },
    ],
  },
];

const filteredSections = actionSections
  .map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  }))
  .filter((section) => section.items.length > 0);

  const clickActions = (type) => {
    switch (type) {
      case "menu":
        setModalAddMenu("create");
        break;
      case "content":
        setModalAddSingleBlock("create");
        break;
      case "random":
        setModalAddRandomizer("create");
        break;
      case "condition":
        setModalAddCondition("create");
        break;
      case "interval":
        setModalAddInterval("create");
        break;
      case "ticket":
        setModalAddTicket("create");
        break;
      case "typebot":
        setModalAddTypebot("create");
        break;
      case "openai":
        setModalAddOpenAI("create");
        break;
      case "question":
        setModalAddQuestion("create");
        break;
      case "tag":
        setModalAddTag("create");
        break;
      case "kanban":
        setModalAddKanban("create");
        break;
      case "switchFlow":
        setModalAddSwitchFlow("create");
        break;
      case "httpRequest":
        setModalAddHttpRequest("create");
        break;
      case "billingSecondCopy":
        setModalAddBillingSecondCopy("create");
        break;
      case "reengagement":
        setReengagementModalOpen(true);
        break;

      default:
}
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  useEffect(() => {
    if (!isMobile && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [isMobile, mobileMenuOpen]);

  const renderSidebar = (mobile = false) => {
    const collapsed = !mobile && sidebarCollapsed;

    return (
      <div
        className={`${mobile ? "flowbuilder-sidebar-mobile" : "flowbuilder-sidebar"}${
          collapsed ? " is-collapsed" : ""
        }`}
      >
        {!mobile && (
          <button
            type="button"
            className="flowbuilder-sidebar__toggle"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            title={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
          >
            {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
          </button>
        )}

        {!collapsed && (
          <>
            <div className="flowbuilder-sidebar__top">
              <div className="flowbuilder-sidebar__searchWrap">
                <SearchIcon className="flowbuilder-sidebar__searchIcon" />
                <input
                  className="flowbuilder-sidebar__search"
                  placeholder="Procurar bloco"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="flowbuilder-sidebar__lock"
                title="Em breve"
                disabled
              >
                🔒
              </button>
            </div>

            {filteredSections.map((section) => (
              <div className="flowbuilder-sidebar__section" key={section.title}>
                <div className="flowbuilder-sidebar__title">{section.title}</div>
                <div className="flowbuilder-sidebar__grid">
                  {section.items.map((action) => (
                    <button
                      key={action.name}
                      type="button"
                      className="flowbuilder-sidebar__chip"
                      title={action.name}
                      onClick={() => !action.disabled && clickActions(action.type)}
                      disabled={action.disabled}
                    >
                      <span className="flowbuilder-sidebar__chipIcon">{action.icon}</span>
                      <span className="flowbuilder-sidebar__chipLabel">{action.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

  return (
    <Stack sx={{ height: "100vh" }}>
      <FlowBuilderAddTextModal
        open={modalAddText}
        onSave={textAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddText}
      />
      <FlowBuilderIntervalModal
        open={modalAddInterval}
        onSave={intervalAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddInterval}
      />
      <FlowBuilderMenuModal
        open={modalAddMenu}
        onSave={menuAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddMenu}
      />
      <FlowBuilderAddImgModal
        open={modalAddImg}
        onSave={imgAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddImg}
      />
      <FlowBuilderAddAudioModal
        open={modalAddAudio}
        onSave={audioAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddAudio}
      />
      <FlowBuilderRandomizerModal
        open={modalAddRandomizer}
        onSave={randomizerAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddRandomizer}
      />
      <FlowBuilderConditionModal
        open={modalAddCondition}
        onSave={conditionAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddCondition}
      />
      <FlowBuilderAddVideoModal
        open={modalAddVideo}
        onSave={videoAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddVideo}
      />
      <FlowBuilderSingleBlockModal
        open={modalAddSingleBlock}
        onSave={singleBlockAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddSingleBlock}
      />
      <FlowBuilderTicketModal
        open={modalAddTicket}
        onSave={ticketAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddTicket}
      />

      <FlowBuilderOpenAIModal
        open={modalAddOpenAI}
        onSave={openaiAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddOpenAI}
      />

      <FlowBuilderTypebotModal
        open={modalAddTypebot}
        onSave={typebotAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddTypebot}
      />

      <FlowBuilderAddQuestionModal
        open={modalAddQuestion}
        onSave={questionAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddQuestion}
      />
      <FlowBuilderAddTagModal
        open={modalAddTag}
        onSave={tagAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddTag}
      />
      <FlowBuilderAddKanbanModal
        open={modalAddKanban}
        onSave={kanbanAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddKanban}
      />
      <FlowBuilderAddSwitchFlowModal
        open={modalAddSwitchFlow}
        onSave={switchFlowAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddSwitchFlow}
        currentFlowId={id}
      />
      <FlowBuilderAddHttpRequestModal
        open={modalAddHttpRequest}
        onSave={httpRequestAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddHttpRequest}
      />
      <FlowBuilderAddBillingSecondCopyModal
        open={modalAddBillingSecondCopy}
        onSave={billingSecondCopyAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddBillingSecondCopy}
      />
      <FlowImportModal open={importModal} onClose={() => setImportModal(false)} />
      <FlowBuilderSimulatorModal
        open={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        nodes={nodes}
        edges={edges}
      />
      <FlowBuilderReengagementModal
        open={reengagementModalOpen}
        settings={flowSettings.reengagement}
        onClose={() => setReengagementModalOpen(false)}
        onSave={(newSettings) => {
          setFlowSettings(newSettings);
          saveFlow({ settingsOverride: newSettings });
        }}
      />

      <MainHeader>
  <div className="fb-headerbar">
    <div className="fb-header-left">
      <Title>Desenhe seu fluxo</Title>
      <div className="fb-header-subtitle">
        Construa e organize seu atendimento com blocos e conexões.
      </div>
    </div>

    <MainHeaderButtonsWrapper className="fb-header-actions">
      <div className="fb-active-toggle-wrap">
        <span
          className={`fb-active-toggle-label ${
            flowActive ? "is-active" : "is-inactive"
          }`}
        >
          {flowActive ? "Ativo" : "Inativo"}
        </span>
        <button
          type="button"
          className={`fb-active-toggle ${flowActive ? "is-on" : "is-off"}`}
          onClick={handleToggleFlowActive}
          disabled={flowActiveLoading}
          aria-label="Ativar ou desativar fluxo"
          title={flowActive ? "Desativar fluxo" : "Ativar fluxo"}
        >
          <span className="fb-active-toggle-knob" />
        </button>
      </div>

      <Button
        className="fb-header-btn fb-btn-test"
        variant="contained"
        color="primary"
        disableElevation
        sx={{ textTransform: "none" }}
        startIcon={<PlayArrowIcon />}
        onClick={() => setSimulatorOpen(true)}
      >
        Testar Fluxo
      </Button>

      <Button
        className="fb-header-btn fb-btn-import"
        variant="contained"
        color="primary"
        disableElevation
        sx={{ textTransform: "none" }}
        startIcon={<UploadFileIcon />}
        onClick={() => setImportModal(true)}
      >
        Importar
      </Button>

      <Button
        className="fb-header-btn fb-btn-export"
        variant="contained"
        color="primary"
        disableElevation
        sx={{ textTransform: "none" }}
        startIcon={<GetAppIcon />}
        onClick={() => exportFlow(id)}
      >
        Exportar
      </Button>

      <Button
        className="fb-header-btn fb-btn-save"
        variant="contained"
        color="primary"
        disableElevation
        sx={{ textTransform: "none" }}
        onClick={saveFlow}
      >
        Salvar
      </Button>
    </MainHeaderButtonsWrapper>
  </div>
</MainHeader>
      {!loading && (
        <Paper
          className={classes.mainPaper}
          variant="outlined"
          onScroll={handleScroll}
        >
          <Stack
            direction={"row"}
            className="fb-workspace"
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
              display: "flex",
            }}
          >

{renderSidebar(false)}

{isMobile && (
  <>
    <button
      type="button"
      className="flowbuilder-mobile-fab"
      aria-label="Abrir menu de blocos"
      onClick={() => setMobileMenuOpen(true)}
    >
      +
    </button>

    {mobileMenuOpen && (
      <div className="flowbuilder-mobile-overlay" onClick={() => setMobileMenuOpen(false)}>
        <div className="flowbuilder-mobile-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="flowbuilder-mobile-sheet__header">
            <span>Adicionar bloco</span>
            <button
              type="button"
              className="flowbuilder-mobile-sheet__close"
              onClick={() => setMobileMenuOpen(false)}
            >
              Fechar
            </button>
          </div>
          {renderSidebar(true)}
        </div>
      </div>
    )}
  </>
)}

            <div className="flow-canvas-container">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                deleteKeyCode={["Backspace", "Delete"]}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeDoubleClick={doubleClick}
                onNodeClick={clickNode}
                onEdgeClick={clickEdge}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                connectionLineStyle={connectionLineStyle}
                className="react-flow"
                defaultEdgeOptions={{
                  animated: true,
                  className: "edge-line"
                }}
              >
                <Controls />
                <Background
                  variant="dots"
                  gap={12}
                  size={-1}
                />
              </ReactFlow>
            </div>
          </Stack>
        </Paper>
      )}
      {loading && (
        <Stack justifyContent={"center"} alignItems={"center"} height={"70vh"}>
          <CircularProgress />
        </Stack>
      )}
    </Stack>
  );
};
