import React, {
  useState,
  useEffect,
  useMemo,
  useReducer,
  useContext,
  useRef,
} from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Avatar from "@material-ui/core/Avatar";
import {
  Facebook,
  Instagram,
  WhatsApp,
  LocalOfferOutlined,
  MailOutline,
  FiberManualRecord,
  PublicOutlined,
  TrendingUpOutlined,
  PlaceOutlined,
  GroupOutlined,
} from "@material-ui/icons";
import SearchIcon from "@material-ui/icons/Search";

import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Checkbox from "@material-ui/core/Checkbox";
import IconButton from "@material-ui/core/IconButton";
import Chip from "@material-ui/core/Chip";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import BlockIcon from "@material-ui/icons/Block";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import CircularProgress from "@material-ui/core/CircularProgress";

import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Grid from "@material-ui/core/Grid";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import Skeleton from "@material-ui/lab/Skeleton";

import api from "../../services/api";
import ContactModal from "../../components/ContactModal";
import ConfirmationModal from "../../components/ConfirmationModal";

import { i18n } from "../../translate/i18n";
import MainHeader from "../../components/MainHeader";
import toastError from "../../errors/toastError";

import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import NewTicketModal from "../../components/NewTicketModal";
import { TagsFilter } from "../../components/TagsFilter";
import PopupState, { bindTrigger, bindMenu } from "material-ui-popup-state";
import formatSerializedId from "../../utils/formatSerializedId";
import { v4 as uuidv4 } from "uuid";

import { ArrowDropDown, Backup, ContactPhone } from "@material-ui/icons";
import { Menu, MenuItem } from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";

import ContactImportWpModal from "../../components/ContactImportWpModal";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import { TicketsContext } from "../../context/Tickets/TicketsContext";

import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";

// ================= GEO / DDD CONFIG DO MAPA =================

const geoUrl =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

const markers = [
  { markerOffset: -30, name: "Aracaju", coordinates: [-37.0717, -10.9472] },
  { markerOffset: 15, name: "Belém", coordinates: [-48.4878, -1.4558] },
  { markerOffset: 15, name: "Belo Horizonte", coordinates: [-43.9378, -19.8157] },
  { markerOffset: 15, name: "Boa Vista", coordinates: [-60.6739, 2.8195] },
  { markerOffset: 15, name: "Brasília", coordinates: [-47.8825, -15.7942] },
  { markerOffset: 15, name: "Campo Grande", coordinates: [-54.6464, -20.4428] },
  { markerOffset: 15, name: "Cuiabá", coordinates: [-56.0969, -15.6011] },
  { markerOffset: 15, name: "Curitiba", coordinates: [-49.2736, -25.4296] },
  { markerOffset: 15, name: "Florianópolis", coordinates: [-48.5492, -27.5969] },
  { markerOffset: 15, name: "Fortaleza", coordinates: [-38.5267, -3.71839] },
  { markerOffset: 15, name: "Goiânia", coordinates: [-49.2736, -16.6869] },
  { markerOffset: 15, name: "João Pessoa", coordinates: [-34.8631, -7.1195] },
  { markerOffset: 15, name: "Macapá", coordinates: [-51.0667, 0.0333] },
  { markerOffset: 15, name: "Maceió", coordinates: [-35.7353, -9.6658] },
  { markerOffset: 15, name: "Manaus", coordinates: [-60.025, -3.10194] },
  { markerOffset: 15, name: "Natal", coordinates: [-35.2094, -5.795] },
  { markerOffset: 15, name: "Palmas", coordinates: [-48.3347, -10.1844] },
  { markerOffset: 15, name: "Porto Alegre", coordinates: [-51.23, -30.0331] },
  { markerOffset: 15, name: "Porto Velho", coordinates: [-63.9039, -8.7619] },
  { markerOffset: 15, name: "Recife", coordinates: [-34.8811, -8.05389] },
  { markerOffset: 15, name: "Rio Branco", coordinates: [-67.8099, -9.9747] },
  { markerOffset: 15, name: "Rio de Janeiro", coordinates: [-43.1729, -22.9068] },
  { markerOffset: 15, name: "Salvador", coordinates: [-38.4813, -12.9716] },
  { markerOffset: 15, name: "São Luís", coordinates: [-44.3028, -2.5283] },
  { markerOffset: 15, name: "São Paulo", coordinates: [-46.6333, -23.5505] },
  { markerOffset: 15, name: "Teresina", coordinates: [-42.8039, -5.0892] },
  { markerOffset: 15, name: "Vitória", coordinates: [-40.3378, -20.3194] },
];

const dddList = {
  "11": "São Paulo",
  "12": "São Paulo",
  "13": "São Paulo",
  "14": "São Paulo",
  "15": "São Paulo",
  "16": "São Paulo",
  "17": "São Paulo",
  "18": "São Paulo",
  "19": "São Paulo",
  "21": "Rio de Janeiro",
  "22": "Rio de Janeiro",
  "24": "Rio de Janeiro",
  "27": "Espírito Santo",
  "28": "Espírito Santo",
  "31": "Minas Gerais",
  "32": "Minas Gerais",
  "33": "Minas Gerais",
  "34": "Minas Gerais",
  "35": "Minas Gerais",
  "37": "Minas Gerais",
  "38": "Minas Gerais",
  "41": "Paraná",
  "42": "Paraná",
  "43": "Paraná",
  "44": "Paraná",
  "45": "Paraná",
  "46": "Paraná",
  "47": "Santa Catarina",
  "48": "Santa Catarina",
  "49": "Santa Catarina",
  "51": "Rio Grande do Sul",
  "53": "Rio Grande do Sul",
  "54": "Rio Grande do Sul",
  "55": "Rio Grande do Sul",
  "61": "Distrito Federal/Goiás",
  "62": "Goiás",
  "63": "Tocantins",
  "64": "Goiás",
  "65": "Mato Grosso",
  "66": "Mato Grosso",
  "67": "Mato Grosso do Sul",
  "68": "Acre",
  "69": "Rondônia",
  "71": "Bahia",
  "73": "Bahia",
  "74": "Bahia",
  "75": "Bahia",
  "77": "Bahia",
  "79": "Sergipe",
  "81": "Pernambuco",
  "82": "Alagoas",
  "83": "Paraíba",
  "84": "Rio Grande do Norte",
  "85": "Ceará",
  "86": "Piauí",
  "87": "Pernambuco",
  "88": "Ceará",
  "89": "Piauí",
  "91": "Pará",
  "92": "Amazonas",
  "93": "Pará",
  "94": "Pará",
  "95": "Roraima",
  "96": "Amapá",
  "97": "Amazonas",
  "98": "Maranhão",
  "99": "Maranhão",
};

const isExpiredWhatsAppAvatarUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== "pps.whatsapp.net") return false;

    const expirationHex = parsedUrl.searchParams.get("oe");
    if (!expirationHex) return false;

    const expirationEpochSeconds = Number.parseInt(expirationHex, 16);
    if (!Number.isFinite(expirationEpochSeconds)) return false;

    return expirationEpochSeconds <= Math.floor(Date.now() / 1000);
  } catch (error) {
    return false;
  }
};

