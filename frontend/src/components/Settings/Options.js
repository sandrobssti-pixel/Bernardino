import React, { useEffect, useState } from "react";

import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import FormHelperText from "@material-ui/core/FormHelperText";

import useSettings from "../../hooks/useSettings";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import Whitelabel from "./Whitelabel";

import { makeStyles } from "@material-ui/core/styles";
import { grey, blue } from "@material-ui/core/colors";

import { Box, Button, ButtonGroup, Collapse, Paper, Tab, Tabs, TextField } from "@material-ui/core";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import {
  AI_MODEL_LABELS,
  AI_PROVIDER_LABELS,
  AI_PROVIDER_MODELS,
  getDefaultModelByProvider,
  normalizeAIProvider
} from "../../utils/aiProviders";

const useStyles = makeStyles((theme) => ({
  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },
  fixedHeightPaper: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
    height: 240,
  },
  cardAvatar: {
    fontSize: "55px",
    color: grey[500],
    backgroundColor: "#ffffff",
    width: theme.spacing(7),
    height: theme.spacing(7),
  },
  cardTitle: {
    fontSize: "18px",
    color: blue[700],
  },
  cardSubtitle: {
    color: grey[600],
    fontSize: "14px",
  },
  alignRight: {
    textAlign: "right",
  },
  fullWidth: {
    width: "100%",
  },
  selectContainer: {
    width: "100%",
    textAlign: "left",
  },
  tab: {
    backgroundColor: theme.mode === "light" ? "#f2f2f2" : "#7f7f7f",
    borderRadius: 4,
    width: "100%",
    "& .MuiTabs-flexContainer": {
      justifyContent: "center",
    },
  },
  optionsList: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
  },
  sectionHeader: {
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1.5, 2),
    background:
      theme.palette.type === "light"
        ? "#ffffff"
        : theme.palette.background.default,
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: "0.9rem",
    color: theme.palette.text.primary,
    lineHeight: 1.3,
  },
  sectionMeta: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    marginTop: 1,
  },
  optionRow: {
    padding: theme.spacing(1.75, 2),
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "light"
        ? "#ffffff"
        : theme.palette.background.default,
  },
  optionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(1.5),
  },
  optionTitle: {
    fontWeight: 700,
    fontSize: "0.9rem",
    color: theme.palette.text.primary,
  },
  optionDescription: {
    marginTop: theme.spacing(0.4),
    color: theme.palette.text.secondary,
    fontSize: "0.75rem",
  },
  toggleGroup: {
    minWidth: 230,
  },
  toggleButton: {
    textTransform: "none",
    fontWeight: 600,
    minHeight: 36,
    borderRadius: 8,
    padding: "0 14px",
    fontSize: "0.78rem",
  },
  selectField: {
    minWidth: 240,
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      height: 36,
      backgroundColor:
        theme.palette.type === "light"
          ? "#f8f9fc"
          : theme.palette.background.paper,
    },
  },
  updatingText: {
    marginTop: theme.spacing(0.7),
    color: theme.palette.text.secondary,
    fontSize: "0.72rem",
    fontWeight: 600,
  },
  inlineMessageField: {
    marginTop: theme.spacing(1.5),
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      backgroundColor:
        theme.palette.type === "light"
          ? "#f8f9fc"
          : theme.palette.background.paper,
    },
    "& .MuiInputLabel-outlined": {
      fontSize: "0.82rem",
    },
  },
}));

const DEFAULT_AI_REPLY_PROMPT =
  "Você é um assistente que melhora mensagens de atendimento em português do Brasil. " +
  "Reescreva o texto mantendo a intenção original, corrigindo ortografia e gramática, " +
  "deixando claro, cordial e profissional. Não invente informações e não altere fatos. " +
  "Retorne apenas a versão final da mensagem.";

