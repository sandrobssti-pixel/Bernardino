import React, { useState, useEffect, useRef, useContext } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import { isNil } from "lodash";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import moment from "moment";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  DialogActions,
  CircularProgress,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Switch,
  FormControlLabel,
  Grid,
  Divider,
  Tab,
  Tabs,
  Paper,
  Box,
  Typography,
  InputAdornment,
  IconButton,
  useMediaQuery,
  useTheme
} from "@material-ui/core";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import QueueSelect from "../QueueSelect";
import TabPanel from "../TabPanel";
import { Autorenew, FileCopy, Colorize, InfoOutlined } from "@material-ui/icons";
import SettingsInputAntennaIcon from "@material-ui/icons/SettingsInputAntenna";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import HighlightOffIcon from "@material-ui/icons/HighlightOff";
import CloseIcon from "@material-ui/icons/Close";
import TuneOutlinedIcon from "@material-ui/icons/TuneOutlined";
import ExtensionOutlinedIcon from "@material-ui/icons/ExtensionOutlined";
import MessageOutlinedIcon from "@material-ui/icons/MessageOutlined";
import AndroidIcon from "@material-ui/icons/Android";
import StarBorderOutlinedIcon from "@material-ui/icons/StarBorderOutlined";
import AccountTreeOutlinedIcon from "@material-ui/icons/AccountTreeOutlined";
import DescriptionOutlinedIcon from "@material-ui/icons/DescriptionOutlined";
import CloudUploadOutlinedIcon from "@material-ui/icons/CloudUploadOutlined";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import usePlans from "../../hooks/usePlans";
import { AuthContext } from "../../context/Auth/AuthContext";
import ColorBoxModal from "../ColorBoxModal";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4
  },

  dialogPaper: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: theme.palette.type === "light" ? "#f7f8fa" : "#101418",
    [theme.breakpoints.down("xs")]: {
      borderRadius: 0,
      margin: 0,
    },
  },

  modalHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 20px",
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark || theme.palette.primary.main} 100%)`,
    color: "#fff",
    [theme.breakpoints.down("xs")]: {
      padding: "12px 14px",
      gap: 10,
    },
  },
  modalHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    flexShrink: 0,
    "& svg": {
      fontSize: 18,
    },
    [theme.breakpoints.down("xs")]: {
      width: 30,
      height: 30,
      "& svg": {
        fontSize: 16,
      },
    },
  },
  modalHeaderTexts: {
    flex: 1,
    minWidth: 0,
  },
  modalHeaderTitle: {
    fontSize: "0.95rem",
    fontWeight: 700,
    lineHeight: 1.3,
    letterSpacing: "-0.2px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    [theme.breakpoints.down("xs")]: {
      fontSize: "0.85rem",
    },
  },
  modalHeaderSubtitle: {
    fontSize: "0.72rem",
    opacity: 0.85,
    marginTop: 1,
    fontWeight: 400,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    [theme.breakpoints.down("xs")]: {
      display: "none",
    },
  },
  modalCloseBtn: {
    color: "#fff",
    backgroundColor: "rgba(255,255,255,0.12)",
    flexShrink: 0,
    "&:hover": {
      backgroundColor: "rgba(255,255,255,0.24)",
    },
  },

  mainPaper: {
    backgroundColor: theme.palette.type === "light" ? "#fff" : "#161b20",
    borderBottom: `1px solid ${theme.palette.type === "light" ? "#e5e7eb" : "#262f38"}`,
  },
  tab: {
    minHeight: 40,
    "& .MuiTabs-indicator": {
      display: "none",
    },
  },
  tabRoot: {
    minHeight: 40,
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.78rem",
    opacity: 0.65,
    padding: "7px 12px",
    marginTop: 5,
    marginBottom: 5,
    marginRight: 2,
    borderRadius: 8,
    minWidth: "auto",
    color: theme.palette.type === "light" ? "#334155" : "#cbd5e1",
    "&:hover": {
      opacity: 1,
      backgroundColor: theme.palette.type === "light" ? "#f1f5f9" : "#1f2932",
    },
  },
  tabSelected: {
    opacity: 1,
    color: "#fff !important",
    backgroundColor: theme.palette.primary.main,
  },
  tabIcon: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    "& svg": {
      fontSize: 15,
    },
  },

  paper: {
    backgroundColor: "transparent",
    maxHeight: "62vh",
    overflowY: "auto",
    fontSize: "0.85rem",
    [theme.breakpoints.down("xs")]: {
      maxHeight: "calc(100vh - 160px)",
    },
    "& .MuiDialogContent-root": {
      padding: "14px 20px",
      [theme.breakpoints.down("xs")]: {
        padding: "12px 14px",
      },
    },
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      backgroundColor: theme.palette.type === "light" ? "#fff" : "#161b20",
    },
    "& .MuiOutlinedInput-input, & .MuiSelect-outlined": {
      padding: "8.5px 12px",
      fontSize: "0.85rem",
    },
    "& .MuiInputBase-root": {
      fontSize: "0.85rem",
    },
    "& .MuiInputLabel-outlined": {
      fontSize: "0.85rem",
      transform: "translate(12px, 11px) scale(1)",
    },
    "& .MuiInputLabel-outlined.MuiInputLabel-shrink": {
      transform: "translate(12px, -6px) scale(0.75)",
    },
    "& .MuiFormLabel-root": {
      fontSize: "0.85rem",
    },
    "& .MuiFormHelperText-root": {
      fontSize: "0.72rem",
      marginLeft: 2,
    },
    "& .MuiFormControlLabel-label": {
      fontSize: "0.82rem",
    },
    "& .MuiFormControl-root": {
      marginTop: 6,
      marginBottom: 6,
    },
    "& h3": {
      fontSize: "0.86rem",
      fontWeight: 700,
      margin: "4px 0 2px",
      color: theme.palette.type === "light" ? "#0f172a" : "#e2e8f0",
    },
    "& p": {
      fontSize: "0.8rem",
      color: theme.palette.type === "light" ? "#64748b" : "#94a3b8",
      lineHeight: 1.5,
      margin: "0 0 8px",
    },
  },

  section: {
    backgroundColor: theme.palette.type === "light" ? "#fff" : "#161b20",
    border: `1px solid ${theme.palette.type === "light" ? "#e5e7eb" : "#262f38"}`,
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: "0.84rem",
    fontWeight: 700,
    color: theme.palette.type === "light" ? "#0f172a" : "#e2e8f0",
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: "0.76rem",
    color: theme.palette.type === "light" ? "#64748b" : "#94a3b8",
    marginBottom: 10,
  },

  uploadBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
    border: `1.5px dashed ${theme.palette.type === "light" ? "#cbd5e1" : "#334155"}`,
    borderRadius: 10,
    padding: "9px 14px",
    marginBottom: 12,
    backgroundColor: theme.palette.type === "light" ? "#f8fafc" : "#12171c",
  },
  uploadBoxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: "0.8rem",
    color: theme.palette.type === "light" ? "#475569" : "#94a3b8",
    minWidth: 0,
    flex: "1 1 160px",
  },
  uploadBoxFileName: {
    fontSize: "0.8rem",
    fontWeight: 600,
    color: theme.palette.type === "light" ? "#0f172a" : "#e2e8f0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  pillButton: {
    borderRadius: 8,
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.82rem",
    padding: "5px 14px",
  },

  dialogActions: {
    padding: "10px 20px",
    borderTop: `1px solid ${theme.palette.type === "light" ? "#e5e7eb" : "#262f38"}`,
    backgroundColor: theme.palette.type === "light" ? "#fff" : "#161b20",
  },

  multFieldLine: {
    marginTop: 12,
    display: "flex",
    "& > *:not(:last-child)": {
      marginRight: theme.spacing(1),
    },
  },

  btnWrapper: {
    position: "relative",
  },
  importMessage: {
    marginTop: 12,
    marginBottom: 12,
    padding: 14,
    border: `1px solid ${theme.palette.type === "light" ? "#e5e7eb" : "#262f38"}`,
    borderRadius: 12,
    backgroundColor: theme.palette.type === "light" ? "#f8fafc" : "#12171c",
    display: "flex",
    "& > *:not(:last-child)": {
      marginRight: theme.spacing(1),
    },
  },

  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },

  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },
  tokenRefresh: {
    minWidth: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  iosSwitchRoot: {
    width: 28,
    height: 17,
    padding: 0,
    margin: "0 6px 0 0",
  },
  iosSwitchBase: {
    padding: 1.5,
    "&.Mui-checked": {
      transform: "translateX(11px)",
      color: "#fff",
      "& + .MuiSwitch-track": {
        backgroundColor: "#34c759",
        borderColor: "#34c759",
        opacity: 1,
      },
    },
  },
  iosSwitchThumb: {
    width: 14,
    height: 14,
    boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
  },
  iosSwitchTrack: {
    borderRadius: 9,
    border: `1px solid ${theme.palette.type === "light" ? "#d1d5db" : "#475569"}`,
    backgroundColor: theme.palette.type === "light" ? "#e5e7eb" : "#334155",
    opacity: 1,
    transition: theme.transitions.create(["background-color", "border"]),
  },
  switchFieldLabel: {
    marginLeft: 0,
    marginRight: 0,
  },
  colorAdorment: {
    width: 18,
    height: 18,
    borderRadius: 6,
    border: "1px solid rgba(0, 0, 0, 0.12)",
  },
  whatsappAlert: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: theme.palette.type === "light" ? "#fffbeb" : "#2d2000",
    border: `1px solid ${theme.palette.type === "light" ? "#fcd34d" : "#92400e"}`,
    borderLeft: `3px solid ${theme.palette.type === "light" ? "#f59e0b" : "#d97706"}`,
    borderRadius: 8,
    padding: "8px 12px",
    marginBottom: 10,
  },
  whatsappAlertIcon: {
    color: theme.palette.type === "light" ? "#b45309" : "#fbbf24",
    marginTop: 1,
    flexShrink: 0,
    fontSize: 16,
  },
  whatsappAlertTitle: {
    fontWeight: 600,
    fontSize: "0.72rem",
    color: theme.palette.type === "light" ? "#92400e" : "#fcd34d",
    marginBottom: 3,
  },
  proxyInfoBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: theme.palette.type === "light" ? "#eff6ff" : "#1e3a5f",
    border: `1px solid ${theme.palette.type === "light" ? "#bfdbfe" : "#1d4ed8"}`,
    borderLeft: `3px solid ${theme.palette.type === "light" ? "#3b82f6" : "#60a5fa"}`,
    borderRadius: 8,
    padding: "8px 12px",
    marginTop: 6,
  },
  proxyInfoText: {
    fontSize: "0.68rem",
    color: theme.palette.type === "light" ? "#1e40af" : "#bfdbfe",
    lineHeight: 1.7,
    margin: 0,
    padding: 0,
    listStyle: "none",
    "& li::before": {
      content: '"• "',
    },
  },
  whatsappAlertText: {
    fontSize: "0.68rem",
    color: theme.palette.type === "light" ? "#78350f" : "#fde68a",
    lineHeight: 1.6,
    margin: 0,
    padding: 0,
    listStyle: "none",
    "& li::before": {
      content: '"• "',
    },
  },
}));

const SessionSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Too Short!")
    .max(50, "Too Long!")
    .required("Required"),
});

const DATE_TIME_LOCAL_FORMAT = "YYYY-MM-DDTHH:mm";
const MAX_IMPORT_DAYS = 60;
const DATE_TIME_PARSE_FORMATS = [
  DATE_TIME_LOCAL_FORMAT,
  "YYYY-MM-DD HH:mm:ss.SSS Z",
  "YYYY-MM-DD HH:mm:ss Z",
  moment.ISO_8601,
];

const getImportMinDate = () =>
  moment()
    .add(-MAX_IMPORT_DAYS, "days")
    .format(DATE_TIME_LOCAL_FORMAT);

const toDateTimeLocal = (value) => {
  if (isNil(value) || value === "") return "";
  const parsed = moment.parseZone(value, DATE_TIME_PARSE_FORMATS, true);
  return parsed.isValid() ? parsed.format(DATE_TIME_LOCAL_FORMAT) : "";
};

const toDateTimeISO = (value) => {
  if (isNil(value) || value === "") return null;
  const parsed = moment(value, DATE_TIME_LOCAL_FORMAT, true);
  return parsed.isValid() ? parsed.toISOString() : null;
};

const WhatsAppModal = ({
  open,
  onClose,
  whatsAppId,
  providerPreset = "beta",
  channelPreset = "whatsapp",
  baileysEnabled = true,
  wuzapiEnabled = true
}) => {
  const classes = useStyles();
  const theme = useTheme();
  const fullScreenModal = useMediaQuery(theme.breakpoints.down("xs"));
  const [autoToken, setAutoToken] = useState("");

  const inputFileRef = useRef(null);

  const [attachment, setAttachment] = useState(null)
  const [attachmentName, setAttachmentName] = useState('')

  const initialState = {
    name: "",
    color: "",
    greetingMessage: "",
    complationMessage: "",
    outOfHoursMessage: "",
    ratingMessage: "",
    ratingThanksMessage: "",
    isDefault: false,
    token: "",
    maxUseBotQueues: 3,
    provider: "beta",
    channel: "whatsapp",
    wuzapiUrl: "",
    wuzapiToken: "",
    proxyUrl: "",
    phone_number_id: "",
    waba_id: "",
    send_token: "",
    business_id: "",
    phone_number: "",
    waba_webhook: "",
    waba_webhook_id: null,
    expiresTicket: 0,
    allowGroup: false,
    enableImportMessage: false,
    groupAsTicket: "disabled",
    timeUseBotQueues: '0',
    timeSendQueue: '0',
    sendIdQueue: 0,
    expiresTicketNPS: '0',
    expiresInactiveMessage: "",
    timeInactiveMessage: "",
    inactiveMessage: "",
    maxUseBotQueuesNPS: 3,
    whenExpiresTicket: 0,
    timeCreateNewTicket: 0,
    greetingMediaAttachment: "",
    importRecentMessages: "",
    importOldMessages: "",
    importOldMessagesGroups: false,
    integrationId: "",
    collectiveVacationEnd: "",
    collectiveVacationStart: "",
    collectiveVacationMessage: "",
    queueIdImportMessages: null
  };
  const [whatsApp, setWhatsApp] = useState(initialState);
  const [selectedQueueIds, setSelectedQueueIds] = useState([]);
  const [queues, setQueues] = useState([]);
  const [tab, setTab] = useState("general");
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [enableImportMessage, setEnableImportMessage] = useState(false);
  const [importOldMessagesGroups, setImportOldMessagesGroups] = useState(false);
  const [closedTicketsPostImported, setClosedTicketsPostImported] = useState(false);
  const [importOldMessages, setImportOldMessages] = useState(moment().add(-1, "days").format("YYYY-MM-DDTHH:mm"));
  const [importRecentMessages, setImportRecentMessages] = useState(moment().add(-1, "minutes").format("YYYY-MM-DDTHH:mm"));
  const [copied, setCopied] = useState(false);
  const [callbackCopied, setCallbackCopied] = useState(false);
  const [colorPickerModalOpen, setColorPickerModalOpen] = useState(false);

  const [NPSEnabled, setNPSEnabled] = useState(false);
  const [showOpenAi, setShowOpenAi] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const { user } = useContext(AuthContext);

  const [schedules, setSchedules] = useState([
    { weekday: i18n.t("queueModal.serviceHours.monday"), weekdayEn: "monday", startTimeA: "08:00", endTimeA: "12:00", startTimeB: "13:00", endTimeB: "18:00", },
    { weekday: i18n.t("queueModal.serviceHours.tuesday"), weekdayEn: "tuesday", startTimeA: "08:00", endTimeA: "12:00", startTimeB: "13:00", endTimeB: "18:00", },
    { weekday: i18n.t("queueModal.serviceHours.wednesday"), weekdayEn: "wednesday", startTimeA: "08:00", endTimeA: "12:00", startTimeB: "13:00", endTimeB: "18:00", },
    { weekday: i18n.t("queueModal.serviceHours.thursday"), weekdayEn: "thursday", startTimeA: "08:00", endTimeA: "12:00", startTimeB: "13:00", endTimeB: "18:00", },
    { weekday: i18n.t("queueModal.serviceHours.friday"), weekdayEn: "friday", startTimeA: "08:00", endTimeA: "12:00", startTimeB: "13:00", endTimeB: "18:00", },
    { weekday: "Sábado", weekdayEn: "saturday", startTimeA: "08:00", endTimeA: "12:00", startTimeB: "13:00", endTimeB: "18:00", },
    { weekday: "Domingo", weekdayEn: "sunday", startTimeA: "08:00", endTimeA: "12:00", startTimeB: "13:00", endTimeB: "18:00", },
  ]);
  const schedulesRef = useRef(schedules);

  const { get: getSetting } = useCompanySettings();
  const { getPlanCompany } = usePlans();

  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [prompts, setPrompts] = useState([]);

  const [webhooks, setWebhooks] = useState([]);
  const [flowIdNotPhrase, setFlowIdNotPhrase] = useState();
  const [flowIdWelcome, setFlowIdWelcome] = useState();

  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [integrations, setIntegrations] = useState([]);
  const [officialTemplates, setOfficialTemplates] = useState([]);
  const [officialTemplatesLoading, setOfficialTemplatesLoading] = useState(false);
  const [officialTemplatesSyncing, setOfficialTemplatesSyncing] = useState(false);
  const [officialTemplateSendingId, setOfficialTemplateSendingId] = useState(null);
  const [officialTemplatesLastSyncAt, setOfficialTemplatesLastSyncAt] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState(null);
  const [registeringNumber, setRegisteringNumber] = useState(false);
  const [registerNumberResult, setRegisterNumberResult] = useState(null);

  useEffect(() => {
    if (!whatsAppId && !whatsApp.token) {
      setAutoToken(generateRandomCode(30));
    } else if (whatsAppId && !whatsApp.token) {
      setAutoToken(generateRandomCode(30));
    } else {
      setAutoToken(whatsApp.token);
    }
  }, [whatsAppId, whatsApp.token]);

  useEffect(() => {
    if (!open || whatsAppId) return;
    setProxyEnabled(false);
    setWhatsApp((prev) => ({
      ...prev,
      provider: providerPreset || "beta",
      channel: channelPreset || "whatsapp"
    }));
  }, [open, whatsAppId, providerPreset, channelPreset]);

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);

      setShowOpenAi(planConfigs.plan.useOpenAi);
      setShowIntegrations(planConfigs.plan.useIntegrations);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/prompt");
        setPrompts(data.prompts);
      } catch (err) {
        toastError(err);
      }
    })();
  }, [whatsAppId]);

  useEffect(() => {

    const fetchData = async () => {

      const settingNPS = await getSetting({
        "column": "userRating"
      });
      setNPSEnabled(settingNPS.userRating === "enabled");
    }
    fetchData();
  }, []);

  const handleEnableImportMessage = async (e) => {
    setEnableImportMessage(e.target.checked);

  };

  useEffect(() => {
    const fetchSession = async () => {
      if (!whatsAppId) return;

      try {
        const { data } = await api.get(`whatsapp/${whatsAppId}?session=0`);
        if (data && data?.flowIdNotPhrase) {
          const { data: flowDefault } = await api.get(`flowbuilder/${data.flowIdNotPhrase}`)
          console.log(flowDefault?.flow.id)
          const selectedFlowIdNotPhrase = flowDefault?.flow.id
          setFlowIdNotPhrase(selectedFlowIdNotPhrase)
        }
        if (data && data?.flowIdWelcome) {
          const { data: flowDefault } = await api.get(`flowbuilder/${data.flowIdWelcome}`)
          console.log(flowDefault?.flow.id)
          const selectedFlowIdWelcome = flowDefault?.flow.id
          setFlowIdWelcome(selectedFlowIdWelcome)
        }
        setWhatsApp({
          ...initialState,
          ...data,
          color: data?.color || "",
          isDefault: Boolean(data?.isDefault),
          allowGroup: Boolean(data?.allowGroup),
        });
        setProxyEnabled(Boolean(data?.proxyUrl));
        setAttachmentName(data.greetingMediaAttachment);
        setAutoToken(data.token);
        setSelectedIntegration(data?.integrationId)
        data.promptId ? setSelectedPrompt(data.promptId) : setSelectedPrompt(null);
        const whatsQueueIds = data.queues?.map((queue) => queue.id);
        setSelectedQueueIds(whatsQueueIds);
        setSchedules(data.schedules)
        schedulesRef.current = data.schedules;
        if (!isNil(data?.importOldMessages)) {
          const normalizedImportOldMessages = toDateTimeLocal(data?.importOldMessages);
          const normalizedImportRecentMessages = toDateTimeLocal(data?.importRecentMessages);
          setEnableImportMessage(true);
          setImportOldMessages(
            normalizedImportOldMessages || moment().add(-1, "days").format(DATE_TIME_LOCAL_FORMAT)
          );
          setImportRecentMessages(
            normalizedImportRecentMessages || moment().add(-1, "minutes").format(DATE_TIME_LOCAL_FORMAT)
          );
          setClosedTicketsPostImported(Boolean(data?.closedTicketsPostImported));
          setImportOldMessagesGroups(Boolean(data?.importOldMessagesGroups));
        }
      } catch (err) {
        toastError(err);
      }
    };
    fetchSession();
  }, [whatsAppId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/queue");
        setQueues(data);
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/queueIntegration");

        setIntegrations(data.queueIntegrations);
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);


  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/flowbuilder")
        setWebhooks(data.flows)
      } catch (err) {
        toastError(err)
      }
    })();
  }, [])

  const handleChangeQueue = (e) => {
    setSelectedQueueIds(e);
    setSelectedPrompt(null);
    setSelectedIntegration(null)
  };

  const handleChangeIntegration = (e) => {
    setSelectedIntegration(e.target.value)
    setSelectedPrompt(null)
    setSelectedQueueIds([])
  }

  const handleChangeFlowIdNotPhrase = (e) => {
    console.log(e.target.value)
    setFlowIdNotPhrase(e.target.value)
  }

  const handleChangeFlowIdWelcome = (e) => {
    console.log(e.target.value)
    setFlowIdWelcome(e.target.value)
  }

  const handleChangePrompt = (e) => {
    setSelectedPrompt(e.target.value);
    setSelectedQueueIds([]);
    setSelectedIntegration(null);
  };

  const handleSaveWhatsApp = async (values) => {
    if (!whatsAppId) setAutoToken(generateRandomCode(30));

    const resolvedProvider = whatsAppId
      ? (values.provider || providerPreset || "beta")
      : (values.provider || providerPreset || "beta");
    const resolvedChannel = whatsAppId
      ? (values.channel || channelPreset || "whatsapp")
      : (channelPreset || values.channel || "whatsapp");
    const isOfficialChannel = String(resolvedChannel || "").toLowerCase() === "whatsapp_oficial";

    if (NPSEnabled) {

      if (isNil(values.ratingMessage)) {
        toastError(i18n.t("whatsappModal.errorRatingMessage"));
        return;
      }

      if (values.expiresTicketNPS === '0' || values.expiresTicketNPS === '' || values.expiresTicketNPS === 0) {
        toastError(i18n.t("whatsappModal.errorExpiresNPS"));
        return;
      }
    }

    if (values.timeSendQueue === '') values.timeSendQueue = '0'

    if ((values.sendIdQueue === 0 || values.sendIdQueue === '' || isNil(values.sendIdQueue)) && (values.timeSendQueue !== 0 && values.timeSendQueue !== '0')) {
      toastError(i18n.t("whatsappModal.errorSendQueue"));
      return;
    }

    if (enableImportMessage && !isOfficialChannel) {
      const importStart = moment(importOldMessages, DATE_TIME_LOCAL_FORMAT, true);
      const importEnd = moment(importRecentMessages, DATE_TIME_LOCAL_FORMAT, true);
      const oldestAllowed = moment().add(-MAX_IMPORT_DAYS, "days");

      if (!importStart.isValid() || !importEnd.isValid()) {
        toastError("Datas de importação inválidas.");
        return;
      }

      if (importEnd.isBefore(importStart)) {
        toastError("A data final da importação deve ser maior ou igual à data inicial.");
        return;
      }

      if (importStart.isBefore(oldestAllowed)) {
        toastError(i18n.t("whatsappModal.errorImportOldMessagesLimit", { days: MAX_IMPORT_DAYS }));
        return;
      }

      if (importEnd.diff(importStart, "days", true) > MAX_IMPORT_DAYS) {
        toastError(i18n.t("whatsappModal.errorImportRangeLimit", { days: MAX_IMPORT_DAYS }));
        return;
      }
    }

    const whatsappData = {
      ...values,
      provider: resolvedProvider,
      channel: resolvedChannel,
      flowIdWelcome: flowIdWelcome ? flowIdWelcome : null,
      flowIdNotPhrase: flowIdNotPhrase ? flowIdNotPhrase : null,
      integrationId: selectedIntegration ? selectedIntegration : null,
      queueIds: selectedQueueIds,
      allowGroup: isOfficialChannel ? false : Boolean(values.allowGroup),
      groupAsTicket: isOfficialChannel ? "disabled" : (values.groupAsTicket || "disabled"),
      queueIdImportMessages: (isOfficialChannel || !values.queueIdImportMessages) ? null : values.queueIdImportMessages,
      importOldMessages: (enableImportMessage && !isOfficialChannel) ? toDateTimeISO(importOldMessages) : null,
      importRecentMessages: (enableImportMessage && !isOfficialChannel) ? toDateTimeISO(importRecentMessages) : null,
      importOldMessagesGroups: (enableImportMessage && !isOfficialChannel && importOldMessagesGroups) ? importOldMessagesGroups : null,
      closedTicketsPostImported: (enableImportMessage && !isOfficialChannel && closedTicketsPostImported) ? closedTicketsPostImported : null,
      token: autoToken ? autoToken : null, schedules: schedulesRef.current,
      promptId: selectedPrompt ? selectedPrompt : null
    };

    console.dir(whatsappData)

    delete whatsappData["queues"];
    delete whatsappData["session"];

    try {
      if (whatsAppId) {
        if (whatsAppId && enableImportMessage && !isOfficialChannel && whatsApp?.status === "CONNECTED") {
          try {
            setWhatsApp({ ...whatsApp, status: "qrcode" });
            await api.delete(`/whatsappsession/${whatsApp.id}`);
          } catch (err) {
            toastError(err);
          }
        }

        await api.put(`/whatsapp/${whatsAppId}`, whatsappData);
        if (attachment != null) {
          const formData = new FormData();
          formData.append("file", attachment);
          await api.post(`/whatsapp/${whatsAppId}/media-upload`, formData);
        }
        if (!attachmentName && (whatsApp.greetingMediaAttachment !== null)) {
          await api.delete(`/whatsapp/${whatsAppId}/media-upload`);
        }
      } else {
        const { data } = await api.post("/whatsapp", whatsappData);
        if (attachment != null) {
          const formData = new FormData();
          formData.append("file", attachment);
          await api.post(`/whatsapp/${data.id}/media-upload`, formData);
        }
      }
      toast.success(i18n.t("whatsappModal.success"));

      handleClose();
    } catch (err) {
      toastError(err);
    }

  };

  function generateRandomCode(length) {
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyvz0123456789";
    let code = "";

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      code += charset.charAt(randomIndex);
    }
    return code;
  }

  const handleRefreshToken = () => {
    setAutoToken(generateRandomCode(30));
  }

  const handleCopyToken = () => {
    navigator.clipboard.writeText(autoToken);
    setCopied(true);
  };

  const handleCopyCallback = (value) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCallbackCopied(true);
  };

  const handleClose = () => {
    onClose();
    setWhatsApp(initialState);
    setEnableImportMessage(false);
    setImportOldMessagesGroups(false);
    setClosedTicketsPostImported(false);
    setAttachment(null)
    setAttachmentName("")
    setCopied(false);
    setCallbackCopied(false);
    setOfficialTemplates([]);
    setOfficialTemplatesLoading(false);
    setOfficialTemplatesSyncing(false);
    setOfficialTemplateSendingId(null);
    setOfficialTemplatesLastSyncAt(null);
    setTestingConnection(false);
    setTestConnectionResult(null);
    setRegisteringNumber(false);
    setRegisterNumberResult(null);
  };

  const handleTestOfficialConnection = async () => {
    if (!whatsAppId) {
      toast.warning("Salve a conexão antes de testar a integração.");
      return;
    }

    try {
      setTestingConnection(true);
      setTestConnectionResult(null);
      const { data } = await api.post(`/whatsapp/${whatsAppId}/test-connection`);
      setTestConnectionResult(data);
    } catch (err) {
      toastError(err);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleRegisterOfficialNumber = async () => {
    if (!whatsAppId) {
      toast.warning("Salve a conexão antes de registrar o número.");
      return;
    }

    try {
      setRegisteringNumber(true);
      setRegisterNumberResult(null);
      const { data } = await api.post(`/whatsapp/${whatsAppId}/register-number`);
      setRegisterNumberResult(data);
    } catch (err) {
      toastError(err);
    } finally {
      setRegisteringNumber(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  const loadOfficialTemplates = async (connectionId) => {
    if (!connectionId) return;

    try {
      setOfficialTemplatesLoading(true);
      const { data } = await api.get(`/whatsapp/${connectionId}/templates`);
      const templates = Array.isArray(data?.templates) ? data.templates : [];
      setOfficialTemplates(templates);

      const sortedBySync = [...templates]
        .filter(item => item?.lastSyncedAt)
        .sort((a, b) => new Date(b.lastSyncedAt).getTime() - new Date(a.lastSyncedAt).getTime());
      setOfficialTemplatesLastSyncAt(sortedBySync[0]?.lastSyncedAt || null);
    } catch (err) {
      toastError(err);
    } finally {
      setOfficialTemplatesLoading(false);
    }
  };

  const handleSyncOfficialTemplates = async () => {
    if (!whatsAppId) {
      toast.warning("Salve a conexão antes de sincronizar templates.");
      return;
    }

    try {
      setOfficialTemplatesSyncing(true);
      const { data } = await api.post(`/whatsapp/${whatsAppId}/templates/sync`);
      toast.success(`Sincronização concluída. Templates processados: ${Number(data?.synced || 0)}.`);
      await loadOfficialTemplates(whatsAppId);
    } catch (err) {
      toastError(err);
    } finally {
      setOfficialTemplatesSyncing(false);
    }
  };

  const handleSendOfficialTemplateTest = async (template) => {
    if (!template?.templateIdMeta) return;
    if (!whatsAppId) {
      toast.warning("Salve a conexão antes de enviar template.");
      return;
    }

    const ticketIdRaw = window.prompt("ID do ticket (canal oficial) para envio do template:");
    if (!ticketIdRaw) return;

    const ticketId = Number(ticketIdRaw);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      toast.error("Ticket inválido.");
      return;
    }

    const variablesRaw = window.prompt(
      "Variáveis do body (opcional). Separe por | \nExemplo: João|12345"
    );
    const bodyVariables = String(variablesRaw || "")
      .split("|")
      .map(value => value.trim())
      .filter(Boolean);

    try {
      setOfficialTemplateSendingId(template.id);
      await api.post(`/messages/template/${ticketId}`, {
        templateIdMeta: template.templateIdMeta,
        languageCode: template.language,
        bodyVariables
      });
      toast.success("Template enviado com sucesso.");
    } catch (err) {
      toastError(err);
    } finally {
      setOfficialTemplateSendingId(null);
    }
  };

  useEffect(() => {
    const isOfficialChannel = String(whatsApp?.channel || "").toLowerCase() === "whatsapp_oficial";
    if (!open || tab !== "officialTemplates" || !isOfficialChannel || !whatsAppId) return;
    loadOfficialTemplates(whatsAppId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, whatsAppId, whatsApp?.channel]);

  const handleFileUpload = () => {
    const file = inputFileRef.current.files[0];
    setAttachment(file)
    setAttachmentName(file.name)
    inputFileRef.current.value = null
  };

  const handleDeleFile = () => {
    setAttachment(null)
    setAttachmentName(null)
  }

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        fullScreen={fullScreenModal}
        scroll="paper"
        classes={{ paper: classes.dialogPaper }}
      >
        <div className={classes.modalHeader}>
          <div className={classes.modalHeaderIcon}>
            <SettingsInputAntennaIcon />
          </div>
          <div className={classes.modalHeaderTexts}>
            <Typography className={classes.modalHeaderTitle}>
              {whatsAppId
                ? i18n.t("whatsappModal.title.edit")
                : i18n.t("whatsappModal.title.add")}
            </Typography>
            <Typography className={classes.modalHeaderSubtitle}>
              Configure a conexão, mensagens automáticas e integrações
            </Typography>
          </div>
          <IconButton
            size="small"
            className={classes.modalCloseBtn}
            onClick={handleClose}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
        <Formik
          initialValues={whatsApp}
          enableReinitialize={true}
          validationSchema={SessionSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveWhatsApp(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ values, touched, errors, isSubmitting, setFieldValue }) => {
            const isOfficialChannel = String(values.channel || "").toLowerCase() === "whatsapp_oficial";
            return (
            <Form>
              <Paper className={classes.mainPaper} elevation={0}>
                <Tabs
                  value={tab}
                  scrollButtons="on"
                  variant="scrollable"
                  onChange={handleTabChange}
                  className={classes.tab}
                >
                  <Tab
                    classes={{ root: classes.tabRoot, selected: classes.tabSelected }}
                    label={
                      <span className={classes.tabIcon}>
                        <TuneOutlinedIcon />{i18n.t("whatsappModal.tabs.general")}
                      </span>
                    }
                    value={"general"}
                  />
                  <Tab
                    classes={{ root: classes.tabRoot, selected: classes.tabSelected }}
                    label={
                      <span className={classes.tabIcon}>
                        <ExtensionOutlinedIcon />{i18n.t("whatsappModal.tabs.integrations")}
                      </span>
                    }
                    value={"integrations"}
                  />
                  <Tab
                    classes={{ root: classes.tabRoot, selected: classes.tabSelected }}
                    label={
                      <span className={classes.tabIcon}>
                        <MessageOutlinedIcon />{i18n.t("whatsappModal.tabs.messages")}
                      </span>
                    }
                    value={"messages"}
                  />
                  <Tab
                    classes={{ root: classes.tabRoot, selected: classes.tabSelected }}
                    label={
                      <span className={classes.tabIcon}>
                        <AndroidIcon />Chatbot
                      </span>
                    }
                    value={"chatbot"}
                  />
                  <Tab
                    classes={{ root: classes.tabRoot, selected: classes.tabSelected }}
                    label={
                      <span className={classes.tabIcon}>
                        <StarBorderOutlinedIcon />{i18n.t("whatsappModal.tabs.assessments")}
                      </span>
                    }
                    value={"nps"}
                  />
                  <Tab
                    classes={{ root: classes.tabRoot, selected: classes.tabSelected }}
                    label={
                      <span className={classes.tabIcon}>
                        <AccountTreeOutlinedIcon />Fluxo Padrão
                      </span>
                    }
                    value={"flowbuilder"}
                  />
                  {isOfficialChannel && (
                    <Tab
                      classes={{ root: classes.tabRoot, selected: classes.tabSelected }}
                      label={
                        <span className={classes.tabIcon}>
                          <DescriptionOutlinedIcon />Templates (Meta)
                        </span>
                      }
                      value={"officialTemplates"}
                    />
                  )}
                </Tabs>
              </Paper>
              <Paper className={classes.paper} elevation={0}>
                <TabPanel
                  className={classes.container}
                  value={tab}
                  name={"general"}
                >
                  <DialogContent dividers>
                    {!isOfficialChannel && (
                      <div className={classes.whatsappAlert}>
                        <InfoOutlined className={classes.whatsappAlertIcon} />
                        <div>
                          <div className={classes.whatsappAlertTitle}>Recomendações importantes</div>
                          <ul className={classes.whatsappAlertText}>
                            <li>Antes de conectar seu WhatsApp no sistema, remova a conexão com o WhatsApp Web.</li>
                            <li>Não abrir o WhatsApp Web com o número sincronizado na plataforma. Mantenha somente na plataforma.</li>
                          </ul>
                        </div>
                      </div>
                    )}

                    <div className={classes.section}>
                      <div className={classes.sectionTitle} style={{ marginBottom: 10 }}>
                        Informações da conexão
                      </div>
                      <Grid container spacing={2}>
                        {!isOfficialChannel && !whatsAppId && baileysEnabled && wuzapiEnabled && (
                          <Grid item xs={12} sm={4}>
                            <Field
                              as={TextField}
                              select
                              label="Modo de conexão"
                              name="provider"
                              variant="outlined"
                              margin="dense"
                              fullWidth
                            >
                              <MenuItem value="beta">Baileys</MenuItem>
                              <MenuItem value="wuzapi">wuzAPI</MenuItem>
                            </Field>
                          </Grid>
                        )}
                        <Grid item xs={12} sm={4}>
                          <Field
                            as={TextField}
                            label={i18n.t("whatsappModal.form.name")}
                            autoFocus
                            name="name"
                            error={touched.name && Boolean(errors.name)}
                            helperText={touched.name && errors.name}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={2}>
                          <Field
                            as={TextField}
                            label={i18n.t("whatsappModal.form.color")}
                            name="color"
                            id="color"
                            value={values.color || ""}
                            error={touched.color && Boolean(errors.color)}
                            helperText={touched.color && errors.color}
                            inputProps={{ readOnly: true, style: { cursor: "pointer" } }}
                            onClick={() => setColorPickerModalOpen(true)}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <div
                                    style={{ backgroundColor: values.color || "#25D366", cursor: "pointer" }}
                                    className={classes.colorAdorment}
                                  />
                                </InputAdornment>
                              ),
                              endAdornment: (
                                <InputAdornment position="end">
                                  <IconButton
                                    type="button"
                                    size="small"
                                    color="default"
                                    title={i18n.t("whatsappModal.buttons.clearColor")}
                                    onClick={(e) => { e.stopPropagation(); setFieldValue("color", ""); }}
                                  >
                                    <span style={{ fontSize: 14, lineHeight: 1 }}>✕</span>
                                  </IconButton>
                                  <IconButton
                                    type="button"
                                    size="small"
                                    color="default"
                                    onClick={(e) => { e.stopPropagation(); setColorPickerModalOpen(true); }}
                                  >
                                    <Colorize />
                                  </IconButton>
                                </InputAdornment>
                              ),
                            }}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <Box display="flex" alignItems="center" flexWrap="wrap" style={{ gap: 12, rowGap: 0, height: "100%" }}>
                            <FormControlLabel
                              className={classes.switchFieldLabel}
                              control={
                                <Field
                                  as={Switch}
                                  color="primary"
                                  name="isDefault"
                                  checked={Boolean(values.isDefault)}
                                  disableRipple
                                  classes={{
                                    root: classes.iosSwitchRoot,
                                    switchBase: classes.iosSwitchBase,
                                    thumb: classes.iosSwitchThumb,
                                    track: classes.iosSwitchTrack,
                                  }}
                                />
                              }
                              label={i18n.t("whatsappModal.form.default")}
                            />
                            {!isOfficialChannel && (
                              <FormControlLabel
                                className={classes.switchFieldLabel}
                                control={
                                  <Field
                                    as={Switch}
                                    color="primary"
                                    name="allowGroup"
                                    checked={Boolean(values.allowGroup)}
                                    disableRipple
                                    classes={{
                                      root: classes.iosSwitchRoot,
                                      switchBase: classes.iosSwitchBase,
                                      thumb: classes.iosSwitchThumb,
                                      track: classes.iosSwitchTrack,
                                    }}
                                  />
                                }
                                label={i18n.t("whatsappModal.form.group")}
                              />
                            )}
                          </Box>
                        </Grid>
                        {!isOfficialChannel && (
                          <Grid item xs={12} sm={3}>
                            <FormControl
                              variant="outlined"
                              margin="dense"
                              fullWidth
                              className={classes.formControl}
                            >
                              <InputLabel id="groupAsTicket-selection-label">{i18n.t("whatsappModal.form.groupAsTicket")}</InputLabel>
                              <Field
                                as={Select}
                                label={i18n.t("whatsappModal.form.groupAsTicket")}
                                placeholder={i18n.t("whatsappModal.form.groupAsTicket")}
                                labelId="groupAsTicket-selection-label"
                                id="groupAsTicket"
                                name="groupAsTicket"
                              >
                                <MenuItem value={"disabled"}>{i18n.t("whatsappModal.menuItem.disabled")}</MenuItem>
                                <MenuItem value={"enabled"}>{i18n.t("whatsappModal.menuItem.enabled")}</MenuItem>
                              </Field>
                            </FormControl>
                          </Grid>
                        )}
                      </Grid>
                      <ColorBoxModal
                        open={colorPickerModalOpen}
                        handleClose={() => setColorPickerModalOpen(false)}
                        onChange={(color) => {
                          const hex = typeof color === "string"
                            ? color.replace(/^#/, "")
                            : (color?.hex || "");
                          if (hex) setFieldValue("color", `#${hex}`);
                        }}
                        currentColor={values.color || "#25D366"}
                      />
                    </div>

                    <div className={classes.section}>
                      <div className={classes.sectionTitle} style={{ marginBottom: 10 }}>
                        Mídia de saudação
                      </div>
                      <div className={classes.uploadBox} style={{ marginBottom: 0 }}>
                        <div className={classes.uploadBoxLabel}>
                          <CloudUploadOutlinedIcon color="action" />
                          {attachmentName ? (
                            <span className={classes.uploadBoxFileName}>{attachmentName}</span>
                          ) : (
                            <span>Nenhuma mídia de saudação selecionada</span>
                          )}
                        </div>
                        <Box display="flex" alignItems="center" style={{ gap: 8, flexShrink: 0 }}>
                          {attachmentName && (
                            <IconButton size="small" onClick={handleDeleFile} title="Remover mídia">
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          )}
                          <input
                            type="file"
                            accept="video/*,image/*"
                            ref={inputFileRef}
                            style={{ display: 'none' }}
                            onChange={handleFileUpload}
                          />
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            className={classes.pillButton}
                            onClick={() => inputFileRef.current.click()}
                          >
                            {i18n.t("userModal.buttons.addImage")}
                          </Button>
                        </Box>
                      </div>
                    </div>

                    {!isOfficialChannel && (
                      <div className={classes.section}>
                        <div className={classes.sectionTitle} style={{ marginBottom: 10 }}>
                          {i18n.t("whatsappModal.form.importOldMessagesEnable")}
                        </div>
                        <div className={classes.importMessage} style={{ marginTop: 0, marginBottom: 0, flexDirection: "column", alignItems: "stretch" }}>
                          <div className={classes.multFieldLine} style={{ marginTop: 0 }}>
                            <FormControlLabel
                              className={classes.switchFieldLabel}
                              style={{ marginRight: 7, color: "gray" }}
                              label={i18n.t("whatsappModal.form.importOldMessagesEnable")}
                              labelPlacement="end"
                              control={
                                <Switch
                                  checked={enableImportMessage}
                                  onChange={handleEnableImportMessage}
                                  name="importOldMessagesEnable"
                                  color="primary"
                                  disableRipple
                                  classes={{
                                    root: classes.iosSwitchRoot,
                                    switchBase: classes.iosSwitchBase,
                                    thumb: classes.iosSwitchThumb,
                                    track: classes.iosSwitchTrack,
                                  }}
                                />
                              }
                            />

                            {enableImportMessage ? (
                              <>
                                <FormControlLabel
                                  className={classes.switchFieldLabel}
                                  style={{ marginRight: 7, color: "gray" }}
                                  label={i18n.t(
                                    "whatsappModal.form.importOldMessagesGroups"
                                  )}
                                  labelPlacement="end"
                                  control={
                                    <Switch
                                      checked={importOldMessagesGroups}
                                      onChange={(e) =>
                                        setImportOldMessagesGroups(e.target.checked)
                                      }
                                      name="importOldMessagesGroups"
                                      color="primary"
                                      disableRipple
                                      classes={{
                                        root: classes.iosSwitchRoot,
                                        switchBase: classes.iosSwitchBase,
                                        thumb: classes.iosSwitchThumb,
                                        track: classes.iosSwitchTrack,
                                      }}
                                    />
                                  }
                                />

                                <FormControlLabel
                                  className={classes.switchFieldLabel}
                                  style={{ marginRight: 7, color: "gray" }}
                                  label={i18n.t(
                                    "whatsappModal.form.closedTicketsPostImported"
                                  )}
                                  labelPlacement="end"
                                  control={
                                    <Switch
                                      checked={closedTicketsPostImported}
                                      onChange={(e) =>
                                        setClosedTicketsPostImported(e.target.checked)
                                      }
                                      name="closedTicketsPostImported"
                                      color="primary"
                                      disableRipple
                                      classes={{
                                        root: classes.iosSwitchRoot,
                                        switchBase: classes.iosSwitchBase,
                                        thumb: classes.iosSwitchThumb,
                                        track: classes.iosSwitchTrack,
                                      }}
                                    />
                                  }
                                />
                              </>) : <></>}
                          </div>

                          {enableImportMessage ? (
                            <Grid style={{ marginTop: 16 }} container spacing={2}>
                              <Grid item xs={12} sm={6}>
                                <Field
                                  fullWidth
                                  as={TextField}
                                  label={i18n.t("whatsappModal.form.importOldMessages")}
                                  type="datetime-local"
                                  name="importOldMessages"
                                  inputProps={{
                                    max: moment()
                                      .add(0, "minutes")
                                      .format(DATE_TIME_LOCAL_FORMAT),
                                    min: getImportMinDate(),
                                  }}
                                  InputLabelProps={{
                                    shrink: true,
                                  }}
                                  error={
                                    touched.importOldMessages &&
                                    Boolean(errors.importOldMessages)
                                  }
                                  helperText={
                                    touched.importOldMessages && errors.importOldMessages
                                  }
                                  variant="outlined"
                                  value={toDateTimeLocal(importOldMessages)}
                                  onChange={(e) => {
                                    setImportOldMessages(e.target.value);
                                  }}
                                />
                              </Grid>
                              <Grid item xs={12} sm={6}>
                                <Field
                                  fullWidth
                                  as={TextField}
                                  label={i18n.t("whatsappModal.form.importRecentMessages")}
                                  type="datetime-local"
                                  name="importRecentMessages"
                                  inputProps={{
                                    max: moment()
                                      .add(0, "minutes")
                                      .format(DATE_TIME_LOCAL_FORMAT),
                                    min: toDateTimeLocal(importOldMessages) || moment()
                                      .add(-MAX_IMPORT_DAYS, "days")
                                      .format(DATE_TIME_LOCAL_FORMAT)
                                  }}
                                  InputLabelProps={{
                                    shrink: true,
                                  }}
                                  error={
                                    touched.importRecentMessages &&
                                    Boolean(errors.importRecentMessages)
                                  }
                                  helperText={
                                    touched.importRecentMessages && errors.importRecentMessages
                                  }
                                  variant="outlined"
                                  value={toDateTimeLocal(importRecentMessages)}
                                  onChange={(e) => {
                                    setImportRecentMessages(e.target.value);
                                  }}
                                />
                              </Grid>
                              <Grid xs={12} item>
                                <FormControl
                                  variant="outlined"
                                  margin="dense"
                                  className={classes.FormControl}
                                  fullWidth
                                >
                                  <InputLabel id="queueIdImportMessages-selection-label">
                                    {i18n.t("whatsappModal.form.queueIdImportMessages")}
                                  </InputLabel>
                                  <Field
                                    as={Select}
                                    name="queueIdImportMessages"
                                    id="queueIdImportMessages"
                                    value={values.queueIdImportMessages || '0'}
                                    required={enableImportMessage}
                                    label={i18n.t("whatsappModal.form.queueIdImportMessages")}
                                    placeholder={i18n.t("whatsappModal.form.queueIdImportMessages")}
                                    labelId="queueIdImportMessages-selection-label"
                                  >
                                    <MenuItem value={0}>&nbsp;</MenuItem>
                                    {queues.map(queue => (
                                      <MenuItem key={queue.id} value={queue.id}>
                                        {queue.name}
                                      </MenuItem>
                                    ))}
                                  </Field>
                                </FormControl>
                              </Grid>
                            </Grid>

                          ) : null}
                        </div>
                        {enableImportMessage && (
                          <span style={{ color: "red", display: "block", marginTop: 10 }}>
                            {i18n.t("whatsappModal.form.importAlert")}
                          </span>
                        )}
                      </div>
                    )}

                    {isOfficialChannel && (
                      <div className={classes.section}>
                        <div className={classes.sectionTitle} style={{ marginBottom: 10 }}>
                          Configuração Meta / WABA
                        </div>
                        <Grid container spacing={2}>
                          <Grid xs={12} md={6} item>
                            <Field
                              as={TextField}
                              name="phone_number_id"
                              label="Phone Number ID"
                              variant="outlined"
                              margin="dense"
                              fullWidth
                            />
                          </Grid>
                          <Grid xs={12} md={6} item>
                            <Field
                              as={TextField}
                              name="waba_id"
                              label="WABA ID"
                              variant="outlined"
                              margin="dense"
                              fullWidth
                            />
                          </Grid>
                          <Grid xs={12} md={6} item>
                            <Field
                              as={TextField}
                              name="send_token"
                              label="Send Token"
                              variant="outlined"
                              margin="dense"
                              fullWidth
                            />
                          </Grid>
                          <Grid xs={12} md={6} item>
                            <Field
                              as={TextField}
                              name="business_id"
                              label="Business ID"
                              variant="outlined"
                              margin="dense"
                              fullWidth
                            />
                          </Grid>
                          <Grid xs={12} md={6} item>
                            <Field
                              as={TextField}
                              name="phone_number"
                              label="Phone Number"
                              variant="outlined"
                              margin="dense"
                              fullWidth
                            />
                          </Grid>
                          <Grid xs={12} item>
                            <Box display="flex" alignItems="center">
                              <TextField
                                label="Callback URL (Meta Webhook)"
                                variant="outlined"
                                margin="dense"
                                fullWidth
                                value={values.waba_webhook || ""}
                                placeholder="Salve a conexão para gerar o Callback URL"
                                InputProps={{ readOnly: true }}
                              />
                              <Button
                                onClick={() => handleCopyCallback(values.waba_webhook || "")}
                                className={classes.tokenRefresh}
                                variant="text"
                                startIcon={<FileCopy style={{ color: callbackCopied ? "blue" : "inherit" }} />}
                                disabled={!values.waba_webhook}
                              />
                            </Box>
                            <Typography variant="caption" color="textSecondary">
                              Verify Token para configurar na Meta: <strong>{autoToken || values.token || "-"}</strong>
                            </Typography>
                          </Grid>

                          <Grid xs={12} item>
                            <Box display="flex" alignItems="center" style={{ marginTop: 8 }}>
                              <Button
                                onClick={handleTestOfficialConnection}
                                disabled={testingConnection || !whatsAppId}
                                variant="outlined"
                                color="primary"
                                startIcon={
                                  testingConnection ? (
                                    <CircularProgress size={16} />
                                  ) : (
                                    <SettingsInputAntennaIcon />
                                  )
                                }
                              >
                                {testingConnection ? "Testando integração..." : "Testar Integração com a Meta"}
                              </Button>
                              {!whatsAppId && (
                                <Typography variant="caption" color="textSecondary" style={{ marginLeft: 12 }}>
                                  Salve a conexão para poder testar.
                                </Typography>
                              )}
                            </Box>

                            {testConnectionResult && (
                              <Paper variant="outlined" style={{ padding: 12, marginTop: 8 }}>
                                <Typography
                                  variant="subtitle2"
                                  style={{ color: testConnectionResult.success ? green[700] : "#c62828", marginBottom: 8 }}
                                >
                                  {testConnectionResult.success
                                    ? "Integração com a Meta funcionando corretamente."
                                    : "Foram encontrados problemas na integração com a Meta."}
                                </Typography>
                                {(testConnectionResult.checks || []).map((item, index) => (
                                  <Box key={index} display="flex" alignItems="flex-start" style={{ marginBottom: 8 }}>
                                    {item.status === "ok" ? (
                                      <CheckCircleOutlineIcon style={{ color: green[700], marginRight: 8, marginTop: 2 }} fontSize="small" />
                                    ) : (
                                      <HighlightOffIcon style={{ color: "#c62828", marginRight: 8, marginTop: 2 }} fontSize="small" />
                                    )}
                                    <Box>
                                      <Typography variant="body2">
                                        <strong>{item.check}:</strong> {item.message}
                                      </Typography>
                                      {item.howToFix && (
                                        <Typography variant="caption" color="textSecondary">
                                          Como resolver: {item.howToFix}
                                        </Typography>
                                      )}
                                    </Box>
                                  </Box>
                                ))}
                              </Paper>
                            )}
                          </Grid>

                          <Grid xs={12} item>
                            <Box display="flex" alignItems="center" style={{ marginTop: 8 }}>
                              <Button
                                onClick={handleRegisterOfficialNumber}
                                disabled={registeringNumber || !whatsAppId}
                                variant="outlined"
                                color="primary"
                                startIcon={
                                  registeringNumber ? (
                                    <CircularProgress size={16} />
                                  ) : (
                                    <SettingsInputAntennaIcon />
                                  )
                                }
                              >
                                {registeringNumber ? "Registrando número..." : "Registrar Número na Meta"}
                              </Button>
                              {!whatsAppId && (
                                <Typography variant="caption" color="textSecondary" style={{ marginLeft: 12 }}>
                                  Salve a conexão para poder registrar.
                                </Typography>
                              )}
                            </Box>
                            <Typography variant="caption" style={{ color: "#c62828" }}>
                              Atenção: utilize esta opção apenas se o número ainda não foi registrado na Meta. Não use em números que já estão conectados e funcionando normalmente.
                            </Typography>

                            {registerNumberResult && (
                              <Paper variant="outlined" style={{ padding: 12, marginTop: 8 }}>
                                <Typography
                                  variant="subtitle2"
                                  style={{ color: registerNumberResult.success ? green[700] : "#c62828", marginBottom: 8 }}
                                >
                                  {registerNumberResult.success
                                    ? "Número registrado com sucesso na Meta."
                                    : "Não foi possível registrar o número na Meta."}
                                </Typography>
                                <Box display="flex" alignItems="flex-start" style={{ marginBottom: 8 }}>
                                  {registerNumberResult.success ? (
                                    <CheckCircleOutlineIcon style={{ color: green[700], marginRight: 8, marginTop: 2 }} fontSize="small" />
                                  ) : (
                                    <HighlightOffIcon style={{ color: "#c62828", marginRight: 8, marginTop: 2 }} fontSize="small" />
                                  )}
                                  <Box>
                                    <Typography variant="body2">{registerNumberResult.message}</Typography>
                                    {registerNumberResult.howToFix && (
                                      <Typography variant="caption" color="textSecondary">
                                        Como resolver: {registerNumberResult.howToFix}
                                      </Typography>
                                    )}
                                    {registerNumberResult.pin && (
                                      <Typography variant="caption" color="textSecondary" component="div">
                                        PIN utilizado: <strong>{registerNumberResult.pin}</strong>
                                      </Typography>
                                    )}
                                  </Box>
                                </Box>
                              </Paper>
                            )}
                          </Grid>
                        </Grid>
                      </div>
                    )}

                    <div className={classes.section}>
                      <div className={classes.sectionTitle} style={{ marginBottom: 10 }}>
                        {i18n.t("whatsappModal.form.token")}
                      </div>
                      <Box display="flex" alignItems="center">
                        <Grid xs={12} item>
                          <Field
                            as={TextField}
                            label={i18n.t("whatsappModal.form.token")}
                            type="token"
                            fullWidth
                            value={autoToken}
                            variant="outlined"
                            margin="dense"
                            disabled
                          />
                        </Grid>
                        <Button
                          onClick={handleRefreshToken}
                          disabled={isSubmitting}
                          className={classes.tokenRefresh}
                          variant="text"
                          startIcon={<Autorenew style={{ marginLeft: 5, color: "green" }} />}
                        />
                        <Button
                          onClick={handleCopyToken}
                          className={classes.tokenRefresh}
                          variant="text"
                          startIcon={<FileCopy style={{ color: copied ? "blue" : "inherit" }} />}
                        />
                      </Box>
                    </div>

                    {!isOfficialChannel && (
                      <div className={classes.section}>
                        <div className={classes.sectionTitle} style={{ marginBottom: 10 }}>
                          Proxy
                        </div>
                        <FormControlLabel
                          className={classes.switchFieldLabel}
                          control={
                            <Switch
                              checked={proxyEnabled}
                              onChange={(e) => {
                                setProxyEnabled(e.target.checked);
                                if (!e.target.checked) {
                                  setFieldValue("proxyUrl", "");
                                }
                              }}
                              color="primary"
                              disableRipple
                              classes={{
                                root: classes.iosSwitchRoot,
                                switchBase: classes.iosSwitchBase,
                                thumb: classes.iosSwitchThumb,
                                track: classes.iosSwitchTrack,
                              }}
                            />
                          }
                          label="Usar Proxy SOCKS5"
                        />
                        {proxyEnabled && (
                          <>
                            <Field
                              as={TextField}
                              label="URL do Proxy"
                              name="proxyUrl"
                              placeholder="socks5://usuario:senha@ip:porta"
                              variant="outlined"
                              margin="dense"
                              fullWidth
                            />
                            <div className={classes.proxyInfoBox}>
                              <ul className={classes.proxyInfoText}>
                                <li>⚠️ É necessário reiniciar a conexão para aplicar as configurações de proxy</li>
                                <li>🔒 Se o proxy configurado for inválido, o mesmo será desativado automaticamente</li>
                                <li>🔄 Em caso de erro de conexão, o proxy será removido e a conexão tentará conectar sem proxy</li>
                              </ul>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <div className={classes.section} style={{ marginBottom: 0 }}>
                      <div className={classes.sectionTitle}>{i18n.t("whatsappModal.form.queueRedirection")}</div>
                      <div className={classes.sectionSubtitle}>{i18n.t("whatsappModal.form.queueRedirectionDesc")}</div>
                      <Grid spacing={2} container>

                        <Grid xs={12} sm={6} item>
                          <FormControl
                            variant="outlined"
                            margin="dense"
                            className={classes.FormControl}
                            fullWidth
                          >
                            <InputLabel id="sendIdQueue-selection-label">
                              {i18n.t("whatsappModal.form.sendIdQueue")}
                            </InputLabel>
                            <Field
                              as={Select}
                              name="sendIdQueue"
                              id="sendIdQueue"
                              value={values.sendIdQueue || '0'}
                              required={values.timeSendQueue > 0}
                              label={i18n.t("whatsappModal.form.sendIdQueue")}
                              placeholder={i18n.t("whatsappModal.form.sendIdQueue")}
                              labelId="sendIdQueue-selection-label"
                            >
                              <MenuItem value={0}>&nbsp;</MenuItem>
                              {queues.map(queue => (
                                <MenuItem key={queue.id} value={queue.id}>
                                  {queue.name}
                                </MenuItem>
                              ))}
                            </Field>
                          </FormControl>

                        </Grid>

                        <Grid xs={12} sm={6} item>
                          <Field
                            as={TextField}
                            label={i18n.t("whatsappModal.form.timeSendQueue")}
                            fullWidth
                            name="timeSendQueue"
                            variant="outlined"
                            margin="dense"
                            error={touched.timeSendQueue && Boolean(errors.timeSendQueue)}
                            helperText={touched.timeSendQueue && errors.timeSendQueue}
                          />
                        </Grid>

                      </Grid>
                    </div>
                  </DialogContent>
                </TabPanel>
                {/* INTEGRAÇÃO */}
                <TabPanel
                  className={classes.container}
                  value={tab}
                  name={"integrations"}
                >
                  <DialogContent dividers>
                    {/* FILAS */}
                    <QueueSelect
                      selectedQueueIds={selectedQueueIds}
                      onChange={(selectedIds) => handleChangeQueue(selectedIds)}
                    />
                    {showIntegrations && (
                      <FormControl
                        variant="outlined"
                        margin="dense"
                        className={classes.FormControl}
                        fullWidth
                      >
                        <InputLabel id="integrationId-selection-label">
                          {i18n.t("queueModal.form.integrationId")}
                        </InputLabel>
                        <Select
                          label={i18n.t("queueModal.form.integrationId")}
                          name="integrationId"
                          value={selectedIntegration || ""}
                          onChange={handleChangeIntegration}
                          id="integrationId"
                          variant="outlined"
                          margin="dense"
                          placeholder={i18n.t("queueModal.form.integrationId")}
                          labelId="integrationId-selection-label"                        >
                          <MenuItem value={null} >{"Desabilitado"}</MenuItem>
                          {integrations.map((integration) => (
                            <MenuItem key={integration.id} value={integration.id}>
                              {integration.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                    {showOpenAi && (
                      <FormControl
                        margin="dense"
                        variant="outlined"
                        fullWidth
                      >
                        <InputLabel>
                          {i18n.t("whatsappModal.form.prompt")}
                        </InputLabel>
                        <Select
                          labelId="dialog-select-prompt-label"
                          id="dialog-select-prompt"
                          name="promptId"
                          value={selectedPrompt || ""}
                          onChange={handleChangePrompt}
                          label={i18n.t("whatsappModal.form.prompt")}
                          fullWidth
                          MenuProps={{
                            anchorOrigin: {
                              vertical: "bottom",
                              horizontal: "left",
                            },
                            transformOrigin: {
                              vertical: "top",
                              horizontal: "left",
                            },
                            getContentAnchorEl: null,
                          }}
                        >
                          <MenuItem value={null}>
                            Desabilitado
                          </MenuItem>
                          {prompts.map((prompt) => (
                            <MenuItem
                              key={prompt.id}
                              value={prompt.id}
                            >
                              {prompt.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  </DialogContent>
                </TabPanel>
                <TabPanel
                  className={classes.container}
                  value={tab}
                  name={"messages"}
                >
                  <DialogContent dividers>
                    {/* MENSAGEM DE SAUDAÇÃO */}
                    <Grid container spacing={1}>
                      <Grid item xs={12} md={12} xl={12}>
                        <Field
                          as={TextField}
                          label={i18n.t("whatsappModal.form.greetingMessage")}
                          type="greetingMessage"
                          multiline
                          minRows={4}
                          fullWidth
                          name="greetingMessage"
                          error={
                            touched.greetingMessage && Boolean(errors.greetingMessage)
                          }
                          helperText={
                            touched.greetingMessage && errors.greetingMessage
                          }
                          variant="outlined"
                          margin="dense"
                        />
                      </Grid>

                      {/* MENSAGEM DE CONCLUSÃO */}
                      <Grid item xs={12} md={12} xl={12}>
                        <Field
                          as={TextField}
                          label={i18n.t("whatsappModal.form.complationMessage")}
                          multiline
                          minRows={4}
                          fullWidth
                          name="complationMessage"
                          error={
                            touched.complationMessage &&
                            Boolean(errors.complationMessage)
                          }
                          helperText={
                            touched.complationMessage && errors.complationMessage
                          }
                          variant="outlined"
                          margin="dense"
                        />
                      </Grid>

                      {/* MENSAGEM DE FÉRIAS COLETIVAS */}
                      <Grid item xs={12} md={12} xl={12}>
                        <Field
                          as={TextField}
                          label={i18n.t("whatsappModal.form.collectiveVacationMessage")}
                          multiline
                          minRows={4}
                          fullWidth
                          name="collectiveVacationMessage"
                          error={touched.collectiveVacationMessage && Boolean(errors.collectiveVacationMessage)}
                          helperText={touched.collectiveVacationMessage && errors.collectiveVacationMessage}
                          variant="outlined"
                          margin="dense"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <Field
                          fullWidth
                          as={TextField}
                          label={i18n.t("whatsappModal.form.collectiveVacationStart")}
                          type="date"
                          name="collectiveVacationStart"
                          required={values.collectiveVacationMessage?.length > 0}
                          inputProps={{
                            min: moment()
                              .add(-10, "days")
                              .format("YYYY-MM-DD"),
                          }}
                          InputLabelProps={{
                            shrink: true,
                          }}
                          error={
                            touched.collectiveVacationStart &&
                            Boolean(errors.collectiveVacationStart)
                          }
                          helperText={
                            touched.collectiveVacationStart && errors.collectiveVacationStart
                          }
                          variant="outlined"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <Field
                          fullWidth
                          as={TextField}
                          label={i18n.t("whatsappModal.form.collectiveVacationEnd")}
                          type="date"
                          name="collectiveVacationEnd"
                          required={values.collectiveVacationMessage?.length > 0}
                          inputProps={{
                            min: moment()
                              .add(-10, "days")
                              .format("YYYY-MM-DD")
                          }}
                          InputLabelProps={{
                            shrink: true,
                          }}
                          error={
                            touched.collectiveVacationEnd &&
                            Boolean(errors.collectiveVacationEnd)
                          }
                          helperText={
                            touched.collectiveVacationEnd && errors.collectiveVacationEnd
                          }
                          variant="outlined"
                        />
                      </Grid>
                    </Grid>
                  </DialogContent>
                </TabPanel>

                <TabPanel
                  className={classes.container}
                  value={tab}
                  name={"chatbot"}
                >
                  <DialogContent dividers>
                    <Grid spacing={2} container>
                      {/* TEMPO PARA CRIAR NOVO TICKET */}
                      <Grid xs={6} md={4} item>
                        <Field
                          as={TextField}
                          label={i18n.t("whatsappModal.form.timeCreateNewTicket")}
                          fullWidth
                          name="timeCreateNewTicket"
                          variant="outlined"
                          margin="dense"
                          error={touched.timeCreateNewTicket && Boolean(errors.timeCreateNewTicket)}
                          helperText={(touched.timeCreateNewTicket && errors.timeCreateNewTicket) || i18n.t("whatsappModal.form.chatbotHelpTimeCreateNewTicket")}
                        />
                      </Grid>

                      {/* QUANTIDADE MÁXIMA DE VEZES QUE O CHATBOT VAI SER ENVIADO */}
                      <Grid xs={6} md={4} item>
                        <Field
                          as={TextField}
                          label={i18n.t("whatsappModal.form.maxUseBotQueues")}
                          fullWidth
                          name="maxUseBotQueues"
                          variant="outlined"
                          margin="dense"
                          error={touched.maxUseBotQueues && Boolean(errors.maxUseBotQueues)}
                          helperText={(touched.maxUseBotQueues && errors.maxUseBotQueues) || i18n.t("whatsappModal.form.chatbotHelpMaxUseBotQueues")}
                        />
                      </Grid>
                      {/* TEMPO PARA ENVIO DO CHATBOT */}
                      <Grid xs={6} md={4} item>
                        <Field
                          as={TextField}
                          label={i18n.t("whatsappModal.form.timeUseBotQueues")}
                          fullWidth
                          name="timeUseBotQueues"
                          variant="outlined"
                          margin="dense"
                          error={touched.timeUseBotQueues && Boolean(errors.timeUseBotQueues)}
                          helperText={(touched.timeUseBotQueues && errors.timeUseBotQueues) || i18n.t("whatsappModal.form.chatbotHelpTimeUseBotQueues")}
                        />
                      </Grid>
                    </Grid>
                    <Grid spacing={2} container>
                      {/* ENCERRAR CHATS ABERTOS APÓS X HORAS */}
                      <Grid xs={6} md={6} item>
                        <Field
                          as={TextField}
                          label={i18n.t("whatsappModal.form.expiresTicket")}
                          fullWidth
                          name="expiresTicket"
                          required={values.timeInactiveMessage > 0}
                          variant="outlined"
                          margin="dense"
                          error={touched.expiresTicket && Boolean(errors.expiresTicket)}
                          helperText={(touched.expiresTicket && errors.expiresTicket) || i18n.t("whatsappModal.form.chatbotHelpExpiresTicket")}
                        />
                      </Grid>
                      {/* TEMPO PARA ENVIO DO CHATBOT */}
                      <Grid xs={6} md={6} item>
                        <FormControl
                          variant="outlined"
                          margin="dense"
                          fullWidth
                          className={classes.formControl}
                        >
                          <InputLabel id="whenExpiresTicket-selection-label">
                            {i18n.t("whatsappModal.form.whenExpiresTicket")}
                          </InputLabel>
                          <Field
                            as={Select}
                            label={i18n.t("whatsappModal.form.whenExpiresTicket")}
                            placeholder={i18n.t(
                              "whatsappModal.form.whenExpiresTicket"
                            )}
                            labelId="whenExpiresTicket-selection-label"
                            id="whenExpiresTicket"
                            name="whenExpiresTicket"
                          >
                            <MenuItem value={"0"}>{i18n.t("whatsappModal.form.closeLastMessageOptions1")}</MenuItem>
                            <MenuItem value={"1"}>{i18n.t("whatsappModal.form.closeLastMessageOptions2")}</MenuItem>
                          </Field>
                          <FormHelperText>{i18n.t("whatsappModal.form.chatbotHelpWhenExpiresTicket")}</FormHelperText>
                        </FormControl>
                      </Grid>
                    </Grid>
                    {/* MENSAGEM POR INATIVIDADE*/}
                    <div>
                      <Field
                        as={TextField}
                        label={i18n.t("whatsappModal.form.expiresInactiveMessage")}
                        multiline
                        minRows={4}
                        fullWidth
                        name="expiresInactiveMessage"
                        error={touched.expiresInactiveMessage && Boolean(errors.expiresInactiveMessage)}
                        helperText={(touched.expiresInactiveMessage && errors.expiresInactiveMessage) || i18n.t("whatsappModal.form.chatbotHelpExpiresInactiveMessage")}
                        variant="outlined"
                        margin="dense"
                      />
                    </div>

                    {/* TEMPO PARA ENVIO DE MENSAGEM POR INATIVIDADE */}
                    <Field
                      as={TextField}
                      label={i18n.t("whatsappModal.form.timeInactiveMessage")}
                      fullWidth
                      name="timeInactiveMessage"
                      variant="outlined"
                      margin="dense"
                      error={touched.timeInactiveMessage && Boolean(errors.timeInactiveMessage)}
                      helperText={(touched.timeInactiveMessage && errors.timeInactiveMessage) || i18n.t("whatsappModal.form.chatbotHelpTimeInactiveMessage")}
                    />
                    {/* MENSAGEM POR INATIVIDADE*/}
                    <div>
                      <Field
                        as={TextField}
                        label={i18n.t("whatsappModal.form.inactiveMessage")}
                        multiline
                        minRows={4}
                        fullWidth
                        name="inactiveMessage"
                        error={touched.inactiveMessage && Boolean(errors.inactiveMessage)}
                        helperText={(touched.inactiveMessage && errors.inactiveMessage) || i18n.t("whatsappModal.form.chatbotHelpInactiveMessage")}
                        variant="outlined"
                        margin="dense"
                      />
                    </div>
                  </DialogContent>
                </TabPanel>
                <TabPanel
                  className={classes.container}
                  value={tab}
                  name={"nps"}
                >
                  <DialogContent dividers>
                    {/* MENSAGEM DE AVALIAÇAO*/}
                    <div>
                      <Field
                        as={TextField}
                        label={i18n.t("whatsappModal.form.ratingMessage")}
                        multiline
                        minRows={4}
                        fullWidth
                        name="ratingMessage"
                        error={touched.ratingMessage && Boolean(errors.ratingMessage)}
                        helperText={touched.ratingMessage && errors.ratingMessage}
                        variant="outlined"
                        margin="dense"
                      />
                    </div>
                    <div>
                      <Field
                        as={TextField}
                        label={i18n.t("whatsappModal.form.ratingThanksMessage")}
                        multiline
                        minRows={3}
                        fullWidth
                        name="ratingThanksMessage"
                        error={touched.ratingThanksMessage && Boolean(errors.ratingThanksMessage)}
                        helperText={touched.ratingThanksMessage && errors.ratingThanksMessage}
                        variant="outlined"
                        margin="dense"
                      />
                    </div>
                    {/* QUANTIDADE MÁXIMA DE VEZES QUE O NPS VAI SER ENVIADO */}
                    <div>
                      <Field
                        as={TextField}
                        label={i18n.t("whatsappModal.form.maxUseBotQueuesNPS")}
                        fullWidth
                        name="maxUseBotQueuesNPS"
                        variant="outlined"
                        margin="dense"
                        error={touched.maxUseBotQueuesNPS && Boolean(errors.maxUseBotQueuesNPS)}
                        helperText={touched.maxUseBotQueuesNPS && errors.maxUseBotQueuesNPS}
                      />
                    </div>
                    {/* ENCERRAR CHATS NPS APÓS X Minutos */}
                    <div>
                      <Field
                        as={TextField}
                        label={i18n.t("whatsappModal.form.expiresTicketNPS")}
                        fullWidth
                        name="expiresTicketNPS"
                        variant="outlined"
                        margin="dense"
                        error={touched.expiresTicketNPS && Boolean(errors.expiresTicketNPS)}
                        helperText={touched.expiresTicketNPS && errors.expiresTicketNPS}
                      />
                    </div>
                  </DialogContent>
                </TabPanel>
                {/* Flowbuilder */}
                {showIntegrations && (
                  <>
                    <TabPanel
                      className={classes.container}
                      value={tab}
                      name={"flowbuilder"}
                    >
                      <DialogContent>
                        <h3>Fluxo de boas vindas</h3>
                        <p>Este fluxo é disparado apenas para novos contatos, pessoas que voce não possui em sua lista de contatos e que mandaram uma mensagem
                        </p>
                        <FormControl
                          variant="outlined"
                          margin="dense"
                          className={classes.FormControl}
                          fullWidth
                        >
                          <Select
                            name="flowIdWelcome"
                            value={flowIdWelcome || ""}
                            onChange={handleChangeFlowIdWelcome}
                            id="flowIdWelcome"
                            variant="outlined"
                            margin="dense"
                            labelId="flowIdWelcome-selection-label"                        >
                            <MenuItem value={null} >{"Desabilitado"}</MenuItem>
                            {webhooks.map(webhook => (
                              <MenuItem key={webhook.id} value={webhook.id}>
                                {webhook.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </DialogContent>
                      <DialogContent>
                        <h3>Fluxo de resposta padrão</h3>
                        <p>Resposta Padrão é enviada com qualquer caractere diferente de uma palavra chave. ATENÇÃO! Será disparada se o atendimento ja estiver fechado.

                        </p>
                        <FormControl
                          variant="outlined"
                          margin="dense"
                          className={classes.FormControl}
                          fullWidth
                        >
                          <Select
                            name="flowNotIdPhrase"
                            value={flowIdNotPhrase || ""}
                            onChange={handleChangeFlowIdNotPhrase}
                            id="flowNotIdPhrase"
                            variant="outlined"
                            margin="dense"
                            labelId="flowNotIdPhrase-selection-label"                        >
                            <MenuItem value={null} >{"Desabilitado"}</MenuItem>
                            {webhooks.map(webhook => (
                              <MenuItem key={webhook.id} value={webhook.id}>
                                {webhook.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </DialogContent>
                    </TabPanel>
                  </>
                )}
                <TabPanel
                  className={classes.container}
                  value={tab}
                  name={"officialTemplates"}
                >
                  <DialogContent dividers>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap">
                      <Typography variant="body2" color="textSecondary">
                        {officialTemplatesLastSyncAt
                          ? `Última sincronização: ${moment(officialTemplatesLastSyncAt).format("DD/MM/YYYY HH:mm:ss")}`
                          : "Ainda sem sincronização registrada."}
                      </Typography>
                      <Button
                        color="primary"
                        variant="contained"
                        onClick={handleSyncOfficialTemplates}
                        disabled={officialTemplatesSyncing || !whatsAppId}
                      >
                        {officialTemplatesSyncing ? "Sincronizando..." : "Sincronizar agora"}
                      </Button>
                    </Box>

                    {!whatsAppId && (
                      <Typography variant="body2" color="textSecondary">
                        Salve a conexão primeiro para habilitar a sincronização de templates.
                      </Typography>
                    )}

                    {officialTemplatesLoading ? (
                      <Typography variant="body2" color="textSecondary">Carregando templates...</Typography>
                    ) : (
                      <>
                        {officialTemplates.length === 0 ? (
                          <Typography variant="body2" color="textSecondary">
                            Nenhum template sincronizado para esta conexão.
                          </Typography>
                        ) : (
                          <Grid container spacing={2}>
                            {officialTemplates.map(template => (
                              <Grid item xs={12} key={template.id}>
                                <Paper variant="outlined" style={{ padding: 12 }}>
                                  <Typography variant="subtitle2">
                                    {template.name} ({template.language})
                                  </Typography>
                                  <Typography variant="body2" color="textSecondary">
                                    ID Meta: {template.templateIdMeta}
                                  </Typography>
                                  <Typography variant="body2" color="textSecondary">
                                    Status: {template.status || "-"} | Categoria: {template.category || "-"}
                                  </Typography>
                                  <Box mt={1}>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="primary"
                                      onClick={() => handleSendOfficialTemplateTest(template)}
                                      disabled={officialTemplateSendingId === template.id}
                                    >
                                      {officialTemplateSendingId === template.id ? "Enviando..." : "Enviar teste"}
                                    </Button>
                                  </Box>
                                </Paper>
                              </Grid>
                            ))}
                          </Grid>
                        )}
                      </>
                    )}
                  </DialogContent>
                </TabPanel>
              </Paper>
              <DialogActions className={classes.dialogActions}>
                <Button
                  size="small"
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                  className={classes.pillButton}
                >
                  {i18n.t("whatsappModal.buttons.cancel")}
                </Button>
                <Button
                  size="small"
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                  className={`${classes.btnWrapper} ${classes.pillButton}`}
                >
                  {whatsAppId
                    ? i18n.t("whatsappModal.buttons.okEdit")
                    : i18n.t("whatsappModal.buttons.okAdd")}
                  {isSubmitting && (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
                  )}
                </Button>
              </DialogActions>
            </Form>
            );
          }}
        </Formik>
      </Dialog>
    </div>
  );
};

export default React.memo(WhatsAppModal);