const isWhatsAppPpsUrl = (url) => {
  try {
    return new URL(url).hostname === "pps.whatsapp.net";
  } catch (error) {
    return false;
  }
};

// ================= REDUCER =================

const reducer = (state, action) => {
  if (action.type === "LOAD_CONTACTS") {
    const contacts = action.payload;
    const newContacts = [];

    contacts.forEach((contact) => {
      const contactIndex = state.findIndex((c) => c.id === contact.id);
      if (contactIndex !== -1) {
        state[contactIndex] = contact;
      } else {
        newContacts.push(contact);
      }
    });

    return [...state, ...newContacts];
  }

  if (action.type === "UPDATE_CONTACTS") {
    const contact = action.payload;
    const contactIndex = state.findIndex((c) => c.id === contact.id);

    if (contactIndex !== -1) {
      state[contactIndex] = contact;
      return [...state];
    } else {
      return [contact, ...state];
    }
  }

  if (action.type === "DELETE_CONTACT") {
    const contactId = action.payload;

    const contactIndex = state.findIndex((c) => c.id === contactId);
    if (contactIndex !== -1) {
      state.splice(contactIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    padding: theme.spacing(2),
    height: "calc(100% - 48px)",
    display: "flex",
    flexDirection: "column",
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
      height: "auto",
    },
  },
  pageHeader: {
    width: "100%",
    marginBottom: theme.spacing(2),
    padding: theme.spacing(2),
    borderRadius: 16,
    color: "#1e2a44",
    background: "#EDF4FF",
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1.5),
    },
  },
  pageHeaderTitle: {
    fontWeight: 600,
    letterSpacing: 0.1,
    fontSize: "1.2rem",
    [theme.breakpoints.down("sm")]: {
      fontSize: "1.05rem",
    },
  },
  pageHeaderSubtitle: {
    marginTop: theme.spacing(0.25),
    color: "rgba(30,42,68,0.78)",
    fontSize: "0.8rem",
    lineHeight: 1.35,
  },
  headerChip: {
    backgroundColor: "#EAF1FF",
    color: "#2f4b7c",
    border: "1px solid #d7e5ff",
    fontWeight: 500,
    fontSize: "0.72rem",
    height: 24,
  },
  controlsPaper: {
    marginBottom: theme.spacing(2),
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.08)",
    padding: theme.spacing(1.25),
    backgroundColor: theme.palette.background.paper,
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(0.85),
      marginBottom: theme.spacing(1.2),
    },
  },
  searchField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 10,
      backgroundColor: theme.palette.background.default,
    },
    "& .MuiInputBase-input": {
      fontSize: "0.82rem",
      paddingTop: 13,
      paddingBottom: 13,
    },
  },
  actionButton: {
    minHeight: 42,
    borderRadius: 10,
    fontWeight: 600,
    fontSize: "0.75rem",
    padding: theme.spacing(0.8, 1.4),
    boxShadow: "0 6px 14px rgba(7, 64, 171, 0.14)",
    [theme.breakpoints.down("sm")]: {
      minHeight: 36,
      fontSize: "0.72rem",
      padding: theme.spacing(0.45, 0.8),
    },
  },
  viewToggleWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(0.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    padding: theme.spacing(0.5),
    backgroundColor: theme.mode === "light" ? "#f8fafc" : theme.palette.background.default,
    width: "100%",
  },
  viewToggleBtn: {
    minWidth: 0,
    flex: 1,
    borderRadius: 9,
    textTransform: "none",
    padding: theme.spacing(0.45, 1),
    fontSize: "0.73rem",
    fontWeight: 700,
    color: theme.palette.text.secondary,
  },
  viewToggleBtnActive: {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.primary.main,
    boxShadow: "0 3px 10px rgba(15, 23, 42, 0.08)",
  },
  contactsTopBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down("sm")]: {
      flexDirection: "column",
      alignItems: "stretch",
    },
  },
  displayLimitField: {
    minWidth: 180,
    [theme.breakpoints.down("sm")]: {
      width: "100%",
      minWidth: 0,
    },
    "& .MuiOutlinedInput-root": {
      borderRadius: 10,
      backgroundColor: theme.mode === "light" ? "#f8fafc" : theme.palette.background.default,
    },
    "& .MuiInputBase-input": {
      fontSize: "0.82rem",
    },
  },
  tabsWrap: {
    marginBottom: theme.spacing(1.5),
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  tabsRoot: {
    minHeight: 40,
    "& .MuiTab-root": {
      minHeight: 40,
      fontSize: "0.78rem",
      fontWeight: 600,
      textTransform: "none",
    },
  },
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "auto",
    ...theme.scrollbarStyles,
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "0 12px 26px rgba(17, 24, 39, 0.09)",
    [theme.breakpoints.down("sm")]: {
      flex: "unset",
      overflowY: "visible",
      padding: theme.spacing(0.5),
      borderRadius: 12,
    },
  },
  // ESTILOS PARA A ABA MAPA
  legendContainer: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    border: `1px solid ${theme.mode === "light" ? "#edf2f7" : theme.palette.divider}`,
    borderRadius: 10,
    padding: theme.spacing(0.9, 1.2),
    backgroundColor: theme.mode === "light" ? "#fafcff" : theme.palette.background.default,
  },
  legendColor: {
    width: "9px",
    height: "9px",
    borderRadius: "50%",
    marginRight: theme.spacing(1),
    backgroundColor: theme.mode === "light" ? "#4f46e5" : theme.palette.primary.main,
    flexShrink: 0,
  },
  legendCard: {
    marginBottom: theme.spacing(2),
    padding: theme.spacing(1),
    borderRadius: 14,
    border: `1px solid ${theme.mode === "light" ? "#e6edf6" : theme.palette.divider}`,
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
    backgroundColor: theme.palette.background.paper,
  },
  legendRowLeft: {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
  },
  legendStateName: {
    fontSize: "0.83rem",
    color: theme.palette.text.primary,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  legendStateCount: {
    fontWeight: 700,
    fontSize: "0.78rem",
    color: theme.mode === "light" ? "#334155" : theme.palette.text.secondary,
    backgroundColor: theme.mode === "light" ? "#eef2ff" : theme.palette.action.hover,
    borderRadius: 999,
    padding: "2px 9px",
  },
  mapTopMetrics: {
    marginBottom: theme.spacing(2),
  },
  mapSection: {
    padding: theme.spacing(3),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1.2),
    },
  },
  metricCard: {
    borderRadius: 14,
    border: `1px solid ${theme.mode === "light" ? "#e6edf6" : theme.palette.divider}`,
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
    backgroundColor: theme.palette.background.paper,
    height: "100%",
  },
  metricCardBody: {
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1.2),
  },
  metricIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.mode === "light" ? "#eef2ff" : theme.palette.action.hover,
    color: theme.mode === "light" ? "#4f46e5" : theme.palette.primary.main,
    flexShrink: 0,
  },
  metricLabel: {
    fontSize: "0.74rem",
    color: theme.palette.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.35,
    fontWeight: 700,
  },
  metricValue: {
    marginTop: 4,
    fontSize: "1.02rem",
    fontWeight: 700,
    color: theme.palette.text.primary,
    lineHeight: 1.25,
  },
  metricSubtle: {
    marginTop: 2,
    fontSize: "0.74rem",
    color: theme.palette.text.secondary,
  },
  mapCard: {
    borderRadius: 14,
    border: `1px solid ${theme.mode === "light" ? "#e6edf6" : theme.palette.divider}`,
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(1.2, 1.2, 0.5),
    height: "100%",
  },
  mapCardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(1),
    padding: theme.spacing(0.3, 0.5, 0.8),
  },
  mapCardTitle: {
    fontSize: "0.84rem",
    fontWeight: 700,
    color: theme.palette.text.primary,
  },
  mapCardSubTitle: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
  },
  mapLegendScale: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: "0.68rem",
    color: theme.palette.text.secondary,
  },
  mapGradientBar: {
    width: 96,
    height: 7,
    borderRadius: 999,
    background: theme.mode === "light"
      ? "linear-gradient(90deg, #eef2ff 0%, #c7d2fe 40%, #818cf8 70%, #4f46e5 100%)"
      : "linear-gradient(90deg, #1f2937 0%, #334155 40%, #4f46e5 75%, #818cf8 100%)",
  },
  mapWrap: {
    borderRadius: 12,
    padding: theme.spacing(1),
    background: theme.mode === "light"
      ? "radial-gradient(circle at 20% 20%, #f8fbff 0%, #f1f5f9 60%, #eef2f7 100%)"
      : theme.palette.background.default,
    border: `1px solid ${theme.mode === "light" ? "#edf2f8" : theme.palette.divider}`,
  },

  // ESTILO DOS CARDS DE CONTATO (MODELO DA SUA PRINT)
  contactCard: {
    backgroundColor: theme.mode === "light" ? "#ffffff" : theme.palette.background.paper,
    border: `1px solid ${theme.mode === "light" ? "#e5edf6" : theme.palette.divider}`,
    borderRadius: 14,
    display: "flex",
    flexDirection: "column",
    height: "100%",
    position: "relative",
    overflow: "hidden",
    boxShadow: "0 6px 14px rgba(15, 23, 42, 0.08)",
    transition: "all 0.25s ease",
    "&:hover": {
      transform: "translateY(-3px)",
      boxShadow: "0 12px 20px rgba(15, 23, 42, 0.14)",
      borderColor: theme.mode === "light" ? "#d8e4f2" : theme.palette.primary.main,
    },
    "& .MuiCardContent-root:last-child": {
      paddingBottom: theme.spacing(1.25),
    },
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: theme.spacing(0.5),
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
  },
  cardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.06)",
    boxShadow: "0 6px 14px rgba(15, 23, 42, 0.12)",
  },
  cardMainInfo: {
    minWidth: 0,
  },
  cardName: {
    color: theme.mode === "light" ? "#0f172a" : theme.palette.text.primary,
    fontWeight: 700,
    fontSize: "0.92rem",
    lineHeight: 1.2,
    marginBottom: theme.spacing(0.55),
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: "0.68rem",
    fontWeight: 700,
    borderRadius: 999,
    padding: "3px 8px",
    textTransform: "uppercase",
    letterSpacing: 0.25,
  },
  statusActive: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  statusInactive: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
  },
  statusDot: {
    fontSize: 8,
  },
  infoList: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(0.6),
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1.2),
  },
  infoItem: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    fontSize: "0.78rem",
    color: theme.palette.text.secondary,
    lineHeight: 1.3,
    wordBreak: "break-word",
  },
  infoIcon: {
    fontSize: 14,
    color: theme.mode === "light" ? "#94a3b8" : theme.palette.text.secondary,
    flexShrink: 0,
  },
  tagBadgesRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  tagBadgesWrap: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.6),
    flexWrap: "wrap",
  },
  tagBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: "0.68rem",
    fontWeight: 700,
    lineHeight: 1.2,
    border: "1px solid transparent",
  },
  cardFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: `1px solid ${theme.mode === "light" ? "#eef3f8" : theme.palette.divider}`,
    paddingTop: theme.spacing(0.9),
    gap: theme.spacing(1),
    [theme.breakpoints.down("sm")]: {
      flexWrap: "wrap",
      justifyContent: "flex-end",
    },
  },
  actionsRight: {
    display: "flex",
    gap: theme.spacing(0.7),
  },
  actionBtnBase: {
    width: 32,
    height: 32,
    borderRadius: 9,
    border: `1px solid ${theme.mode === "light" ? "#e8eef5" : theme.palette.divider}`,
    backgroundColor: theme.mode === "light" ? "#f8fafc" : "transparent",
    color: theme.mode === "light" ? "#7b8ba1" : theme.palette.text.secondary,
    transition: "all 0.2s ease",
    "&:hover": {
      backgroundColor: theme.mode === "light" ? "#f1f5f9" : theme.palette.action.hover,
      color: theme.mode === "light" ? "#5b6b82" : theme.palette.primary.main,
      borderColor: theme.mode === "light" ? "#dbe5f1" : theme.palette.primary.main,
    },
    "&.Mui-disabled": {
      opacity: 0.35,
    },
  },
  actionBtnWhats: {
    backgroundColor: theme.mode === "light" ? "#ecfdf3" : "rgba(34,197,94,0.12)",
    color: theme.mode === "light" ? "#1ea85f" : "#4ade80",
    borderColor: theme.mode === "light" ? "#ccefdc" : "rgba(34,197,94,0.28)",
    "&:hover": {
      backgroundColor: theme.mode === "light" ? "#dff7ea" : "rgba(34,197,94,0.18)",
      color: theme.mode === "light" ? "#188f50" : "#86efac",
      borderColor: theme.mode === "light" ? "#bde6d0" : "rgba(34,197,94,0.4)",
    },
  },
  actionBtnEdit: {
    color: "#5b6b82",
    "&:hover": {
      color: "#43556f",
    },
  },
  actionBtnBlock: {
    color: "#b9822b",
    "&:hover": {
      color: "#946621",
    },
  },
  actionBtnDelete: {
    color: "#d26c6c",
    "&:hover": {
      color: "#b65b5b",
      backgroundColor: "#fff5f5",
      borderColor: "#f4d5d5",
    },
  },
  listContainer: {
    border: `1px solid ${theme.mode === "light" ? "#e5edf6" : theme.palette.divider}`,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: theme.palette.background.paper,
  },
  listHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1.5fr) minmax(180px, 1fr) minmax(180px, 1fr) minmax(220px, 1.2fr) minmax(180px, auto)",
    gap: theme.spacing(1),
    alignItems: "center",
    padding: theme.spacing(1, 1.2),
    backgroundColor: theme.mode === "light" ? "#f8fafc" : theme.palette.background.default,
    borderBottom: `1px solid ${theme.mode === "light" ? "#e5edf6" : theme.palette.divider}`,
    [theme.breakpoints.down("md")]: {
      display: "none",
    },
  },
  listHeaderCell: {
    fontSize: "0.7rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.35,
    color: theme.palette.text.secondary,
  },
  listRow: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1.5fr) minmax(180px, 1fr) minmax(180px, 1fr) minmax(220px, 1.2fr) minmax(180px, auto)",
    gap: theme.spacing(1),
    alignItems: "center",
    padding: theme.spacing(0.9, 1.2),
    borderBottom: `1px solid ${theme.mode === "light" ? "#eef3f8" : theme.palette.divider}`,
    "&:last-child": {
      borderBottom: "none",
    },
    [theme.breakpoints.down("md")]: {
      gridTemplateColumns: "1fr",
      gap: theme.spacing(0.6),
      alignItems: "stretch",
      padding: theme.spacing(1),
    },
  },
  listIdentity: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    minWidth: 0,
  },
  listCell: {
    minWidth: 0,
  },
  listIdentityName: {
    color: theme.mode === "light" ? "#0f172a" : theme.palette.text.primary,
    fontWeight: 700,
    fontSize: "0.84rem",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  listMobileLabel: {
    display: "none",
    [theme.breakpoints.down("md")]: {
      display: "inline-block",
      fontSize: "0.67rem",
      textTransform: "uppercase",
      color: theme.palette.text.secondary,
      fontWeight: 700,
      letterSpacing: 0.3,
      marginRight: theme.spacing(0.6),
    },
  },
  listActionsArea: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.6),
    justifyContent: "flex-end",
    [theme.breakpoints.down("md")]: {
      width: "100%",
      paddingTop: theme.spacing(0.45),
      borderTop: `1px solid ${theme.mode === "light" ? "#eef3f8" : theme.palette.divider}`,
    },
  },
}));