export default function Options(props) {
  const { oldSettings, settings, scheduleTypeChanged, user } = props;

  const classes = useStyles();

  // ===== Identidade da empresa / White Label (movido do Painel SaaS) =====
  const [loginBrandingConfig, setLoginBrandingConfig] = useState({
    loginLogo: "",
    loginBackground: "",
    loginWhatsapp: "",
    signupRequireCpfCnpj: "disabled"
  });
  const [loginBrandingUploading, setLoginBrandingUploading] = useState({
    loginLogo: false,
    loginBackground: false
  });
  const [loginBrandingRemoving, setLoginBrandingRemoving] = useState({
    loginLogo: false,
    loginBackground: false
  });

  const resolveBrandingImageUrl = (value) => {
    if (!value) return "";
    if (value.startsWith("http")) return value;
    const base = process.env.REACT_APP_BACKEND_URL || "";
    if (!base) return value;
    const normalizedBase = base.replace(/\/+$/, "");
    const path = value.startsWith("/") ? value : `/${value}`;
    return `${normalizedBase}${path}`;
  };

  const handleLoginBrandingChange = (e) => {
    const { name, value } = e.target;
    setLoginBrandingConfig((prev) => ({ ...prev, [name]: value }));
  };

  const handleLoginBrandingUpload = async (field, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("field", field);
    try {
      setLoginBrandingUploading((prev) => ({ ...prev, [field]: true }));
      const { data } = await api.post("/global-config/upload", formData);
      const url = data?.url || data?.[field];
      if (url) {
        setLoginBrandingConfig((prev) => ({ ...prev, [field]: url }));
      }
      toast.success("Imagem atualizada com sucesso.");
    } catch (err) {
      toastError(err);
    } finally {
      setLoginBrandingUploading((prev) => ({ ...prev, [field]: false }));
    }
  };

  const handleLoginBrandingRemove = async (field) => {
    try {
      setLoginBrandingRemoving((prev) => ({ ...prev, [field]: true }));
      await api.post("/global-config/upload/remove", { field });
      setLoginBrandingConfig((prev) => ({ ...prev, [field]: "" }));
      toast.success("Imagem removida com sucesso.");
    } catch (err) {
      toastError(err);
    } finally {
      setLoginBrandingRemoving((prev) => ({ ...prev, [field]: false }));
    }
  };

  useEffect(() => {
    if (!user.super) return;
    api
      .get("/global-config")
      .then(({ data }) => {
        setLoginBrandingConfig((prev) => ({
          ...prev,
          loginLogo: data?.loginLogo || "",
          loginBackground: data?.loginBackground || "",
          loginWhatsapp: data?.loginWhatsapp || "",
          signupRequireCpfCnpj: data?.signupRequireCpfCnpj || "disabled"
        }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.super]);
  // ===== Fim identidade da empresa / White Label =====

  const [userRating, setUserRating] = useState("disabled");
  const [scheduleType, setScheduleType] = useState("disabled");
  const [chatBotType, setChatBotType] = useState("text");

  const [loadingUserRating, setLoadingUserRating] = useState(false);
  const [loadingScheduleType, setLoadingScheduleType] = useState(false);

  const [userCreation, setUserCreation] = useState("disabled");
  const [loadingUserCreation, setLoadingUserCreation] = useState(false);

  const [SendGreetingAccepted, setSendGreetingAccepted] = useState("enabled");
  const [loadingSendGreetingAccepted, setLoadingSendGreetingAccepted] =
    useState(false);

  const [UserRandom, setUserRandom] = useState("enabled");
  const [loadingUserRandom, setLoadingUserRandom] = useState(false);

  const [SettingsTransfTicket, setSettingsTransfTicket] = useState("enabled");
  const [loadingSettingsTransfTicket, setLoadingSettingsTransfTicket] =
    useState(false);

  const [AcceptCallWhatsapp, setAcceptCallWhatsapp] = useState("enabled");
  const [loadingAcceptCallWhatsapp, setLoadingAcceptCallWhatsapp] =
    useState(false);

  const [sendSignMessage, setSendSignMessage] = useState("enabled");
  const [loadingSendSignMessage, setLoadingSendSignMessage] = useState(false);

  const [sendQueuePosition, setSendQueuePosition] = useState("enabled");
  const [loadingSendQueuePosition, setLoadingSendQueuePosition] =
    useState(false);

  const [sendFarewellWaitingTicket, setSendFarewellWaitingTicket] =
    useState("enabled");
  const [
    loadingSendFarewellWaitingTicket,
    setLoadingSendFarewellWaitingTicket,
  ] = useState(false);

  const [acceptAudioMessageContact, setAcceptAudioMessageContact] =
    useState("enabled");
  const [
    loadingAcceptAudioMessageContact,
    setLoadingAcceptAudioMessageContact,
  ] = useState(false);

  // LGPD
  const [enableLGPD, setEnableLGPD] = useState("disabled");
  const [loadingEnableLGPD, setLoadingEnableLGPD] = useState(false);

  const [lgpdMessage, setLGPDMessage] = useState("");
  const [loadinglgpdMessage, setLoadingLGPDMessage] = useState(false);

  const [lgpdLink, setLGPDLink] = useState("");
  const [loadingLGPDLink, setLoadingLGPDLink] = useState(false);

  const [lgpdDeleteMessage, setLGPDDeleteMessage] = useState("disabled");
  const [loadingLGPDDeleteMessage, setLoadingLGPDDeleteMessage] =
    useState(false);

  const [lgpdConsent, setLGPDConsent] = useState("disabled");
  const [loadingLGPDConsent, setLoadingLGPDConsent] = useState(false);

  const [lgpdHideNumber, setLGPDHideNumber] = useState("disabled");
  const [loadingLGPDHideNumber, setLoadingLGPDHideNumber] = useState(false);

  // Tag obrigatória
  const [requiredTag, setRequiredTag] = useState("enabled");
  const [loadingRequiredTag, setLoadingRequiredTag] = useState(false);

  // Fechar ticket ao transferir para outro setor
  const [closeTicketOnTransfer, setCloseTicketOnTransfer] = useState(false);
  const [loadingCloseTicketOnTransfer, setLoadingCloseTicketOnTransfer] =
    useState(false);

  // Usar carteira de clientes
  const [directTicketsToWallets, setDirectTicketsToWallets] = useState(false);
  const [
    loadingDirectTicketsToWallets,
    setLoadingDirectTicketsToWallets,
  ] = useState(false);

  // MENSAGENS CUSTOMIZADAS
  const [transferMessage, setTransferMessage] = useState(
    "Seu Atendimento foi Transferido para o setor ${queue.name},Aguarde atendimento por favor..."
  );
  const [loadingTransferMessage, setLoadingTransferMessage] = useState(false);

  const [greetingAcceptedMessage, setGreetingAcceptedMessage] = useState("");
  const [loadingGreetingAcceptedMessage, setLoadingGreetingAcceptedMessage] =
    useState(false);

  const [AcceptCallWhatsappMessage, setAcceptCallWhatsappMessage] =
    useState("");
  const [
    loadingAcceptCallWhatsappMessage,
    setLoadingAcceptCallWhatsappMessage,
  ] = useState(false);
  const [
    AcceptAudioMessageContactMessage,
    setAcceptAudioMessageContactMessage
  ] = useState("");
  const [
    loadingAcceptAudioMessageContactMessage,
    setLoadingAcceptAudioMessageContactMessage
  ] = useState(false);

  const [sendQueuePositionMessage, setSendQueuePositionMessage] = useState("");
  const [
    loadingSendQueuePositionMessage,
    setLoadingSendQueuePositionMessage,
  ] = useState(false);

  const [showNotificationPending, setShowNotificationPending] = useState(false);
  const [
    loadingShowNotificationPending,
    setLoadingShowNotificationPending,
  ] = useState(false);

  // 🔑 Chave da API de transcrição (OpenAI / Gemini)
  const [apiTranscription, setApiTranscription] = useState("");
  const [loadingApiTranscription, setLoadingApiTranscription] = useState(false);
  const [transcriptionProvider, setTranscriptionProvider] = useState("openai");
  const [loadingTranscriptionProvider, setLoadingTranscriptionProvider] = useState(false);
  const [showTranscriptionSettings, setShowTranscriptionSettings] = useState(false);

  const [showAiReplySettings, setShowAiReplySettings] = useState(false);
  const [aiReplyEnabled, setAiReplyEnabled] = useState("disabled");
  const [aiReplyProvider, setAiReplyProvider] = useState("openai");
  const [aiReplyModel, setAiReplyModel] = useState("gpt-4.1-mini");
  const [aiReplyApiKey, setAiReplyApiKey] = useState("");
  const [aiReplyPrompt, setAiReplyPrompt] = useState(DEFAULT_AI_REPLY_PROMPT);
  const [aiReplyMaxTokens, setAiReplyMaxTokens] = useState(300);
  const [aiReplyTemperature, setAiReplyTemperature] = useState(0.4);
  const [loadingAiReplyConfig, setLoadingAiReplyConfig] = useState(false);

  const { update: updateUserCreation, getAll } = useSettings();
  const { update } = useCompanySettings();
  const updatingLabel = i18n.t("settings.settings.options.updating");
  const notifyUpdated = () => toast.success(i18n.t("settings.success"));

  const isSuper = () => {
    return user.super;
  };

  useEffect(() => {
    if (Array.isArray(oldSettings) && oldSettings.length) {
      const userPar = oldSettings.find((s) => s.key === "userCreation");

      if (userPar) {
        setUserCreation(userPar.value);
      }

      // Carregar chave apiTranscription da tabela Setting
      const transcriptionSetting = oldSettings.find(
        (s) => s.key === "apiTranscription"
      );
      if (transcriptionSetting) {
        setApiTranscription(transcriptionSetting.value);
      }

      const providerSetting = oldSettings.find(
        (s) => s.key === "transcriptionProvider"
      );
      if (providerSetting?.value) {
        setTranscriptionProvider(
          ["openai", "gemini", "groq"].includes(providerSetting.value)
            ? providerSetting.value
            : "openai"
        );
      }
    }
  }, [oldSettings]);

  useEffect(() => {
    const normalizedAiReplyProvider = normalizeAIProvider(
      settings.aiReplyProvider || "openai"
    );

    for (const [key, value] of Object.entries(settings)) {
      if (key === "userRating") setUserRating(value);
      if (key === "scheduleType") setScheduleType(value);
      if (key === "chatBotType") setChatBotType(value);
      if (key === "acceptCallWhatsapp") setAcceptCallWhatsapp(value);
      if (key === "userRandom") setUserRandom(value);
      if (key === "sendSignMessage") setSendSignMessage(value);
      if (key === "sendFarewellWaitingTicket")
        setSendFarewellWaitingTicket(value);
      if (key === "sendGreetingAccepted") setSendGreetingAccepted(value);
      if (key === "sendQueuePosition") setSendQueuePosition(value);
      if (key === "acceptAudioMessageContact")
        setAcceptAudioMessageContact(value);
      if (key === "enableLGPD") setEnableLGPD(value);
      if (key === "requiredTag") setRequiredTag(value);
      if (key === "lgpdDeleteMessage") setLGPDDeleteMessage(value);
      if (key === "lgpdHideNumber") setLGPDHideNumber(value);
      if (key === "lgpdConsent") setLGPDConsent(value);
      if (key === "lgpdMessage") setLGPDMessage(value);
      if (key === "sendMsgTransfTicket") setSettingsTransfTicket(value);
      if (key === "lgpdLink") setLGPDLink(value);
      if (key === "DirectTicketsToWallets") setDirectTicketsToWallets(value);
      if (key === "closeTicketOnTransfer") setCloseTicketOnTransfer(value);
      if (key === "transferMessage") setTransferMessage(value);
      if (key === "greetingAcceptedMessage")
        setGreetingAcceptedMessage(value);
      if (key === "AcceptCallWhatsappMessage")
        setAcceptCallWhatsappMessage(value);
      if (key === "AcceptAudioMessageContactMessage")
        setAcceptAudioMessageContactMessage(value);
      if (key === "sendQueuePositionMessage")
        setSendQueuePositionMessage(value);
      if (key === "showNotificationPending") setShowNotificationPending(value);
      if (key === "aiReplyEnabled") setAiReplyEnabled(value);
      if (key === "aiReplyProvider") {
        setAiReplyProvider(normalizedAiReplyProvider);
      }
      if (key === "aiReplyModel") {
        setAiReplyModel(
          value || getDefaultModelByProvider(normalizedAiReplyProvider)
        );
      }
      if (key === "aiReplyApiKey") setAiReplyApiKey(value || "");
      if (key === "aiReplyPrompt") {
        const normalizedPrompt = String(value || "").trim();
        setAiReplyPrompt(normalizedPrompt || DEFAULT_AI_REPLY_PROMPT);
      }
      if (key === "aiReplyMaxTokens") setAiReplyMaxTokens(Number(value) || 300);
      if (key === "aiReplyTemperature") setAiReplyTemperature(Number(value) || 0.4);
    }
  }, [settings]);

  async function handleChangeUserCreation(value) {
    setUserCreation(value);
    setLoadingUserCreation(true);
    await updateUserCreation({
      key: "userCreation",
      value,
    });
    notifyUpdated();
    setLoadingUserCreation(false);
  }

  // 🔑 Salvar chave da API de transcrição (Setting: apiTranscription)
  async function handleApiTranscription(value) {
    setApiTranscription(value);
    setLoadingApiTranscription(true);
    await updateUserCreation({
      key: "apiTranscription",
      value,
    });
    setLoadingApiTranscription(false);
  }

  async function handleTranscriptionProvider(value) {
    setTranscriptionProvider(value);
    setLoadingTranscriptionProvider(true);
    await updateUserCreation({
      key: "transcriptionProvider",
      value,
    });
    notifyUpdated();
    setLoadingTranscriptionProvider(false);
  }

  async function handleChangeUserRating(value) {
    setUserRating(value);
    setLoadingUserRating(true);
    await update({
      column: "userRating",
      data: value,
    });
    notifyUpdated();
    setLoadingUserRating(false);
  }

  async function handleScheduleType(value) {
    setScheduleType(value);
    setLoadingScheduleType(true);
    await update({
      column: "scheduleType",
      data: value,
    });
    notifyUpdated();
    setLoadingScheduleType(false);
    if (typeof scheduleTypeChanged === "function") {
      scheduleTypeChanged(value);
    }
  }

  async function handleChatBotType(value) {
    setChatBotType(value);
    await update({
      column: "chatBotType",
      data: value,
    });
    notifyUpdated();
    if (typeof scheduleTypeChanged === "function") {
      setChatBotType(value);
    }
  }

  async function handleLGPDMessage(value) {
    setLGPDMessage(value);
    setLoadingLGPDMessage(true);
    await update({
      column: "lgpdMessage",
      data: value,
    });
    setLoadingLGPDMessage(false);
  }

  async function handletransferMessage(value) {
    setTransferMessage(value);
    setLoadingTransferMessage(true);
    await update({
      column: "transferMessage",
      data: value,
    });
    setLoadingTransferMessage(false);
  }

  async function handleGreetingAcceptedMessage(value) {
    setGreetingAcceptedMessage(value);
    setLoadingGreetingAcceptedMessage(true);
    await update({
      column: "greetingAcceptedMessage",
      data: value,
    });
    setLoadingGreetingAcceptedMessage(false);
  }

  async function handleAcceptCallWhatsappMessage(value) {
    setAcceptCallWhatsappMessage(value);
    setLoadingAcceptCallWhatsappMessage(true);
    await update({
      column: "AcceptCallWhatsappMessage",
      data: value,
    });
    setLoadingAcceptCallWhatsappMessage(false);
  }

  async function handlesendQueuePositionMessage(value) {
    setSendQueuePositionMessage(value);
    setLoadingSendQueuePositionMessage(true);
    await update({
      column: "sendQueuePositionMessage",
      data: value,
    });
    setLoadingSendQueuePositionMessage(false);
  }

  async function handleAcceptAudioMessageContactMessage(value) {
    setAcceptAudioMessageContactMessage(value);
    setLoadingAcceptAudioMessageContactMessage(true);
    await update({
      column: "AcceptAudioMessageContactMessage",
      data: value,
    });
    setLoadingAcceptAudioMessageContactMessage(false);
  }

  async function handleShowNotificationPending(value) {
    setShowNotificationPending(value);
    setLoadingShowNotificationPending(true);
    await update({
      column: "showNotificationPending",
      data: value,
    });
    notifyUpdated();
    setLoadingShowNotificationPending(false);
  }

  async function handleLGPDLink(value) {
    setLGPDLink(value);
    setLoadingLGPDLink(true);
    await update({
      column: "lgpdLink",
      data: value,
    });
    setLoadingLGPDLink(false);
  }

  async function handleLGPDDeleteMessage(value) {
    setLGPDDeleteMessage(value);
    setLoadingLGPDDeleteMessage(true);
    await update({
      column: "lgpdDeleteMessage",
      data: value,
    });
    notifyUpdated();
    setLoadingLGPDDeleteMessage(false);
  }

  async function handleLGPDConsent(value) {
    setLGPDConsent(value);
    setLoadingLGPDConsent(true);
    await update({
      column: "lgpdConsent",
      data: value,
    });
    notifyUpdated();
    setLoadingLGPDConsent(false);
  }

  async function handleLGPDHideNumber(value) {
    setLGPDHideNumber(value);
    setLoadingLGPDHideNumber(true);
    await update({
      column: "lgpdHideNumber",
      data: value,
    });
    notifyUpdated();
    setLoadingLGPDHideNumber(false);
  }

  async function handleSendGreetingAccepted(value) {
    setSendGreetingAccepted(value);
    setLoadingSendGreetingAccepted(true);
    await update({
      column: "sendGreetingAccepted",
      data: value,
    });
    notifyUpdated();
    setLoadingSendGreetingAccepted(false);
  }

  async function handleUserRandom(value) {
    setUserRandom(value);
    setLoadingUserRandom(true);
    await update({
      column: "userRandom",
      data: value,
    });
    notifyUpdated();
    setLoadingUserRandom(false);
  }

  async function handleSettingsTransfTicket(value) {
    setSettingsTransfTicket(value);
    setLoadingSettingsTransfTicket(true);
    await update({
      column: "sendMsgTransfTicket",
      data: value,
    });
    notifyUpdated();
    setLoadingSettingsTransfTicket(false);
  }

  async function handleAcceptCallWhatsapp(value) {
    setAcceptCallWhatsapp(value);
    setLoadingAcceptCallWhatsapp(true);
    await update({
      column: "acceptCallWhatsapp",
      data: value,
    });
    notifyUpdated();
    setLoadingAcceptCallWhatsapp(false);
  }

  async function handleSendSignMessage(value) {
    setSendSignMessage(value);
    setLoadingSendSignMessage(true);
    await update({
      column: "sendSignMessage",
      data: value,
    });
    notifyUpdated();
    localStorage.setItem("sendSignMessage", value === "enabled" ? true : false); //atualiza localstorage para sessão
    setLoadingSendSignMessage(false);
  }

  async function handleSendQueuePosition(value) {
    setSendQueuePosition(value);
    setLoadingSendQueuePosition(true);
    await update({
      column: "sendQueuePosition",
      data: value,
    });
    notifyUpdated();
    setLoadingSendQueuePosition(false);
  }

  async function handleSendFarewellWaitingTicket(value) {
    setSendFarewellWaitingTicket(value);
    setLoadingSendFarewellWaitingTicket(true);
    await update({
      column: "sendFarewellWaitingTicket",
      data: value,
    });
    notifyUpdated();
    setLoadingSendFarewellWaitingTicket(false);
  }

  async function handleAcceptAudioMessageContact(value) {
    setAcceptAudioMessageContact(value);
    setLoadingAcceptAudioMessageContact(true);
    await update({
      column: "acceptAudioMessageContact",
      data: value,
    });
    notifyUpdated();
    setLoadingAcceptAudioMessageContact(false);
  }

  async function handleEnableLGPD(value) {
    setEnableLGPD(value);
    setLoadingEnableLGPD(true);
    await update({
      column: "enableLGPD",
      data: value,
    });
    notifyUpdated();
    setLoadingEnableLGPD(false);
  }

  async function handleRequiredTag(value) {
    setRequiredTag(value);
    setLoadingRequiredTag(true);
    await update({
      column: "requiredTag",
      data: value,
    });
    notifyUpdated();
    setLoadingRequiredTag(false);
  }

  async function handleCloseTicketOnTransfer(value) {
    setCloseTicketOnTransfer(value);
    setLoadingCloseTicketOnTransfer(true);
    await update({
      column: "closeTicketOnTransfer",
      data: value,
    });
    notifyUpdated();
    setLoadingCloseTicketOnTransfer(false);
  }

  async function handleDirectTicketsToWallets(value) {
    setDirectTicketsToWallets(value);
    setLoadingDirectTicketsToWallets(true);
    await update({
      column: "DirectTicketsToWallets",
      data: value,
    });
    notifyUpdated();
    setLoadingDirectTicketsToWallets(false);
  }

  async function updateAiReplySetting(column, data) {
    setLoadingAiReplyConfig(true);
    try {
      await update({ column, data });
      notifyUpdated();
    } finally {
      setLoadingAiReplyConfig(false);
    }
  }

  async function handleAiReplyEnabled(value) {
    setAiReplyEnabled(value);
    await updateAiReplySetting("aiReplyEnabled", value);
  }

  async function handleAiReplyProvider(value) {
    const provider = normalizeAIProvider(value);
    const defaultModel = getDefaultModelByProvider(provider);
    setAiReplyProvider(provider);
    setAiReplyModel(defaultModel);
    setLoadingAiReplyConfig(true);
    try {
      await update({ column: "aiReplyProvider", data: provider });
      await update({ column: "aiReplyModel", data: defaultModel });
      notifyUpdated();
    } finally {
      setLoadingAiReplyConfig(false);
    }
  }

  async function handleAiReplyModel(value) {
    setAiReplyModel(value);
    await updateAiReplySetting("aiReplyModel", value);
  }

  async function handleAiReplyApiKey(value) {
    setAiReplyApiKey(value);
    await updateAiReplySetting("aiReplyApiKey", value);
  }

  async function handleAiReplyPrompt(value) {
    setAiReplyPrompt(value);
    await updateAiReplySetting("aiReplyPrompt", value);
  }

  async function handleAiReplyMaxTokens(value) {
    const numeric = Math.max(50, Math.min(4096, Number(value) || 300));
    setAiReplyMaxTokens(numeric);
    await updateAiReplySetting("aiReplyMaxTokens", numeric);
  }

  async function handleAiReplyTemperature(value) {
    const numeric = Math.max(0, Math.min(1, Number(value) || 0.4));
    setAiReplyTemperature(numeric);
    await updateAiReplySetting("aiReplyTemperature", numeric);
  }

  const enabledValue = (value) => (value === true || value === "enabled" ? "enabled" : "disabled");
  const booleanFromEnabledValue = (value) => value === "enabled";

  const optionDescriptions = {
    userCreation: "Habilita ou desabilita o cadastro de novas empresas no sistema.",
    userRating: "Ativa o fluxo de avaliação após o encerramento do atendimento.",
    scheduleType: "Define a regra de horário de expediente aplicada ao atendimento.",
    sendGreetingAccepted: "Envia uma mensagem automática ao assumir um ticket.",
    userRandom: "Distribui atendimento de forma automática e aleatória entre atendentes.",
    sendMsgTransfTicket: "Envia mensagem automática quando o ticket for transferido.",
    chatBotType: "Define como o menu inicial do bot será exibido para o cliente.",
    acceptCallWhatsapp: "Envia uma mensagem automática ao contato informando que ligações no WhatsApp não são aceitas.",
    sendSignMessage: "Permite que o atendente remova/ative assinatura ao enviar mensagens.",
    sendQueuePosition: "Envia ao cliente a posição atual na fila de atendimento.",
    sendFarewellWaitingTicket: "Envia mensagem de encerramento para tickets em aguardando.",
    acceptAudioMessageContact: "Permite aceitar ou bloquear mensagens de áudio dos contatos.",
    enableLGPD: "Ativa regras de privacidade e consentimento conforme a LGPD.",
    requiredTag: "Exige classificação por tag antes de concluir o atendimento.",
    closeTicketOnTransfer: "Fecha automaticamente o ticket ao transferir para outro setor.",
    showNotificationPending: "Mostra alertas para tickets com status aguardando.",
  };

  const renderEnabledDisabledRow = ({
    keyId,
    label,
    value,
    loading,
    onChange,
    isBoolean = false,
  }) => (
    <Paper className={classes.optionRow} elevation={0}>
      <div className={classes.optionHeader}>
        <Box>
          <div className={classes.optionTitle}>{label}</div>
          <div className={classes.optionDescription}>
            {optionDescriptions[keyId] || "Configuração operacional do atendimento."}
          </div>
        </Box>

        <ButtonGroup
          variant="outlined"
          color="primary"
          size="small"
          className={classes.toggleGroup}
          aria-label={`${keyId}-toggle`}
        >
          <Button
            className={classes.toggleButton}
            variant={enabledValue(value) === "disabled" ? "contained" : "outlined"}
            onClick={() => onChange(isBoolean ? false : "disabled")}
            disabled={loading}
          >
            {i18n.t("settings.settings.options.disabled")}
          </Button>
          <Button
            className={classes.toggleButton}
            variant={enabledValue(value) === "enabled" ? "contained" : "outlined"}
            onClick={() => onChange(isBoolean ? true : "enabled")}
            disabled={loading}
          >
            {i18n.t("settings.settings.options.enabled")}
          </Button>
        </ButtonGroup>
      </div>
      {loading && <div className={classes.updatingText}>{updatingLabel}</div>}
    </Paper>
  );

  return (
    <>
      <div className={classes.optionsList}>
        {/* O Master não opera nenhuma empresa-cliente — ele só libera o acesso
            (cadastra empresa/plano em Painel SaaS / Configurações > Empresas).
            Quem configura a identidade (nome, logo, cores) é o Admin de cada
            empresa que comprou o sistema, nunca o Master. */}
        {user.profile === "admin" && !user.super && (
          <Paper className={classes.optionRow} elevation={0}>
            <div className={classes.optionHeader}>
              <Box>
                <div className={classes.optionTitle}>Identidade da empresa (White Label)</div>
                <div className={classes.optionDescription}>
                  Nome, logomarcas, cores, favicon e ícones da sua empresa.
                </div>
              </Box>
            </div>
            <Whitelabel settings={oldSettings} />
          </Paper>
        )}

        {user.super && (
          <Paper className={classes.optionRow} elevation={0}>
            <div className={classes.optionHeader}>
              <Box>
                <div className={classes.optionTitle}>Login / capa (compartilhado)</div>
                <div className={classes.optionDescription}>
                  Imagem de fundo e link de WhatsApp da tela de login, compartilhados por
                  todas as empresas. Exclusivo do Master — a identidade de cada empresa
                  (nome, logo, cores) é configurada pelo Admin de cada empresa, não aqui.
                </div>
              </Box>
            </div>
            <Whitelabel
              loginOnly
              loginBrandingConfig={loginBrandingConfig}
              onLoginBrandingChange={handleLoginBrandingChange}
              onLoginBrandingUpload={handleLoginBrandingUpload}
              onLoginBrandingRemove={handleLoginBrandingRemove}
              resolveBrandingImageUrl={resolveBrandingImageUrl}
              loginBrandingUploading={loginBrandingUploading}
              loginBrandingRemoving={loginBrandingRemoving}
            />
          </Paper>
        )}

        {isSuper() &&
          renderEnabledDisabledRow({
            keyId: "userCreation",
            label: "Cadastro de Empresas",
            value: userCreation,
            loading: loadingUserCreation,
            onChange: handleChangeUserCreation,
          })}

        {renderEnabledDisabledRow({
          keyId: "userRating",
          label: i18n.t("settings.settings.options.evaluations"),
          value: userRating,
          loading: loadingUserRating,
          onChange: handleChangeUserRating,
        })}

        <Paper className={classes.optionRow} elevation={0}>
          <div className={classes.optionHeader}>
            <Box>
              <div className={classes.optionTitle}>Transcrição de Áudio</div>
              <div className={classes.optionDescription}>
                Configure a chave da API usada para transcrever mensagens de áudio.
              </div>
            </Box>
            <Button
              variant={showTranscriptionSettings ? "contained" : "outlined"}
              color="primary"
              size="small"
              className={classes.toggleButton}
              onClick={() => setShowTranscriptionSettings((prev) => !prev)}
            >
              {showTranscriptionSettings ? "Ocultar" : "Configurar"}
            </Button>
          </div>
          <Collapse in={showTranscriptionSettings} timeout="auto" unmountOnExit>
            <Grid container spacing={1}>
              <Grid xs={12} sm={4} item>
                <FormControl
                  variant="outlined"
                  size="small"
                  className={classes.selectField}
                  style={{ marginTop: 12 }}
                >
                  <InputLabel id="transcription-provider-label">Provedor</InputLabel>
                  <Select
                    labelId="transcription-provider-label"
                    value={transcriptionProvider}
                    onChange={(e) => handleTranscriptionProvider(e.target.value)}
                    label="Provedor"
                  >
                    <MenuItem value={"openai"}>OpenAI</MenuItem>
                    <MenuItem value={"gemini"}>Google Gemini</MenuItem>
                    <MenuItem value={"groq"}>Groq</MenuItem>
                  </Select>
                  <FormHelperText>
                    {loadingTranscriptionProvider &&
                      i18n.t("settings.settings.options.updating")}
                  </FormHelperText>
                </FormControl>
              </Grid>
              <Grid xs={12} sm={8} item>
                <FormControl className={classes.selectContainer}>
                  <TextField
                    className={classes.inlineMessageField}
                    id="apiTranscription"
                    name="apiTranscription"
                    margin="dense"
                    label={
                      transcriptionProvider === "gemini"
                        ? "Chave da API de Transcrição (Gemini)"
                        : transcriptionProvider === "groq"
                        ? "Chave da API de Transcrição (Groq)"
                        : "Chave da API de Transcrição (OpenAI)"
                    }
                    variant="outlined"
                    type="password"
                    value={apiTranscription}
                    placeholder={
                      transcriptionProvider === "gemini"
                        ? "cole sua chave do Google AI Studio..."
                        : transcriptionProvider === "groq"
                        ? "cole sua chave da Groq..."
                        : "cole sua chave da OpenAI..."
                    }
                    onChange={(e) => setApiTranscription(e.target.value)}
                    onBlur={async (e) => {
                      await handleApiTranscription(e.target.value);
                      notifyUpdated();
                    }}
                  />
                  <FormHelperText>
                    {loadingApiTranscription &&
                      i18n.t("settings.settings.options.updating")}
                  </FormHelperText>
                </FormControl>
              </Grid>
            </Grid>
          </Collapse>
        </Paper>

        {user?.profile === "admin" && (
          <Paper className={classes.optionRow} elevation={0}>
            <div className={classes.optionHeader}>
              <Box>
                <div className={classes.optionTitle}>Assistente de IA (Tela de Atendimento)</div>
                <div className={classes.optionDescription}>
                  Configuração exclusiva para melhorar texto digitado pelo atendente antes do envio.
                </div>
              </Box>
              <Button
                variant={showAiReplySettings ? "contained" : "outlined"}
                color="primary"
                size="small"
                className={classes.toggleButton}
                onClick={() => setShowAiReplySettings((prev) => !prev)}
              >
                {showAiReplySettings ? "Ocultar" : "Configurar"}
              </Button>
            </div>
            <Collapse in={showAiReplySettings} timeout="auto" unmountOnExit>
              <Grid container spacing={1}>
                <Grid xs={12} sm={4} item>
                  <FormControl variant="outlined" size="small" className={classes.selectField} style={{ marginTop: 12 }}>
                    <InputLabel id="ai-reply-enabled-label">Status</InputLabel>
                    <Select
                      labelId="ai-reply-enabled-label"
                      value={aiReplyEnabled}
                      onChange={(e) => handleAiReplyEnabled(e.target.value)}
                      label="Status"
                    >
                      <MenuItem value={"disabled"}>Desabilitado</MenuItem>
                      <MenuItem value={"enabled"}>Habilitado</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid xs={12} sm={4} item>
                  <FormControl variant="outlined" size="small" className={classes.selectField} style={{ marginTop: 12 }}>
                    <InputLabel id="ai-reply-provider-label">Serviço</InputLabel>
                    <Select
                      labelId="ai-reply-provider-label"
                      value={aiReplyProvider}
                      onChange={(e) => handleAiReplyProvider(e.target.value)}
                      label="Serviço"
                    >
                      {Object.entries(AI_PROVIDER_LABELS).map(([value, label]) => (
                        <MenuItem key={value} value={value}>
                          {label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid xs={12} sm={4} item>
                  <FormControl variant="outlined" size="small" className={classes.selectField} style={{ marginTop: 12 }}>
                    <InputLabel id="ai-reply-model-label">Modelo</InputLabel>
                    <Select
                      labelId="ai-reply-model-label"
                      value={aiReplyModel}
                      onChange={(e) => handleAiReplyModel(e.target.value)}
                      label="Modelo"
                    >
                      {(AI_PROVIDER_MODELS[aiReplyProvider] || []).map((model) => (
                        <MenuItem key={model} value={model}>
                          {AI_MODEL_LABELS[model] || model}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid xs={12} item>
                  <TextField
                    className={classes.inlineMessageField}
                    margin="dense"
                    fullWidth
                    variant="outlined"
                    type="password"
                    label="API Key (uso exclusivo para melhoria de texto)"
                    value={aiReplyApiKey}
                    onChange={(e) => setAiReplyApiKey(e.target.value)}
                    onBlur={(e) => handleAiReplyApiKey(e.target.value)}
                  />
                </Grid>
                <Grid xs={12} item>
                  <TextField
                    className={classes.inlineMessageField}
                    margin="dense"
                    fullWidth
                    variant="outlined"
                    multiline
                    minRows={3}
                    label="Prompt do assistente"
                    value={aiReplyPrompt}
                    onChange={(e) => setAiReplyPrompt(e.target.value)}
                    onBlur={(e) => handleAiReplyPrompt(e.target.value)}
                  />
                </Grid>
                <Grid xs={12} sm={6} item>
                  <TextField
                    className={classes.inlineMessageField}
                    margin="dense"
                    fullWidth
                    variant="outlined"
                    type="number"
                    label="Máx. tokens"
                    inputProps={{ min: 50, max: 4096, step: 1 }}
                    value={aiReplyMaxTokens}
                    onChange={(e) => setAiReplyMaxTokens(e.target.value)}
                    onBlur={(e) => handleAiReplyMaxTokens(e.target.value)}
                  />
                </Grid>
                <Grid xs={12} sm={6} item>
                  <TextField
                    className={classes.inlineMessageField}
                    margin="dense"
                    fullWidth
                    variant="outlined"
                    type="number"
                    label="Temperatura"
                    inputProps={{ min: 0, max: 1, step: 0.1 }}
                    value={aiReplyTemperature}
                    onChange={(e) => setAiReplyTemperature(e.target.value)}
                    onBlur={(e) => handleAiReplyTemperature(e.target.value)}
                  />
                </Grid>
              </Grid>
              {loadingAiReplyConfig && (
                <div className={classes.updatingText}>{updatingLabel}</div>
              )}
            </Collapse>
          </Paper>
        )}

        {renderEnabledDisabledRow({
          keyId: "sendGreetingAccepted",
          label: i18n.t("settings.settings.options.sendGreetingAccepted"),
          value: SendGreetingAccepted,
          loading: loadingSendGreetingAccepted,
          onChange: handleSendGreetingAccepted,
        })}
        <Collapse in={SendGreetingAccepted === "enabled"} timeout="auto" unmountOnExit>
          <Paper className={classes.optionRow} elevation={0}>
            <FormControl className={classes.selectContainer}>
              <TextField
                className={classes.inlineMessageField}
                id="greetingAcceptedMessage"
                name="greetingAcceptedMessage"
                margin="dense"
                multiline
                minRows={3}
                label={i18n.t("settings.settings.customMessages.greetingAcceptedMessage")}
                variant="outlined"
                value={greetingAcceptedMessage}
                required={SendGreetingAccepted === "enabled"}
                onChange={(e) => setGreetingAcceptedMessage(e.target.value)}
                onBlur={async (e) => {
                  await handleGreetingAcceptedMessage(e.target.value);
                  notifyUpdated();
                }}
              />
              <FormHelperText>
                {loadingGreetingAcceptedMessage &&
                  i18n.t("settings.settings.options.updating")}
              </FormHelperText>
            </FormControl>
          </Paper>
        </Collapse>

        {renderEnabledDisabledRow({
          keyId: "userRandom",
          label: i18n.t("settings.settings.options.userRandom"),
          value: UserRandom,
          loading: loadingUserRandom,
          onChange: handleUserRandom,
        })}

        {renderEnabledDisabledRow({
          keyId: "sendMsgTransfTicket",
          label: i18n.t("settings.settings.options.sendMsgTransfTicket"),
          value: SettingsTransfTicket,
          loading: loadingSettingsTransfTicket,
          onChange: handleSettingsTransfTicket,
        })}
        <Collapse in={SettingsTransfTicket === "enabled"} timeout="auto" unmountOnExit>
          <Paper className={classes.optionRow} elevation={0}>
            <FormControl className={classes.selectContainer}>
              <TextField
                className={classes.inlineMessageField}
                id="transferMessage"
                name="transferMessage"
                margin="dense"
                multiline
                minRows={3}
                label={i18n.t("settings.settings.customMessages.transferMessage")}
                variant="outlined"
                value={transferMessage}
                required={SettingsTransfTicket === "enabled"}
                onChange={(e) => setTransferMessage(e.target.value)}
                onBlur={async (e) => {
                  await handletransferMessage(e.target.value);
                  notifyUpdated();
                }}
              />
              <FormHelperText>
                {loadingTransferMessage &&
                  i18n.t("settings.settings.options.updating")}
              </FormHelperText>
            </FormControl>
          </Paper>
        </Collapse>

        <Paper className={classes.optionRow} elevation={0}>
          <div className={classes.optionHeader}>
            <Box>
              <div className={classes.optionTitle}>
                {i18n.t("settings.settings.options.chatBotType")}
              </div>
              <div className={classes.optionDescription}>
                {optionDescriptions.chatBotType}
              </div>
            </Box>
            <FormControl variant="outlined" size="small" className={classes.selectField}>
              <Select
                value={chatBotType}
                onChange={async (e) => {
                  handleChatBotType(e.target.value);
                }}
              >
                <MenuItem value={"text"}>Texto</MenuItem>
              </Select>
            </FormControl>
          </div>
        </Paper>

        {renderEnabledDisabledRow({
          keyId: "acceptCallWhatsapp",
          label: i18n.t("settings.settings.options.acceptCallWhatsapp"),
          value: AcceptCallWhatsapp,
          loading: loadingAcceptCallWhatsapp,
          onChange: handleAcceptCallWhatsapp,
        })}
        <Collapse in={AcceptCallWhatsapp === "enabled"} timeout="auto" unmountOnExit>
          <Paper className={classes.optionRow} elevation={0}>
            <FormControl className={classes.selectContainer}>
              <TextField
                className={classes.inlineMessageField}
                id="AcceptCallWhatsappMessage"
                name="AcceptCallWhatsappMessage"
                margin="dense"
                multiline
                minRows={3}
                label={i18n.t("settings.settings.customMessages.AcceptCallWhatsappMessage")}
                variant="outlined"
                required={AcceptCallWhatsapp === "disabled"}
                value={AcceptCallWhatsappMessage}
                onChange={(e) => setAcceptCallWhatsappMessage(e.target.value)}
                onBlur={async (e) => {
                  await handleAcceptCallWhatsappMessage(e.target.value);
                  notifyUpdated();
                }}
              />
              <FormHelperText>
                {loadingAcceptCallWhatsappMessage &&
                  i18n.t("settings.settings.options.updating")}
              </FormHelperText>
            </FormControl>
          </Paper>
        </Collapse>

        {renderEnabledDisabledRow({
          keyId: "sendSignMessage",
          label: i18n.t("settings.settings.options.sendSignMessage"),
          value: sendSignMessage,
          loading: loadingSendSignMessage,
          onChange: handleSendSignMessage,
        })}

        {renderEnabledDisabledRow({
          keyId: "sendQueuePosition",
          label: i18n.t("settings.settings.options.sendQueuePosition"),
          value: sendQueuePosition,
          loading: loadingSendQueuePosition,
          onChange: handleSendQueuePosition,
        })}
        <Collapse in={sendQueuePosition === "enabled"} timeout="auto" unmountOnExit>
          <Paper className={classes.optionRow} elevation={0}>
            <FormControl className={classes.selectContainer}>
              <TextField
                className={classes.inlineMessageField}
                id="sendQueuePositionMessage"
                name="sendQueuePositionMessage"
                margin="dense"
                multiline
                required={sendQueuePosition === "enabled"}
                minRows={3}
                label={i18n.t("settings.settings.customMessages.sendQueuePositionMessage")}
                variant="outlined"
                value={sendQueuePositionMessage}
                onChange={(e) => setSendQueuePositionMessage(e.target.value)}
                onBlur={async (e) => {
                  await handlesendQueuePositionMessage(e.target.value);
                  notifyUpdated();
                }}
              />
              <FormHelperText>
                {loadingSendQueuePositionMessage &&
                  i18n.t("settings.settings.options.updating")}
              </FormHelperText>
            </FormControl>
          </Paper>
        </Collapse>

        {renderEnabledDisabledRow({
          keyId: "sendFarewellWaitingTicket",
          label: i18n.t("settings.settings.options.sendFarewellWaitingTicket"),
          value: sendFarewellWaitingTicket,
          loading: loadingSendFarewellWaitingTicket,
          onChange: handleSendFarewellWaitingTicket,
        })}

        {renderEnabledDisabledRow({
          keyId: "acceptAudioMessageContact",
          label: i18n.t("settings.settings.options.acceptAudioMessageContact"),
          value: acceptAudioMessageContact,
          loading: loadingAcceptAudioMessageContact,
          onChange: handleAcceptAudioMessageContact,
        })}
        <Collapse in={acceptAudioMessageContact === "disabled"} timeout="auto" unmountOnExit>
          <Paper className={classes.optionRow} elevation={0}>
            <FormControl className={classes.selectContainer}>
              <TextField
                className={classes.inlineMessageField}
                id="AcceptAudioMessageContactMessage"
                name="AcceptAudioMessageContactMessage"
                margin="dense"
                multiline
                required={acceptAudioMessageContact === "disabled"}
                minRows={3}
                label={i18n.t("settings.settings.customMessages.AcceptAudioMessageContactMessage")}
                variant="outlined"
                value={AcceptAudioMessageContactMessage}
                onChange={(e) => setAcceptAudioMessageContactMessage(e.target.value)}
                onBlur={async (e) => {
                  await handleAcceptAudioMessageContactMessage(e.target.value);
                  notifyUpdated();
                }}
              />
              <FormHelperText>
                {loadingAcceptAudioMessageContactMessage &&
                  i18n.t("settings.settings.options.updating")}
              </FormHelperText>
            </FormControl>
          </Paper>
        </Collapse>

        {renderEnabledDisabledRow({
          keyId: "enableLGPD",
          label: i18n.t("settings.settings.options.enableLGPD"),
          value: enableLGPD,
          loading: loadingEnableLGPD,
          onChange: handleEnableLGPD,
        })}

        {renderEnabledDisabledRow({
          keyId: "requiredTag",
          label: i18n.t("settings.settings.options.requiredTag"),
          value: requiredTag,
          loading: loadingRequiredTag,
          onChange: handleRequiredTag,
        })}

        {renderEnabledDisabledRow({
          keyId: "closeTicketOnTransfer",
          label: i18n.t("settings.settings.options.closeTicketOnTransfer"),
          value: enabledValue(closeTicketOnTransfer),
          loading: loadingCloseTicketOnTransfer,
          onChange: (value) => handleCloseTicketOnTransfer(booleanFromEnabledValue(value)),
        })}

        {renderEnabledDisabledRow({
          keyId: "showNotificationPending",
          label: i18n.t("settings.settings.options.showNotificationPending"),
          value: enabledValue(showNotificationPending),
          loading: loadingShowNotificationPending,
          onChange: (value) => handleShowNotificationPending(booleanFromEnabledValue(value)),
        })}
      </div>
      <br></br>
      {/*-----------------LGPD-----------------*/}
      {enableLGPD === "enabled" && (
        <>
          <Grid spacing={3} container style={{ marginBottom: 10 }}>
            <Tabs
              value={0}
              indicatorColor="primary"
              textColor="primary"
              scrollButtons="on"
              variant="scrollable"
              className={classes.tab}
            >
              <Tab label={i18n.t("settings.settings.LGPD.title")} />
            </Tabs>
          </Grid>
          <Grid spacing={1} container>
            <Grid xs={12} sm={6} md={12} item>
              <FormControl className={classes.selectContainer}>
                <TextField
                  id="lgpdMessage"
                  name="lgpdMessage"
                  margin="dense"
                  multiline
                  minRows={3}
                  label={i18n.t("settings.settings.LGPD.welcome")}
                  variant="outlined"
                  value={lgpdMessage}
                  onChange={(e) => setLGPDMessage(e.target.value)}
                  onBlur={async (e) => {
                    await handleLGPDMessage(e.target.value);
                    notifyUpdated();
                  }}
                ></TextField>
                <FormHelperText>
                  {loadinglgpdMessage &&
                    i18n.t("settings.settings.options.updating")}
                </FormHelperText>
              </FormControl>
            </Grid>
            <Grid xs={12} sm={6} md={12} item>
              <FormControl className={classes.selectContainer}>
                <TextField
                  id="lgpdLink"
                  name="lgpdLink"
                  margin="dense"
                  label={i18n.t("settings.settings.LGPD.linkLGPD")}
                  variant="outlined"
                  value={lgpdLink}
                  onChange={(e) => setLGPDLink(e.target.value)}
                  onBlur={async (e) => {
                    await handleLGPDLink(e.target.value);
                    notifyUpdated();
                  }}
                ></TextField>
                <FormHelperText>
                  {loadingLGPDLink &&
                    i18n.t("settings.settings.options.updating")}
                </FormHelperText>
              </FormControl>
            </Grid>
            {/* LGPD Manter ou nao mensagem deletada pelo contato */}
            <Grid xs={12} sm={6} md={4} item>
              <FormControl className={classes.selectContainer}>
                <InputLabel id="lgpdDeleteMessage-label">
                  {i18n.t(
                    "settings.settings.LGPD.obfuscateMessageDelete"
                  )}
                </InputLabel>
                <Select
                  labelId="lgpdDeleteMessage-label"
                  value={lgpdDeleteMessage}
                  onChange={async (e) => {
                    handleLGPDDeleteMessage(e.target.value);
                  }}
                >
                  <MenuItem value={"disabled"}>
                    {i18n.t("settings.settings.LGPD.disabled")}
                  </MenuItem>
                  <MenuItem value={"enabled"}>
                    {i18n.t("settings.settings.LGPD.enabled")}
                  </MenuItem>
                </Select>
                <FormHelperText>
                  {loadingLGPDDeleteMessage &&
                    i18n.t("settings.settings.options.updating")}
                </FormHelperText>
              </FormControl>
            </Grid>
            {/* LGPD Sempre solicitar confirmaçao / conscentimento dos dados */}
            <Grid xs={12} sm={6} md={4} item>
              <FormControl className={classes.selectContainer}>
                <InputLabel id="lgpdConsent-label">
                  {i18n.t("settings.settings.LGPD.alwaysConsent")}
                </InputLabel>
                <Select
                  labelId="lgpdConsent-label"
                  value={lgpdConsent}
                  onChange={async (e) => {
                    handleLGPDConsent(e.target.value);
                  }}
                >
                  <MenuItem value={"disabled"}>
                    {i18n.t("settings.settings.LGPD.disabled")}
                  </MenuItem>
                  <MenuItem value={"enabled"}>
                    {i18n.t("settings.settings.LGPD.enabled")}
                  </MenuItem>
                </Select>
                <FormHelperText>
                  {loadingLGPDConsent &&
                    i18n.t("settings.settings.options.updating")}
                </FormHelperText>
              </FormControl>
            </Grid>
            {/* LGPD Ofuscar número telefone para usuários */}
            <Grid xs={12} sm={6} md={4} item>
              <FormControl className={classes.selectContainer}>
                <InputLabel id="lgpdHideNumber-label">
                  {i18n.t("settings.settings.LGPD.obfuscatePhoneUser")}
                </InputLabel>
                <Select
                  labelId="lgpdHideNumber-label"
                  value={lgpdHideNumber}
                  onChange={async (e) => {
                    handleLGPDHideNumber(e.target.value);
                  }}
                >
                  <MenuItem value={"disabled"}>
                    {i18n.t("settings.settings.LGPD.disabled")}
                  </MenuItem>
                  <MenuItem value={"enabled"}>
                    {i18n.t("settings.settings.LGPD.enabled")}
                  </MenuItem>
                </Select>
                <FormHelperText>
                  {loadingLGPDHideNumber &&
                    i18n.t("settings.settings.options.updating")}
                </FormHelperText>
              </FormControl>
            </Grid>
          </Grid>
        </>
      )}
      <Grid spacing={1} container>
      </Grid>
    </>
  );
}