const Contacts = () => {
  const classes = useStyles();
  const history = useHistory();

  const { user, socket } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [contacts, dispatch] = useReducer(reducer, []);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  const [importContactModalOpen, setImportContactModalOpen] = useState(false);
  const [importingContacts, setImportingContacts] = useState(false);
  const [deletingContact, setDeletingContact] = useState(null);
  const [ImportContacts, setImportContacts] = useState(null);

  const [blockingContact, setBlockingContact] = useState(null);
  const [unBlockingContact, setUnBlockingContact] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exportContact, setExportContact] = useState(false);
  const [confirmChatsOpen, setConfirmChatsOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [contactTicket, setContactTicket] = useState({});
  const fileUploadRef = useRef(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const { setCurrentTicket } = useContext(TicketsContext);


  // SELEÇÃO EM MASSA
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [isSelectAllChecked, setIsSelectAllChecked] = useState(false);
  const [confirmDeleteManyOpen, setConfirmDeleteManyOpen] = useState(false);
  const [bulkTagsModalOpen, setBulkTagsModalOpen] = useState(false);
  const [bulkTagOptions, setBulkTagOptions] = useState([]);
  const [bulkSelectedTags, setBulkSelectedTags] = useState([]);
  const [bulkTagAction, setBulkTagAction] = useState("replace");

  const { getAll: getAllSettings } = useCompanySettings();
  const [hideNum, setHideNum] = useState(false);
  const [enableLGPD, setEnableLGPD] = useState(false);
  const [tagColorsById, setTagColorsById] = useState({});
  const [tagColorsByName, setTagColorsByName] = useState({});

  // CONTROLE DE ABAS (CONTATOS / MAPA)
  const [tabValue, setTabValue] = useState(0);
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const visibleContacts = useMemo(() => contacts, [contacts]);

  useEffect(() => {
    async function fetchData() {
      const settingList = await getAllSettings(user.companyId);
      for (const [key, value] of Object.entries(settingList)) {
        if (key === "enableLGPD") setEnableLGPD(value === "enabled");
        if (key === "lgpdHideNumber") setHideNum(value === "enabled");
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadTagColors = async () => {
      try {
        let page = 1;
        let hasMorePages = true;
        const byId = {};
        const byName = {};

        while (hasMorePages && page <= 20) {
          const { data } = await api.get("/tags/", {
            params: { searchParam: "", pageNumber: page, kanban: 0 },
          });

          const tags = Array.isArray(data?.tags) ? data.tags : [];
          tags.forEach((tag) => {
            if (!tag?.color) return;
            if (tag?.id !== undefined && tag?.id !== null) {
              byId[String(tag.id)] = tag.color;
            }
            if (tag?.name) {
              byName[String(tag.name).toLowerCase()] = tag.color;
            }
          });

          hasMorePages = Boolean(data?.hasMore);
          page += 1;
        }

        if (!cancelled) {
          setTagColorsById(byId);
          setTagColorsByName(byName);
        }
      } catch (err) {
        if (!cancelled) {
          setTagColorsById({});
          setTagColorsByName({});
        }
      }
    };

    loadTagColors();

    return () => {
      cancelled = true;
    };
  }, [user.companyId]);

  const handleImportExcel = async () => {
    try {
      const formData = new FormData();
      formData.append("file", fileUploadRef.current.files[0]);
      await api.request({
        url: `/contacts/upload`,
        method: "POST",
        data: formData,
      });
      history.go(0);
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
    setSelectedContactIds([]);
    setIsSelectAllChecked(false);
  }, [searchParam, selectedTags]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get("/contacts/", {
            params: {
              searchParam,
              pageNumber,
              contactTag: JSON.stringify(selectedTags),
            },
          });
          dispatch({ type: "LOAD_CONTACTS", payload: data.contacts });
          setHasMore(data.hasMore);
          setLoading(false);

          const allCurrentContactIds = data.contacts.map((c) => c.id);
          const newSelected = selectedContactIds.filter((id) =>
            allCurrentContactIds.includes(id)
          );
          setSelectedContactIds(newSelected);
          setIsSelectAllChecked(
            newSelected.length === allCurrentContactIds.length &&
              allCurrentContactIds.length > 0
          );
        } catch (err) {
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber, selectedTags]);

  useEffect(() => {
    const companyId = user.companyId;
    const onContactEvent = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_CONTACTS", payload: data.contact });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_CONTACT", payload: +data.contactId });
        setSelectedContactIds((prevSelected) =>
          prevSelected.filter((id) => id !== +data.contactId)
        );
      }
    };
    socket.on(`company-${companyId}-contact`, onContactEvent);

    return () => {
      socket.off(`company-${companyId}-contact`, onContactEvent);
    };
  }, [socket, user.companyId]);

  useEffect(() => {
    if (!visibleContacts.length) {
      setIsSelectAllChecked(false);
      return;
    }
    const allVisibleSelected = visibleContacts.every((contact) =>
      selectedContactIds.includes(contact.id)
    );
    setIsSelectAllChecked(allVisibleSelected);
  }, [visibleContacts, selectedContactIds]);

  const handleSelectTicket = (ticket) => {
    const code = uuidv4();
    const { id, uuid } = ticket;
    setCurrentTicket({ id, uuid, code });
  };

  const handleCloseOrOpenTicket = (ticket) => {
    setNewTicketModalOpen(false);
    if (ticket !== undefined && ticket.uuid !== undefined) {
      handleSelectTicket(ticket);
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  const handleSelectedTags = (selecteds) => {
    const tags = selecteds.map((t) => t.id);
    setSelectedTags(tags);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleOpenContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(true);
  };

  const handleCloseContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(false);
  };

  const hadleEditContact = (contactId) => {
    setSelectedContactId(contactId);
    setContactModalOpen(true);
  };

  const handleDeleteContact = async (contactId) => {
    try {
      await api.delete(`/contacts/${contactId}`);
      toast.success(i18n.t("contacts.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingContact(null);
  };

  const handleToggleSelectContact = (contactId) => (event) => {
    if (event.target.checked) {
      setSelectedContactIds((prevSelected) => [...prevSelected, contactId]);
    } else {
      setSelectedContactIds((prevSelected) =>
        prevSelected.filter((id) => id !== contactId)
      );
      setIsSelectAllChecked(false);
    }
  };

  const handleSelectAllContacts = (event) => {
    const checked = event.target.checked;
    setIsSelectAllChecked(checked);

    if (checked) {
      const allContactIds = visibleContacts.map((contact) => contact.id);
      setSelectedContactIds(allContactIds);
    } else {
      setSelectedContactIds([]);
    }
  };

  const handleDeleteSelectedContacts = async () => {
    try {
      setLoading(true);
      await api.delete("/contacts/batch-delete", {
        data: { contactIds: selectedContactIds },
      });
      toast.success("Contatos selecionados deletados com sucesso!");
      setSelectedContactIds([]);
      setIsSelectAllChecked(false);
      setConfirmDeleteManyOpen(false);
      dispatch({ type: "RESET" });
      setPageNumber(1);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBulkTagsModal = async () => {
    try {
      const { data } = await api.get("/tags/list", { params: { kanban: 0 } });
      setBulkTagOptions(Array.isArray(data) ? data : []);
      setBulkSelectedTags([]);
      setBulkTagAction("replace");
      setBulkTagsModalOpen(true);
    } catch (err) {
      toastError(err);
    }
  };

  const handleApplyBulkTags = async () => {
    try {
      if (!selectedContactIds.length) {
        toast.warning("Selecione pelo menos um contato.");
        return;
      }
      const tagIds = bulkSelectedTags.map((tag) => tag.id);
      if ((bulkTagAction === "add" || bulkTagAction === "remove") && tagIds.length === 0) {
        toast.warning("Selecione pelo menos uma tag para essa ação.");
        return;
      }
      setLoading(true);
      await api.put("/contacts/batch-tags", {
        contactIds: selectedContactIds,
        tagIds,
        action: bulkTagAction
      });
      toast.success("Ação de tags em massa aplicada com sucesso.");
      setBulkTagsModalOpen(false);
      setBulkSelectedTags([]);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockContact = async (contactId) => {
    try {
      await api.put(`/contacts/block/${contactId}`, { active: false });
      dispatch({
        type: "UPDATE_CONTACTS",
        payload: { ...blockingContact, active: false },
      });
      toast.success("Contato bloqueado");
    } catch (err) {
      toastError(err);
    }
    setBlockingContact(null);
  };

  const handleUnBlockContact = async (contactId) => {
    try {
      await api.put(`/contacts/block/${contactId}`, { active: true });
      dispatch({
        type: "UPDATE_CONTACTS",
        payload: { ...unBlockingContact, active: true },
      });
      toast.success("Contato desbloqueado");
    } catch (err) {
      toastError(err);
    }
    setUnBlockingContact(null);
  };

  const handleimportContact = async (whatsappId) => {
    setImportContactModalOpen(false);
    setImportingContacts(true);

    try {
      const { data } = await api.post("/contacts/import", { whatsappId });
      toast.success(
        `Importação concluída. Candidatos: ${data?.candidates || 0} | Novos: ${data?.created || 0} | Atualizados: ${data?.updated || 0} | Pulados: ${data?.skipped || 0}`
      );
      dispatch({ type: "RESET" });
      setPageNumber(1);
      setImportContactModalOpen(false);
    } catch (err) {
      toastError(err);
      setImportContactModalOpen(false);
    } finally {
      setImportingContacts(false);
    }
  };

  const handleimportChats = async () => {
    try {
      await api.post("/contacts/import/chats");
      history.go(0);
    } catch (err) {
      toastError(err);
    }
  };

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

  useEffect(() => {
    const isMobileViewport = () => window.innerWidth <= 960;
    if (!isMobileViewport()) return undefined;

    const onWindowScroll = () => {
      if (!hasMore || loading || tabValue !== 0) return;
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 220;
      if (nearBottom) {
        loadMore();
      }
    };

    window.addEventListener("scroll", onWindowScroll, { passive: true });
    return () => window.removeEventListener("scroll", onWindowScroll);
  }, [hasMore, loading, tabValue]);

  const getContactAvatarSrc = (contact) => {
    const picture = String(contact?.urlPicture || "").trim();
    if (picture) return picture;
    const profilePicUrl = String(contact?.profilePicUrl || "").trim();
    if (!profilePicUrl) return undefined;
    if (isWhatsAppPpsUrl(profilePicUrl)) return undefined;
    if (isExpiredWhatsAppAvatarUrl(profilePicUrl)) return undefined;
    return profilePicUrl;
  };

  const handleImportingDialogClose = (event, reason) => {
    // Mantém o comportamento de não permitir fechar durante importação.
    if (reason === "backdropClick" || reason === "escapeKeyDown") return;
  };
  const getContactDisplayNumber = (contact) => {
    if (enableLGPD && hideNum && user.profile === "user") {
      if (contact.isGroup) return contact.number;
      if (formatSerializedId(contact?.number) === null) {
        return (
          contact.number.slice(0, -6) +
          "**-**" +
          contact?.number.slice(-2)
        );
      }
      return (
        formatSerializedId(contact?.number)?.slice(0, -6) +
        "**-**" +
        contact?.number?.slice(-2)
      );
    }

    if (contact.isGroup) return contact.number;
    return formatSerializedId(contact?.number);
  };

  // ===== FUNÇÃO PARA CONTAR CONTATOS POR ESTADO (USADA NO MAPA) =====
  const countContactsByState = () => {
    const stateCounts = {};

    contacts.forEach((contact) => {
      const number = contact.number;
      if (number && number.length > 4) {
        const ddd = number.substring(2, 4);
        if (dddList[ddd]) {
          const state = dddList[ddd];
          if (!stateCounts[state]) {
            stateCounts[state] = 0;
          }
          stateCounts[state]++;
        } else {
          if (!stateCounts["Outros"]) {
            stateCounts["Outros"] = 0;
          }
          stateCounts["Outros"]++;
        }
      }
    });

    return stateCounts;
  };

  const stateCounts = countContactsByState();
  const stateEntriesSorted = useMemo(
    () =>
      Object.entries(stateCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 27),
    [stateCounts]
  );
  const statesReached = useMemo(
    () =>
      Object.keys(stateCounts).filter(
        (state) => state !== "Outros" && stateCounts[state] > 0
      ).length,
    [stateCounts]
  );
  const topState = useMemo(() => {
    if (!stateEntriesSorted.length) return { name: "-", count: 0 };
    const [name, count] = stateEntriesSorted[0];
    return { name, count };
  }, [stateEntriesSorted]);
  const monthlyGrowth = useMemo(() => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = currentMonthStart;

    const currentMonthCount = contacts.filter((contact) => {
      if (!contact?.createdAt) return false;
      const createdAt = new Date(contact.createdAt);
      return createdAt >= currentMonthStart;
    }).length;

    const previousMonthCount = contacts.filter((contact) => {
      if (!contact?.createdAt) return false;
      const createdAt = new Date(contact.createdAt);
      return createdAt >= previousMonthStart && createdAt < previousMonthEnd;
    }).length;

    if (previousMonthCount === 0) {
      return currentMonthCount > 0 ? 100 : 0;
    }

    return ((currentMonthCount - previousMonthCount) / previousMonthCount) * 100;
  }, [contacts]);
  const stateFillColor = (count) => {
    if (!count) return "#eef2f7";
    const maxCount = Math.max(...Object.values(stateCounts), 1);
    const ratio = count / maxCount;
    if (ratio >= 0.75) return "#4f46e5";
    if (ratio >= 0.5) return "#7c8cff";
    if (ratio >= 0.25) return "#a8b5ff";
    return "#d6deff";
  };
  const getTagTextColor = (bgColor) => {
    if (!bgColor || typeof bgColor !== "string") return "#ffffff";
    const normalized = bgColor.replace("#", "");
    if (normalized.length !== 6) return "#ffffff";
    const r = parseInt(normalized.substring(0, 2), 16);
    const g = parseInt(normalized.substring(2, 4), 16);
    const b = parseInt(normalized.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.62 ? "#1f2937" : "#ffffff";
  };
  const resolveTagColor = (tag) => {
    if (!tag) return "#64748b";
    if (typeof tag === "string") {
      return tagColorsByName[String(tag).toLowerCase()] || "#64748b";
    }

    if (tag.color) return tag.color;

    const idKey =
      tag.id !== undefined && tag.id !== null ? String(tag.id) : null;
    const nameKey = tag.name ? String(tag.name).toLowerCase() : null;

    return (
      (idKey && tagColorsById[idKey]) ||
      (nameKey && tagColorsByName[nameKey]) ||
      "#64748b"
    );
  };

  return (
    <div className={classes.pageRoot}>
      <NewTicketModal
        modalOpen={newTicketModalOpen}
        initialContact={contactTicket}
        onClose={(ticket) => {
          handleCloseOrOpenTicket(ticket);
        }}
      />
      <ContactModal
        open={contactModalOpen}
        onClose={handleCloseContactModal}
        aria-labelledby="form-dialog-title"
        contactId={selectedContactId}
        onSave={(updatedContact) => {
          dispatch({ type: "UPDATE_CONTACTS", payload: updatedContact });
        }}
      ></ContactModal>

      <ConfirmationModal
        title={
          deletingContact
            ? `${i18n.t(
                "contacts.confirmationModal.deleteTitle"
              )} ${deletingContact.name}?`
            : blockingContact
            ? `Bloquear Contato ${blockingContact.name}?`
            : unBlockingContact
            ? `Desbloquear Contato ${unBlockingContact.name}?`
            : ImportContacts
            ? `${i18n.t("contacts.confirmationModal.importTitlte")}`
            : `${i18n.t("contactListItems.confirmationModal.importTitlte")}`
        }
        isCellPhone={ImportContacts}
        open={confirmOpen}
        onClose={setConfirmOpen}
        onConfirm={(e) =>
          deletingContact
            ? handleDeleteContact(deletingContact.id)
            : blockingContact
            ? handleBlockContact(blockingContact.id)
            : unBlockingContact
            ? handleUnBlockContact(unBlockingContact.id)
            : ImportContacts
            ? handleimportContact(e)
            : handleImportExcel()
        }
      >
        {exportContact
          ? `${i18n.t("contacts.confirmationModal.exportContact")}`
          : deletingContact
          ? `${i18n.t("contacts.confirmationModal.deleteMessage")}`
          : blockingContact
          ? `${i18n.t("contacts.confirmationModal.blockContact")}`
          : unBlockingContact
          ? `${i18n.t("contacts.confirmationModal.unblockContact")}`
          : ImportContacts
          ? `Escolha de qual conexão deseja importar`
          : `${i18n.t(
              "contactListItems.confirmationModal.importMessage"
            )}`}
      </ConfirmationModal>

      <Dialog
        open={importingContacts}
        disableEscapeKeyDown
        onClose={handleImportingDialogClose}
      >
        <DialogTitle>Importando contatos</DialogTitle>
        <DialogContent>
          <Box display="flex" alignItems="center" gridGap={12}>
            <CircularProgress size={22} />
            <Typography variant="body2">
              Aguarde, estamos importando os contatos da conexão selecionada...
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        title={`Tem certeza que deseja deletar ${selectedContactIds.length} contatos selecionados?`}
        open={confirmDeleteManyOpen}
        onClose={() => setConfirmDeleteManyOpen(false)}
        onConfirm={handleDeleteSelectedContacts}
      >
        Essa ação é irreversível.
      </ConfirmationModal>

      <Dialog
        open={bulkTagsModalOpen}
        onClose={() => setBulkTagsModalOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Editar tags em massa</DialogTitle>
        <DialogContent>
          <Box mb={2}>
            <Typography variant="body2" color="textSecondary">
              Contatos selecionados: {selectedContactIds.length}
            </Typography>
          </Box>
          <Box mb={2}>
            <TextField
              select
              fullWidth
              variant="outlined"
              label="Ação"
              value={bulkTagAction}
              onChange={(e) => setBulkTagAction(e.target.value)}
            >
              <MenuItem value="replace">Substituir tags</MenuItem>
              <MenuItem value="add">Adicionar tags selecionadas</MenuItem>
              <MenuItem value="remove">Remover tags selecionadas</MenuItem>
            </TextField>
          </Box>
          <Autocomplete
            multiple
            options={bulkTagOptions}
            value={bulkSelectedTags}
            onChange={(event, newValue) => setBulkSelectedTags(newValue)}
            getOptionLabel={(option) => option.name || ""}
            getOptionSelected={(option, value) => option.id === value.id}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  label={option.name}
                  style={{ backgroundColor: option.color || "#64748b", color: "#fff" }}
                  {...getTagProps({ index })}
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                label="Tags"
                placeholder="Selecione as tags"
              />
            )}
          />
          {bulkTagAction === "replace" && (
            <Box mt={1}>
              <Typography variant="caption" color="textSecondary">
                Substituir remove as tags atuais e aplica somente as selecionadas.
              </Typography>
            </Box>
          )}
          {bulkTagAction === "remove" && (
            <Box mt={1}>
              <Typography variant="caption" color="textSecondary">
                Remover retira apenas as tags selecionadas dos contatos marcados.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setBulkTagsModalOpen(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleApplyBulkTags}
            disabled={loading || selectedContactIds.length === 0}
          >
            Aplicar
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationModal
        title={i18n.t("contacts.confirmationModal.importChat")}
        open={confirmChatsOpen}
        onClose={setConfirmChatsOpen}
        onConfirm={(e) => handleimportChats()}
      >
        {i18n.t("contacts.confirmationModal.wantImport")}
      </ConfirmationModal>

      <MainHeader>
        <Grid container style={{ width: "100%" }}>
          <Grid item xs={12}>
            <Paper elevation={0} className={classes.controlsPaper}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={2}>
                  <TagsFilter onFiltered={handleSelectedTags} />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    fullWidth
                    placeholder={i18n.t("contacts.searchPlaceholder")}
                    type="search"
                    value={searchParam}
                    onChange={handleSearch}
                    variant="outlined"
                    className={classes.searchField}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon color="secondary" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={6} sm={6} md={2}>
                  <PopupState variant="popover" popupId="demo-popup-menu">
                    {(popupState) => (
                      <React.Fragment>
                        <Button
                          fullWidth
                          variant="contained"
                          color="primary"
                          className={classes.actionButton}
                          {...bindTrigger(popupState)}
                        >
                          Importar/Exportar
                          <ArrowDropDown />
                        </Button>
                        <Menu {...bindMenu(popupState)}>
                          <MenuItem
                            onClick={() => {
                              setConfirmOpen(true);
                              setImportContacts(true);
                              popupState.close();
                            }}
                          >
                            <ContactPhone
                              fontSize="small"
                              color="primary"
                              style={{
                                marginRight: 10,
                              }}
                            />
                            {i18n.t("contacts.menu.importYourPhone")}
                          </MenuItem>
                          <MenuItem
                            onClick={() => {
                              setImportContactModalOpen(true);
                            }}
                          >
                            <Backup
                              fontSize="small"
                              color="primary"
                              style={{
                                marginRight: 10,
                              }}
                            />
                            {i18n.t("contacts.menu.importToExcel")}
                          </MenuItem>
                        </Menu>
                      </React.Fragment>
                    )}
                  </PopupState>
                </Grid>
                <Grid item xs={6} sm={6} md={2}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleOpenBulkTagsModal}
                    disabled={selectedContactIds.length === 0 || loading}
                    color="primary"
                    className={classes.actionButton}
                  >
                    Tags ({selectedContactIds.length})
                  </Button>
                </Grid>
                <Grid item xs={6} sm={6} md={2}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => setConfirmDeleteManyOpen(true)}
                    disabled={selectedContactIds.length === 0 || loading}
                    color="primary"
                    className={classes.actionButton}
                  >
                    Deletar ({selectedContactIds.length})
                  </Button>
                </Grid>
                <Grid item xs={6} sm={6} md={2}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    onClick={handleOpenContactModal}
                    className={classes.actionButton}
                  >
                    {i18n.t("contacts.buttons.add")}
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </MainHeader>

      {importContactModalOpen && (
        <ContactImportWpModal
          isOpen={importContactModalOpen}
          handleClose={() => setImportContactModalOpen(false)}
          selectedTags={selectedTags}
          hideNum={hideNum}
          userProfile={user.profile}
        />
      )}

      {/* ABAS CONTATOS / MAPA */}
      <Paper elevation={0} className={classes.tabsWrap}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="abas-contatos-mapa"
          className={classes.tabsRoot}
        >
          <Tab label="Contatos" />
          <Tab label="Mapa" />
        </Tabs>
      </Paper>

      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        <>
          <input
            style={{ display: "none" }}
            id="upload"
            name="file"
            type="file"
            accept=".xls,.xlsx"
            onChange={() => {
              setConfirmOpen(true);
            }}
            ref={fileUploadRef}
          />
        </>

        {/* ABA CONTATOS EM CARDS */}
        {tabValue === 0 && (
          <Box p={2}>
            {/* checkbox global "selecionar todos" */}
            <Box className={classes.contactsTopBar}>
              <Box display="flex" alignItems="center">
                <Checkbox
                  checked={isSelectAllChecked}
                  onChange={handleSelectAllContacts}
                  inputProps={{ "aria-label": "Selecionar todos os contatos visíveis" }}
                />
                <Typography variant="body2">
                  Selecionar todos os contatos visíveis
                </Typography>
              </Box>
            </Box>

            <Grid container spacing={2}>
              {visibleContacts.map((contact) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={contact.id}>
                  <Card className={classes.contactCard}>
                    <CardContent>
                      <Box className={classes.cardTop}>
                        <Box className={classes.cardHeader}>
                          <Avatar
                            src={getContactAvatarSrc(contact)}
                            imgProps={{
                              loading: "lazy",
                              referrerPolicy: "no-referrer",
                              onError: (event) => {
                                event.currentTarget.onerror = null;
                                event.currentTarget.src = "/nopicture.png";
                              },
                            }}
                            className={classes.cardAvatar}
                          />
                          <Box className={classes.cardMainInfo}>
                            <Typography
                              variant="subtitle1"
                              gutterBottom
                              className={classes.cardName}
                            >
                              {contact.name || "-"}
                            </Typography>
                            <Box
                              className={`${classes.statusBadge} ${
                                contact.active
                                  ? classes.statusActive
                                  : classes.statusInactive
                              }`}
                            >
                              <FiberManualRecord className={classes.statusDot} />
                              {contact.active ? "Ativo" : "Inativo"}
                            </Box>
                          </Box>
                        </Box>

                        <Checkbox
                          checked={selectedContactIds.includes(contact.id)}
                          onChange={handleToggleSelectContact(contact.id)}
                          inputProps={{
                            "aria-label": `Selecionar contato ${contact.name}`,
                          }}
                        />
                      </Box>

                      <Box className={classes.infoList}>
                        <Typography variant="body2" className={classes.infoItem}>
                          <WhatsApp className={classes.infoIcon} />
                          {getContactDisplayNumber(contact)}
                        </Typography>
                        <Typography variant="body2" className={classes.infoItem}>
                          <MailOutline className={classes.infoIcon} />
                          {contact.email || "Sem email"}
                        </Typography>
                        <Box className={classes.tagBadgesRow}>
                          <LocalOfferOutlined className={classes.infoIcon} />
                          {contact?.tags?.length ? (
                            <Box className={classes.tagBadgesWrap}>
                              {contact.tags.map((tag) => (
                                <span
                                  key={`${contact.id}-tag-${
                                    typeof tag === "string" ? tag : tag.id || tag.name
                                  }`}
                                  className={classes.tagBadge}
                                  style={{
                                    backgroundColor: resolveTagColor(tag),
                                    color: getTagTextColor(resolveTagColor(tag)),
                                    borderColor: `${resolveTagColor(tag)}66`,
                                  }}
                                >
                                  {typeof tag === "string" ? tag : tag.name}
                                </span>
                              ))}
                            </Box>
                          ) : (
                            <Typography variant="body2" className={classes.infoItem}>
                              Sem tag
                            </Typography>
                          )}
                        </Box>
                      </Box>

                      <Box className={classes.cardFooter}>
                        <Box />
                        <Box className={classes.actionsRight}>
                          <IconButton
                            size="small"
                            className={`${classes.actionBtnBase} ${classes.actionBtnWhats}`}
                            disabled={!contact.active}
                            onClick={() => {
                              setContactTicket(contact);
                              setNewTicketModalOpen(true);
                            }}
                          >
                            {contact.channel === "whatsapp" && <WhatsApp style={{ fontSize: 17 }} />}
                            {contact.channel === "instagram" && <Instagram style={{ fontSize: 17 }} />}
                            {contact.channel === "facebook" && <Facebook style={{ fontSize: 17 }} />}
                          </IconButton>

                          <IconButton
                            size="small"
                            className={`${classes.actionBtnBase} ${classes.actionBtnEdit}`}
                            onClick={() => hadleEditContact(contact.id)}
                          >
                            <EditIcon style={{ fontSize: 17 }} />
                          </IconButton>

                          <IconButton
                            size="small"
                            className={`${classes.actionBtnBase} ${classes.actionBtnBlock}`}
                            onClick={
                              contact.active
                                ? () => {
                                    setConfirmOpen(true);
                                    setBlockingContact(contact);
                                  }
                                : () => {
                                    setConfirmOpen(true);
                                    setUnBlockingContact(contact);
                                  }
                            }
                          >
                            {contact.active ? (
                              <BlockIcon style={{ fontSize: 17 }} />
                            ) : (
                              <CheckCircleIcon style={{ fontSize: 17 }} />
                            )}
                          </IconButton>

                          <Can
                            role={user.profile}
                            perform="contacts-page:deleteContact"
                            yes={() => (
                              <IconButton
                                size="small"
                                className={`${classes.actionBtnBase} ${classes.actionBtnDelete}`}
                                onClick={() => {
                                  setConfirmOpen(true);
                                  setDeletingContact(contact);
                                }}
                              >
                                <DeleteOutlineIcon style={{ fontSize: 17 }} />
                              </IconButton>
                            )}
                          />
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {loading && (
              <Box mt={2}>
                <Grid container spacing={2}>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={`contacts-skeleton-${index}`}>
                      <Card className={classes.contactCard}>
                        <CardContent>
                          <Box display="flex" alignItems="center" mb={1.5}>
                            <Skeleton variant="circle" width={40} height={40} />
                            <Box ml={1.5} flex={1}>
                              <Skeleton variant="text" width="70%" height={22} />
                              <Skeleton variant="text" width="45%" height={18} />
                            </Box>
                          </Box>
                          <Skeleton variant="rect" height={36} />
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </Box>
        )}

        {/* ABA MAPA */}
        {tabValue === 1 && (
          <>
            <Box className={classes.mapSection}>
              <Grid container spacing={2} className={classes.mapTopMetrics}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card className={classes.metricCard}>
                    <CardContent className={classes.metricCardBody}>
                      <Box className={classes.metricIconWrap}>
                        <GroupOutlined style={{ fontSize: 18 }} />
                      </Box>
                      <Box>
                        <Typography className={classes.metricLabel}>
                          Total de Contatos
                        </Typography>
                        <Typography className={classes.metricValue}>
                          {contacts.length}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card className={classes.metricCard}>
                    <CardContent className={classes.metricCardBody}>
                      <Box className={classes.metricIconWrap}>
                        <PublicOutlined style={{ fontSize: 18 }} />
                      </Box>
                      <Box>
                        <Typography className={classes.metricLabel}>
                          Estados Alcançados
                        </Typography>
                        <Typography className={classes.metricValue}>
                          {statesReached}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card className={classes.metricCard}>
                    <CardContent className={classes.metricCardBody}>
                      <Box className={classes.metricIconWrap}>
                        <PlaceOutlined style={{ fontSize: 18 }} />
                      </Box>
                      <Box>
                        <Typography className={classes.metricLabel}>
                          Estado com Mais Leads
                        </Typography>
                        <Typography className={classes.metricValue}>
                          {topState.name}
                        </Typography>
                        <Typography className={classes.metricSubtle}>
                          {topState.count} contato(s)
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card className={classes.metricCard}>
                    <CardContent className={classes.metricCardBody}>
                      <Box className={classes.metricIconWrap}>
                        <TrendingUpOutlined style={{ fontSize: 18 }} />
                      </Box>
                      <Box>
                        <Typography className={classes.metricLabel}>
                          Crescimento Mensal
                        </Typography>
                        <Typography className={classes.metricValue}>
                          {`${monthlyGrowth >= 0 ? "+" : ""}${monthlyGrowth.toFixed(1)}%`}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Card className={classes.legendCard}>
                    <CardContent>
                      <Typography className={classes.mapCardTitle} gutterBottom>
                        Distribuição por Estado
                      </Typography>
                      <Box className={classes.legendContainer}>
                        {stateEntriesSorted.length ? (
                          stateEntriesSorted.map(([state, count]) => (
                            <Box key={state} className={classes.legendItem}>
                              <Box className={classes.legendRowLeft}>
                                <div className={classes.legendColor} />
                                <Typography className={classes.legendStateName}>
                                  {state}
                                </Typography>
                              </Box>
                              <Typography className={classes.legendStateCount}>
                                {count}
                              </Typography>
                            </Box>
                          ))
                        ) : (
                          <Typography variant="body2" color="textSecondary">
                            Nenhum contato com estado identificado.
                          </Typography>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={8}>
                  <Card className={classes.mapCard}>
                    <Box className={classes.mapCardHeader}>
                      <Box>
                        <Typography className={classes.mapCardTitle}>
                          Mapa de Leads no Brasil
                        </Typography>
                        <Typography className={classes.mapCardSubTitle}>
                          Intensidade por volume de contatos
                        </Typography>
                      </Box>
                      <Box className={classes.mapLegendScale}>
                        <span>Menor</span>
                        <div className={classes.mapGradientBar} />
                        <span>Maior</span>
                      </Box>
                    </Box>

                    <Box className={classes.mapWrap}>
                      <ComposableMap
                        projection="geoMercator"
                        projectionConfig={{
                          scale: 650,
                          center: [-53, -15],
                        }}
                        style={{ width: "100%", height: "auto" }}
                      >
                        <Geographies geography={geoUrl}>
                          {({ geographies }) =>
                            geographies.map((geo) => {
                              const state = geo.properties.name;
                              const count = stateCounts[state] || 0;

                              return (
                                <Geography
                                  key={geo.rsmKey}
                                  geography={geo}
                                  fill={stateFillColor(count)}
                                  stroke="#d9e2ee"
                                  strokeWidth={0.8}
                                  style={{
                                    default: { outline: "none" },
                                    hover: {
                                      outline: "none",
                                      fill: "#5a67f2",
                                      stroke: "#ccd7e7",
                                    },
                                    pressed: { outline: "none" },
                                  }}
                                />
                              );
                            })
                          }
                        </Geographies>
                        {markers.map(({ name, coordinates }) => (
                          <Marker key={name} coordinates={coordinates}>
                            <circle
                              r={2.8}
                              fill="#94a3b8"
                              fillOpacity={0.45}
                              stroke="none"
                            />
                          </Marker>
                        ))}
                      </ComposableMap>
                    </Box>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          </>
        )}
      </Paper>
    </div>
  );
};

export default Contacts;
