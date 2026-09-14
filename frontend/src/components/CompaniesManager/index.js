import React, { useState, useEffect, useContext } from "react";
import {
  makeStyles,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  MenuItem,
  TextField,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
  IconButton,
  Checkbox,
  Select,
  Box,
  Tooltip,
  Typography,
  Dialog,
  DialogContent,
  CircularProgress,
  Button,
  InputAdornment,
  useTheme,
  useMediaQuery,
} from "@material-ui/core";
import { Formik, Form, Field } from "formik";
import ButtonWithSpinner from "../ButtonWithSpinner";
import ConfirmationModal from "../ConfirmationModal";

import {
  Search as SearchIcon,
  DeleteOutline as DeleteOutlineIcon,
  AttachMoney as AttachMoneyIcon,
  DeleteSweep as DeleteSweepIcon,
  EditOutlined as EditOutlinedIcon,
  VisibilityOutlined as VisibilityOutlinedIcon,
  MonetizationOn as MonetizationOnIcon,
  EventAvailable as EventAvailableIcon,
  VpnKey as VpnKeyIcon,
  Storage as StorageIcon,
  Add as AddIcon,
  Business as BusinessIcon,
  Lock as LockIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  FilterList as FilterListIcon,
  LayersClear as LayersClearIcon,
  Assessment as AssessmentIcon,
  Refresh as RefreshIcon,
  People as PeopleIcon,
  CropFree as CropFreeIcon,
} from "@material-ui/icons";
import WhatsAppModalAdmin from "../WhatsAppModalAdmin";

import { toast } from "react-toastify";
import useCompanies from "../../hooks/useCompanies";
import usePlans from "../../hooks/usePlans";
import ModalUsers from "../ModalUsers";
import api from "../../services/api";
import { head, isArray } from "lodash";
import { useDate } from "../../hooks/useDate";

import moment from "moment";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
  },
  mainPaper: {
    width: "100%",
    flex: 1,
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: "transparent",
    boxShadow: "none",
    padding: 0,
  },
  fullWidth: {
    width: "100%",
  },

  // ─── Master Access Card ───────────────────────────────────────────
  masterCard: {
    borderRadius: 14,
    border: `1px solid ${theme.palette.type === "light" ? "#e8eefc" : theme.palette.divider}`,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    background:
      theme.palette.type === "light"
        ? "linear-gradient(115deg, #fffdf5 0%, #fff9e6 100%)"
        : "linear-gradient(115deg, #1e1a0e 0%, #231f0a 100%)",
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(2),
  },
  masterCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.palette.type === "light" ? "#fef3c7" : "#78350f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    "& svg": {
      color: theme.palette.type === "light" ? "#b45309" : "#fcd34d",
      fontSize: 20,
    },
  },
  masterCardBody: {
    flex: 1,
    minWidth: 0,
  },
  masterCardTitle: {
    fontWeight: 700,
    fontSize: "0.88rem",
    color: theme.palette.text.primary,
    marginBottom: 2,
  },
  masterCardSubtitle: {
    fontSize: "0.78rem",
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1.5),
  },
  masterCardControls: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  masterCardInput: {
    minWidth: 240,
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      backgroundColor: theme.palette.background.paper,
      height: 36,
    },
    "& .MuiInputLabel-outlined": {
      transform: "translate(14px, 10px) scale(1)",
    },
    "& .MuiInputLabel-outlined.MuiInputLabel-shrink": {
      transform: "translate(14px, -6px) scale(0.75)",
    },
    [theme.breakpoints.down("sm")]: {
      minWidth: "100%",
    },
  },
  masterCardStatus: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    fontSize: "0.74rem",
    fontWeight: 600,
    color: theme.palette.text.secondary,
  },

  // ─── Toolbar ──────────────────────────────────────────────────────
  toolbar: {
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1.5, 2),
    marginBottom: theme.spacing(1.5),
    background:
      theme.palette.type === "light"
        ? "#ffffff"
        : theme.palette.background.default,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(1.5),
  },
  toolbarLeft: {
    display: "flex",
    flexDirection: "column",
  },
  toolbarTitle: {
    fontWeight: 700,
    fontSize: "0.9rem",
    color: theme.palette.text.primary,
    lineHeight: 1.3,
  },
  toolbarMeta: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    marginTop: 1,
  },
  toolbarRight: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  searchInput: {
    minWidth: 220,
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      height: 36,
      backgroundColor: theme.palette.type === "light" ? "#f8f9fc" : theme.palette.background.paper,
    },
    "& .MuiInputLabel-outlined": {
      transform: "translate(14px, 10px) scale(1)",
    },
    "& .MuiInputLabel-outlined.MuiInputLabel-shrink": {
      transform: "translate(14px, -6px) scale(0.75)",
    },
    [theme.breakpoints.down("sm")]: {
      minWidth: "100%",
    },
  },
  filterSelect: {
    minWidth: 170,
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      height: 36,
      backgroundColor: theme.palette.type === "light" ? "#f8f9fc" : theme.palette.background.paper,
    },
  },
  btnOutlined: {
    borderRadius: 8,
    height: 36,
    padding: "0 14px",
    fontSize: "0.78rem",
    fontWeight: 600,
    textTransform: "none",
    whiteSpace: "nowrap",
  },
  btnPrimary: {
    borderRadius: 8,
    height: 36,
    padding: "0 16px",
    fontSize: "0.78rem",
    fontWeight: 600,
    textTransform: "none",
    whiteSpace: "nowrap",
    boxShadow: "none",
    "&:hover": {
      boxShadow: "none",
    },
  },
  btnDanger: {
    borderRadius: 8,
    height: 36,
    padding: "0 14px",
    fontSize: "0.78rem",
    fontWeight: 600,
    textTransform: "none",
    whiteSpace: "nowrap",
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fca5a5",
    "&:hover": {
      backgroundColor: "#fecaca",
    },
    boxShadow: "none",
  },

  // ─── Table ────────────────────────────────────────────────────────
  tableContainer: {
    width: "100%",
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    overflowX: "auto",
    backgroundColor: theme.palette.background.paper,
    ...theme.scrollbarStyles,
  },
  table: {
    minWidth: 860,
    borderCollapse: "collapse",
  },
  tableHead: {
    "& .MuiTableCell-head": {
      background: theme.palette.type === "light" ? "#f4f7fb" : theme.palette.background.default,
      fontWeight: 700,
      fontSize: "0.72rem",
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: theme.palette.text.secondary,
      padding: "10px 12px",
      borderBottom: `1px solid ${theme.palette.divider}`,
      whiteSpace: "nowrap",
    },
  },
  tableBody: {
    "& .MuiTableCell-body": {
      padding: "8px 12px",
      fontSize: "0.82rem",
      color: theme.palette.text.primary,
      borderBottom: `1px solid ${theme.palette.type === "light" ? "#f0f4f8" : theme.palette.divider}`,
    },
  },
  rowNormal: {
    transition: "background 0.15s ease",
    "&:hover": {
      backgroundColor: theme.palette.type === "light" ? "#f8fbff" : theme.palette.action.hover,
    },
    "&:last-child td": {
      borderBottom: "none",
    },
  },
  rowWarning: {
    backgroundColor: theme.palette.type === "light" ? "#fffbeb" : "rgba(120,60,10,0.18)",
    "&:hover": {
      backgroundColor: theme.palette.type === "light" ? "#fef3c7" : "rgba(120,60,10,0.28)",
    },
    "&:last-child td": { borderBottom: "none" },
  },
  rowExpired: {
    backgroundColor: theme.palette.type === "light" ? "#fff1f2" : "rgba(127,29,29,0.18)",
    "&:hover": {
      backgroundColor: theme.palette.type === "light" ? "#ffe4e6" : "rgba(127,29,29,0.28)",
    },
    "&:last-child td": { borderBottom: "none" },
  },
  companyName: {
    fontWeight: 600,
    fontSize: "0.84rem",
  },
  companyEmail: {
    fontSize: "0.78rem",
    color: theme.palette.text.secondary,
  },

  // ─── Status / Due Date Badges ─────────────────────────────────────
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    padding: "2px 10px",
    fontSize: "0.7rem",
    fontWeight: 700,
    border: "1px solid transparent",
    whiteSpace: "nowrap",
  },
  badgeActive: {
    color: "#065f46",
    backgroundColor: "#d1fae5",
    borderColor: "#6ee7b7",
  },
  badgeInactive: {
    color: "#9f1239",
    backgroundColor: "#ffe4e6",
    borderColor: "#fda4af",
  },
  badgeWarning: {
    color: "#92400e",
    backgroundColor: "#fef3c7",
    borderColor: "#fcd34d",
  },
  badgeExpired: {
    color: "#9f1239",
    backgroundColor: "#ffe4e6",
    borderColor: "#fda4af",
  },
  badgeOk: {
    color: "#065f46",
    backgroundColor: "#d1fae5",
    borderColor: "#6ee7b7",
  },
  badgePaid: {
    color: "#027a48",
    backgroundColor: "#ecfdf3",
    borderColor: "#6ce9a6",
  },
  badgeOverdue: {
    color: "#b42318",
    backgroundColor: "#fef3f2",
    borderColor: "#fda29b",
  },
  badgeOpen: {
    color: "#b54708",
    backgroundColor: "#fffaeb",
    borderColor: "#fecd89",
  },

  // ─── Action Cell ──────────────────────────────────────────────────
  actionCell: {
    whiteSpace: "nowrap",
  },
  actionBtn: {
    padding: 5,
    borderRadius: 6,
    color: theme.palette.text.secondary,
    transition: "all 0.15s ease",
    "&:hover": {
      backgroundColor: theme.palette.type === "light" ? "#eef2ff" : theme.palette.action.hover,
      color: theme.palette.primary.main,
    },
  },
  actionBtnDanger: {
    padding: 5,
    borderRadius: 6,
    color: theme.palette.text.secondary,
    transition: "all 0.15s ease",
    "&:hover": {
      backgroundColor: "#fee2e2",
      color: "#b91c1c",
    },
  },

  // ─── Dialogs ──────────────────────────────────────────────────────
  dialogPaper: {
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    width: "min(980px, 96vw)",
    maxWidth: "96vw",
    overflow: "hidden",
  },
  dialogPaperSm: {
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
  },
  dialogHeader: {
    padding: theme.spacing(2.5, 3, 2, 3),
    background:
      theme.palette.type === "light"
        ? "#fafbff"
        : theme.palette.background.default,
    borderBottom: `1px solid ${theme.palette.divider}`,
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1.5),
  },
  dialogHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    backgroundColor: theme.palette.type === "light" ? "#eff6ff" : "#1e3a5f",
    "& svg": {
      color: theme.palette.primary.main,
      fontSize: 19,
    },
  },
  dialogHeaderText: {
    display: "flex",
    flexDirection: "column",
  },
  dialogTitle: {
    fontWeight: 700,
    fontSize: "1rem",
    color: theme.palette.text.primary,
    lineHeight: 1.3,
  },
  dialogSubtitle: {
    fontSize: "0.78rem",
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  dialogContent: {
    padding: theme.spacing(2.5, 3),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(2),
    },
  },
  dialogActions: {
    padding: theme.spacing(1.5, 3),
    borderTop: `1px solid ${theme.palette.divider}`,
    gap: theme.spacing(1),
  },

  // ─── Form Panel ───────────────────────────────────────────────────
  formSection: {
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(2),
    background:
      theme.palette.type === "light"
        ? "#fafbff"
        : theme.palette.background.paper,
    marginBottom: theme.spacing(1.5),
  },
  formSectionTitle: {
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1.5),
  },
  inputField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      backgroundColor: theme.palette.background.paper,
    },
  },
  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    paddingTop: theme.spacing(1),
  },

  // ─── Details Modal ────────────────────────────────────────────────
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: theme.spacing(1.5),
    [theme.breakpoints.down("xs")]: {
      gridTemplateColumns: "1fr",
    },
  },
  detailItem: {
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1.2, 1.5),
    background:
      theme.palette.type === "light" ? "#fafbff" : theme.palette.background.paper,
  },
  detailLabel: {
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: "0.86rem",
    fontWeight: 600,
    color: theme.palette.text.primary,
  },

  // ─── Storage Modal ────────────────────────────────────────────────
  storageCard: {
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(2),
    background:
      theme.palette.type === "light" ? "#f8fbff" : theme.palette.background.paper,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
  },
  storageStat: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing(0.75, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    "&:last-child": {
      borderBottom: "none",
    },
  },
  storageLabel: {
    fontSize: "0.78rem",
    color: theme.palette.text.secondary,
    fontWeight: 500,
  },
  storageValue: {
    fontSize: "0.86rem",
    fontWeight: 700,
    color: theme.palette.text.primary,
  },

  // ─── Invoice Table ────────────────────────────────────────────────
  invoicesTableWrap: {
    width: "100%",
    overflowX: "auto",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 10,
  },
  invoicesTable: {
    minWidth: 600,
  },
  invoicesPaginationRow: {
    marginTop: theme.spacing(2),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  invoicesPaginationPages: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  paginationBtn: {
    minWidth: 32,
    height: 32,
    borderRadius: 8,
    padding: "0 8px",
    fontSize: "0.78rem",
    fontWeight: 600,
    textTransform: "none",
  },
  paginationBtnActive: {
    backgroundColor: theme.palette.primary.main,
    color: "#fff",
    "&:hover": {
      backgroundColor: theme.palette.primary.dark,
    },
  },

  // ─── Empty / Loading States ───────────────────────────────────────
  emptyState: {
    padding: theme.spacing(4, 2),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
  loadingState: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing(4),
  },

  // ─── Stats Modal ──────────────────────────────────────────────────
  statsGrid4: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: theme.spacing(1.5),
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "repeat(2, 1fr)",
    },
  },
  statsGrid2: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: theme.spacing(1.5),
  },
  statCard: {
    borderRadius: 12,
    border: "1px solid transparent",
    padding: theme.spacing(1.5, 2),
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  statCardLabel: {
    fontSize: "0.7rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  statCardValue: {
    fontSize: "1.4rem",
    fontWeight: 800,
    lineHeight: 1.1,
    marginTop: 2,
  },
  statsSectionTitle: {
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
    marginTop: theme.spacing(2),
  },

  textfield: { width: "100%" },
  textRight: { textAlign: "right" },
  row: {},
  control: {},
  buttonContainer: { textAlign: "right" },
}));

const INVOICES_PER_PAGE = 10;

const toMomentValue = (value) => {
  if (!value) return null;
  const parsed = moment(value);
  return parsed.isValid() ? parsed.valueOf() : null;
};

const sortInvoicesByMostRecent = (invoices = []) => {
  return [...invoices].sort((a, b) => {
    const bCreated = toMomentValue(b.createdAt);
    const aCreated = toMomentValue(a.createdAt);
    if (bCreated !== null || aCreated !== null) {
      if (bCreated === null) return -1;
      if (aCreated === null) return 1;
      if (bCreated !== aCreated) return bCreated - aCreated;
    }
    const bDue = toMomentValue(b.dueDate);
    const aDue = toMomentValue(a.dueDate);
    if (bDue !== null || aDue !== null) {
      if (bDue === null) return -1;
      if (aDue === null) return 1;
      if (bDue !== aDue) return bDue - aDue;
    }
    return Number(b.id || 0) - Number(a.id || 0);
  });
};

const buildVisiblePages = (currentPage, totalPages) => {
  const windowSize = 5;
  if (totalPages <= windowSize) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }
  let start = Math.max(1, currentPage - 2);
  let end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
};

export function CompanyForm(props) {
  const PROTECTED_COMPANY_ID = 1;
  const { onSubmit, onDelete, onCancel, initialValue, loading, cancelLabel, canDelete = true } = props;
  const classes = useStyles();
  const [plans, setPlans] = useState([]);
  const [modalUser, setModalUser] = useState(false);
  const [firstUser, setFirstUser] = useState({});
  const isProtectedCompany = Number(initialValue?.id) === PROTECTED_COMPANY_ID;

  const [record, setRecord] = useState({
    name: "",
    email: "",
    phone: "",
    planId: "",
    status: true,
    dueDate: "",
    recurrence: "",
    password: "",
    ...initialValue,
  });

  const normalizePhone = (value = "") => value.replace(/\D/g, "").slice(0, 11);

  const formatPhone = (value = "") => {
    const digits = normalizePhone(value);
    if (!digits) return "";
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const { list: listPlans } = usePlans();

  useEffect(() => {
    async function fetchData() {
      const list = await listPlans();
      setPlans(list);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setRecord((prev) => {
      if (moment(initialValue).isValid()) {
        initialValue.dueDate = moment(initialValue.dueDate).format("YYYY-MM-DD");
      }
      return { ...prev, ...initialValue };
    });
  }, [initialValue]);

  const handleSubmit = async (data) => {
    if (isProtectedCompany) {
      onSubmit({
        id: data.id,
        name: String(data.name || "").trim(),
        planId: data.planId
      });
      setRecord({ ...initialValue, dueDate: "" });
      return;
    }
    // O Select do MUI só marca "required" visualmente (asterisco no label) —
    // não bloqueia o envio do formulário sozinho. Sem essa checagem, dava
    // pra cadastrar uma empresa sem plano nenhum vinculado.
    if (!data.planId) {
      toast.error("Selecione um plano para vincular à empresa.");
      return;
    }
    if (data.dueDate === "" || moment(data.dueDate).isValid() === false) {
      data.dueDate = null;
    }
    data.phone = normalizePhone(data.phone);
    onSubmit(data);
    setRecord({ ...initialValue, dueDate: "" });
  };

  const handleCloseModalUsers = () => {
    setFirstUser({});
    setModalUser(false);
  };

  const incrementDueDate = () => {
    const data = { ...record };
    if (data.dueDate !== "" && data.dueDate !== null) {
      switch (data.recurrence) {
        case "MENSAL": data.dueDate = moment(data.dueDate).add(1, "month").format("YYYY-MM-DD"); break;
        case "BIMESTRAL": data.dueDate = moment(data.dueDate).add(2, "month").format("YYYY-MM-DD"); break;
        case "TRIMESTRAL": data.dueDate = moment(data.dueDate).add(3, "month").format("YYYY-MM-DD"); break;
        case "SEMESTRAL": data.dueDate = moment(data.dueDate).add(6, "month").format("YYYY-MM-DD"); break;
        case "ANUAL": data.dueDate = moment(data.dueDate).add(12, "month").format("YYYY-MM-DD"); break;
        default: break;
      }
    }
    setRecord(data);
  };

  return (
    <>
      <ModalUsers
        userId={firstUser.id}
        companyId={initialValue.id}
        open={modalUser}
        onClose={handleCloseModalUsers}
      />
      <Formik
        enableReinitialize
        className={classes.fullWidth}
        initialValues={record}
        onSubmit={(values, { resetForm }) =>
          setTimeout(() => { handleSubmit(values); resetForm(); }, 500)
        }
      >
        {({ values, setFieldValue }) => (
          <Form className={classes.fullWidth}>
            <Box className={classes.formSection}>
              <Typography className={classes.formSectionTitle}>Dados da empresa</Typography>
              <Grid spacing={2} container>
                <Grid xs={12} sm={6} md={4} item>
                  <Field
                    as={TextField}
                    label={i18n.t("compaies.table.name")}
                    name="name"
                    variant="outlined"
                    className={`${classes.fullWidth} ${classes.inputField}`}
                    margin="dense"
                  />
                </Grid>
                <Grid xs={12} sm={6} md={5} item>
                  <Field
                    as={TextField}
                    label={i18n.t("compaies.table.email")}
                    name="email"
                    variant="outlined"
                    className={`${classes.fullWidth} ${classes.inputField}`}
                    margin="dense"
                    required={!isProtectedCompany}
                    disabled={isProtectedCompany}
                  />
                </Grid>
                <Grid xs={12} sm={6} md={3} item>
                  <TextField
                    label={i18n.t("compaies.table.phone")}
                    name="phone"
                    variant="outlined"
                    value={formatPhone(values.phone || "")}
                    onChange={(e) => setFieldValue("phone", normalizePhone(e.target.value))}
                    className={`${classes.fullWidth} ${classes.inputField}`}
                    margin="dense"
                    disabled={isProtectedCompany}
                  />
                </Grid>
                <Grid xs={12} sm={6} md={4} item>
                  <Field
                    as={TextField}
                    label={i18n.t("compaies.table.document")}
                    name="document"
                    variant="outlined"
                    className={`${classes.fullWidth} ${classes.inputField}`}
                    margin="dense"
                    disabled={isProtectedCompany}
                  />
                </Grid>
                <Grid xs={12} sm={6} md={4} item>
                  <Field
                    as={TextField}
                    label={i18n.t("compaies.table.password")}
                    name="password"
                    variant="outlined"
                    className={`${classes.fullWidth} ${classes.inputField}`}
                    margin="dense"
                    disabled={isProtectedCompany}
                  />
                </Grid>
              </Grid>
            </Box>

            <Box className={classes.formSection}>
              <Typography className={classes.formSectionTitle}>Plano & faturamento</Typography>
              <Grid spacing={2} container>
                <Grid xs={12} sm={6} md={3} item>
                  <FormControl margin="dense" variant="outlined" fullWidth className={classes.inputField}>
                    <InputLabel htmlFor="plan-selection">{i18n.t("compaies.table.plan")}</InputLabel>
                    <Field
                      as={Select}
                      id="plan-selection"
                      label={i18n.t("compaies.table.plan")}
                      labelId="plan-selection-label"
                      name="planId"
                      margin="dense"
                      required={!isProtectedCompany}
                      disabled={false}
                    >
                      {plans.map((plan, key) => (
                        <MenuItem key={key} value={plan.id}>{plan.name}</MenuItem>
                      ))}
                    </Field>
                  </FormControl>
                </Grid>
                <Grid xs={12} sm={6} md={2} item>
                  <FormControl margin="dense" variant="outlined" fullWidth className={classes.inputField}>
                    <InputLabel htmlFor="status-selection">{i18n.t("compaies.table.active")}</InputLabel>
                    <Field
                      as={Select}
                      id="status-selection"
                      label={i18n.t("compaies.table.active")}
                      labelId="status-selection-label"
                      name="status"
                      margin="dense"
                      disabled={isProtectedCompany}
                    >
                      <MenuItem value={true}>{i18n.t("compaies.table.yes")}</MenuItem>
                      <MenuItem value={false}>{i18n.t("compaies.table.no")}</MenuItem>
                    </Field>
                  </FormControl>
                </Grid>
                <Grid xs={12} sm={6} md={3} item>
                  <TextField
                    label={i18n.t("compaies.table.dueDate")}
                    type="date"
                    name="dueDate"
                    value={values.dueDate ? moment(values.dueDate).format("YYYY-MM-DD") : ""}
                    onChange={(e) => setFieldValue("dueDate", e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    variant="outlined"
                    fullWidth
                    margin="dense"
                    className={`${classes.fullWidth} ${classes.inputField}`}
                    disabled={isProtectedCompany}
                  />
                </Grid>
                <Grid xs={12} sm={6} md={3} item>
                  <FormControl margin="dense" variant="outlined" fullWidth className={classes.inputField}>
                    <InputLabel htmlFor="recorrencia-selection">{i18n.t("compaies.table.recurrence")}</InputLabel>
                    <Field
                      as={Select}
                      label="Recorrência"
                      labelId="recorrencia-selection-label"
                      id="recurrence"
                      name="recurrence"
                      margin="dense"
                      disabled={isProtectedCompany}
                    >
                      <MenuItem value="MENSAL">{i18n.t("compaies.table.monthly")}</MenuItem>
                      <MenuItem value="BIMESTRAL">{i18n.t("compaies.table.bimonthly")}</MenuItem>
                      <MenuItem value="TRIMESTRAL">{i18n.t("compaies.table.quarterly")}</MenuItem>
                      <MenuItem value="SEMESTRAL">{i18n.t("compaies.table.semester")}</MenuItem>
                      <MenuItem value="ANUAL">{i18n.t("compaies.table.yearly")}</MenuItem>
                    </Field>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>

            <Box className={classes.formActions}>
              <ButtonWithSpinner
                loading={loading}
                onClick={() => onCancel()}
                variant="outlined"
                classes={{ root: classes.btnOutlined }}
              >
                {cancelLabel || i18n.t("compaies.table.clear")}
              </ButtonWithSpinner>
              {record.id !== undefined && (
                <>
                  {canDelete && (
                    <ButtonWithSpinner
                      loading={loading}
                      onClick={() => onDelete(record)}
                      variant="contained"
                      classes={{ root: classes.btnDanger }}
                    >
                      {i18n.t("compaies.table.delete")}
                    </ButtonWithSpinner>
                  )}
                  {!isProtectedCompany && (
                    <ButtonWithSpinner
                      loading={loading}
                      onClick={() => incrementDueDate()}
                      variant="outlined"
                      color="primary"
                      classes={{ root: classes.btnOutlined }}
                    >
                      +1 mês
                    </ButtonWithSpinner>
                  )}
                </>
              )}
              <ButtonWithSpinner
                loading={loading}
                type="submit"
                variant="contained"
                color="primary"
                classes={{ root: classes.btnPrimary }}
              >
                {i18n.t("compaies.table.save")}
              </ButtonWithSpinner>
            </Box>
          </Form>
        )}
      </Formik>
    </>
  );
}

export function CompaniesManagerGrid(props) {
  const {
    records,
    onSelect,
    onRequestDelete,
    onOpenInvoices,
    onAddOneMonth,
    onOpenDetails,
    onOpenMasterAccess,
    onShowStorageUsage,
    onOpenStats,
    onOpenUsers,
    onOpenConnections,
    bulkSelectionEnabled,
    selectedIds,
    onToggleSelect,
    onToggleSelectAll,
    isCompanyProtected,
  } = props;
  const classes = useStyles();
  const { dateToClient, datetimeToClient } = useDate();

  const renderStatusBadge = (row) => {
    if (row.status === false) {
      return (
        <span className={`${classes.badge} ${classes.badgeInactive}`}>
          <CancelIcon style={{ fontSize: 10 }} />
          Inativa
        </span>
      );
    }
    return (
      <span className={`${classes.badge} ${classes.badgeActive}`}>
        <CheckCircleIcon style={{ fontSize: 10 }} />
        Ativa
      </span>
    );
  };

  const renderDueDateBadge = (row) => {
    if (!moment(row.dueDate).isValid()) {
      return <span style={{ color: "inherit", fontSize: "0.78rem" }}>—</span>;
    }
    const now = moment();
    const dueDate = moment(row.dueDate);
    const diff = dueDate.diff(now, "days");

    let badgeClass = classes.badgeOk;
    if (diff >= 1 && diff <= 5) badgeClass = classes.badgeWarning;
    else if (diff <= 0) badgeClass = classes.badgeExpired;

    return (
      <Box display="flex" flexDirection="column" alignItems="center" style={{ gap: 2 }}>
        <span className={`${classes.badge} ${badgeClass}`}>
          {dateToClient(row.dueDate)}
        </span>
        {row.recurrence && (
          <Typography variant="caption" color="textSecondary" style={{ fontSize: "0.65rem" }}>
            {row.recurrence}
          </Typography>
        )}
      </Box>
    );
  };

  const renderPlan = (row) => row.planId !== null ? row.plan?.name || "—" : "—";

  const renderPlanValue = (row) =>
    row.planId !== null && row.plan?.amount
      ? `R$ ${row.plan.amount.toLocaleString("pt-br", { minimumFractionDigits: 2 })}`
      : "—";

  const rowStyle = (record) => {
    if (!moment(record.dueDate).isValid()) return classes.rowNormal;
    const diff = moment(record.dueDate).diff(moment(), "days");
    if (diff >= 1 && diff <= 5) return classes.rowWarning;
    if (diff <= 0) return classes.rowExpired;
    return classes.rowNormal;
  };

  const selectableRecords = records.filter((row) => !isCompanyProtected(row));
  const allSelected = selectableRecords.length > 0 && selectedIds.length === selectableRecords.length;

  return (
    <Paper className={classes.tableContainer} elevation={0}>
        <Table className={classes.table} size="small" aria-label="companies table">
          <TableHead className={classes.tableHead}>
            <TableRow>
              <TableCell align="center" style={{ width: 44 }}>
                {bulkSelectionEnabled ? (
                  <Checkbox
                    checked={allSelected}
                    indeterminate={selectedIds.length > 0 && !allSelected}
                    onChange={onToggleSelectAll}
                    color="primary"
                    size="small"
                  />
                ) : "#"}
              </TableCell>
              <TableCell align="left">{i18n.t("compaies.table.name")}</TableCell>
              <TableCell align="left">{i18n.t("compaies.table.email")}</TableCell>
              <TableCell align="center">{i18n.t("compaies.table.phone")}</TableCell>
              <TableCell align="center">{i18n.t("compaies.table.plan")}</TableCell>
              <TableCell align="center">{i18n.t("compaies.table.value")}</TableCell>
              <TableCell align="center">{i18n.t("compaies.table.active")}</TableCell>
              <TableCell align="center">{i18n.t("compaies.table.createdAt")}</TableCell>
              <TableCell align="center">{i18n.t("compaies.table.dueDate")}</TableCell>
              <TableCell align="center">{i18n.t("compaies.table.lastLogin")}</TableCell>
              <TableCell align="center">{i18n.t("compaies.table.actions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody className={classes.tableBody}>
            {records.map((row, key) => (
              <TableRow className={rowStyle(row)} key={key}>
                <TableCell align="center" style={{ width: 44 }}>
                  {bulkSelectionEnabled ? (
                    <Checkbox
                      checked={selectedIds.includes(row.id)}
                      onChange={() => onToggleSelect(row.id)}
                      color="primary"
                      size="small"
                      disabled={isCompanyProtected(row)}
                    />
                  ) : (
                    <Typography style={{ fontSize: "0.75rem", fontWeight: 700, opacity: 0.5 }}>
                      #{row.id}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="left">
                  <Typography className={classes.companyName}>{row.name || "—"}</Typography>
                </TableCell>
                <TableCell align="left">
                  <Typography className={classes.companyEmail}>{row.email || "—"}</Typography>
                </TableCell>
                <TableCell align="center" style={{ fontSize: "0.78rem" }}>{row.phone || "—"}</TableCell>
                <TableCell align="center" style={{ fontSize: "0.78rem" }}>{renderPlan(row)}</TableCell>
                <TableCell align="center" style={{ fontSize: "0.78rem", fontWeight: 600 }}>{renderPlanValue(row)}</TableCell>
                <TableCell align="center">{renderStatusBadge(row)}</TableCell>
                <TableCell align="center" style={{ fontSize: "0.78rem" }}>{dateToClient(row.createdAt)}</TableCell>
                <TableCell align="center">{renderDueDateBadge(row)}</TableCell>
                <TableCell align="center" style={{ fontSize: "0.78rem" }}>{datetimeToClient(row.lastLogin)}</TableCell>
                <TableCell align="center" className={classes.actionCell}>
                  <Tooltip title="Editar empresa" arrow>
                    <IconButton size="small" className={classes.actionBtn} onClick={() => onSelect(row)}>
                      <EditOutlinedIcon style={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Ver detalhes" arrow>
                    <IconButton size="small" className={classes.actionBtn} onClick={() => onOpenDetails(row)}>
                      <VisibilityOutlinedIcon style={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Faturas em aberto" arrow>
                    <IconButton size="small" className={classes.actionBtn} onClick={() => onOpenInvoices(row)}>
                      <MonetizationOnIcon style={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Adicionar 1 mês no vencimento" arrow>
                    <IconButton size="small" className={classes.actionBtn} onClick={() => onAddOneMonth(row)}>
                      <EventAvailableIcon style={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Acesso com senha master" arrow>
                    <IconButton size="small" className={classes.actionBtn} onClick={() => onOpenMasterAccess(row)}>
                      <VpnKeyIcon style={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Uso de armazenamento (GB)" arrow>
                    <IconButton size="small" className={classes.actionBtn} onClick={() => onShowStorageUsage(row)}>
                      <StorageIcon style={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Estatísticas da empresa" arrow>
                    <IconButton size="small" className={classes.actionBtn} onClick={() => onOpenStats(row)}>
                      <AssessmentIcon style={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Usuários da empresa" arrow>
                    <IconButton size="small" className={classes.actionBtn} onClick={() => onOpenUsers(row)}>
                      <PeopleIcon style={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Listar Conexões" arrow>
                    <IconButton size="small" className={classes.actionBtn} onClick={() => onOpenConnections(row)}>
                      <CropFreeIcon style={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  {!isCompanyProtected(row) && (
                    <Tooltip title="Excluir empresa" arrow>
                      <IconButton size="small" className={classes.actionBtnDanger} onClick={() => onRequestDelete([row.id], row.name)}>
                        <DeleteOutlineIcon style={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
  );
}

export default function CompaniesManager() {
  const MASTER_PASSWORD_MASK = "*******";
  const PROTECTED_COMPANY_ID = 1;
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("xs"));
  const { list, save, update, remove, getStorageUsage } = useCompanies();
  const { dateToClient, datetimeToClient } = useDate();
  const { handleLogin } = useContext(AuthContext);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [bulkSelectionEnabled, setBulkSelectionEnabled] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dueFilter, setDueFilter] = useState("all");
  const [deleteTargetIds, setDeleteTargetIds] = useState([]);
  const [deleteTargetLabel, setDeleteTargetLabel] = useState("");
  const [invoicesModalOpen, setInvoicesModalOpen] = useState(false);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoiceActionLoadingId, setInvoiceActionLoadingId] = useState(null);
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [invoiceCompanyName, setInvoiceCompanyName] = useState("");
  const [openInvoices, setOpenInvoices] = useState([]);
  const [invoiceCompanyId, setInvoiceCompanyId] = useState(null);
  const [storageModalOpen, setStorageModalOpen] = useState(false);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageCompanyName, setStorageCompanyName] = useState("");
  const [storageUsage, setStorageUsage] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsCompany, setDetailsCompany] = useState(null);
  const [masterAccessModalOpen, setMasterAccessModalOpen] = useState(false);
  const [masterAccessEmail, setMasterAccessEmail] = useState("");
  const [masterAccessPassword, setMasterAccessPassword] = useState("");
  const [masterAccessLoading, setMasterAccessLoading] = useState(false);
  const [masterPasswordInput, setMasterPasswordInput] = useState("");
  const [masterPasswordConfigured, setMasterPasswordConfigured] = useState(false);
  const [masterPasswordSaving, setMasterPasswordSaving] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsCompany, setStatsCompany] = useState(null);
  const [statsData, setStatsData] = useState(null);

  const USERS_PER_PAGE = 5;
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersCompany, setUsersCompany] = useState(null);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [usersPage, setUsersPage] = useState(1);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [changePasswordUser, setChangePasswordUser] = useState(null);
  const [changePasswordValue, setChangePasswordValue] = useState("");
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  const CONNECTIONS_PER_PAGE = 5;
  const [connectionsModalOpen, setConnectionsModalOpen] = useState(false);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsCompany, setConnectionsCompany] = useState(null);
  const [companyConnections, setCompanyConnections] = useState([]);
  const [connectionsPage, setConnectionsPage] = useState(1);
  const [whatsAppEditOpen, setWhatsAppEditOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [connectionRestartingId, setConnectionRestartingId] = useState(null);

  const [record, setRecord] = useState({
    name: "", email: "", phone: "", planId: "", status: true,
    dueDate: "", recurrence: "", password: "", document: "", paymentMethod: ""
  });

  const resetRecord = () => {
    setRecord((prev) => ({
      ...prev, id: undefined, name: "", email: "", phone: "", planId: "",
      status: true, dueDate: "", recurrence: "", password: "", document: "", paymentMethod: ""
    }));
  };

  const fetchCompanyStats = async (companyId) => {
    const base = {
      contacts: null, users: null, channels: null, messages: null,
      tickets: { total: null, open: null, pending: null, closed: null },
      invoices: { paidValue: null, openValue: null },
    };
    try {
      const { data } = await api.get(`/companies/${companyId}/stats`);
      if (data && typeof data === "object") return { ...base, ...data };
    } catch {}

    // Parallel fallback fetches
    const [contactsRes, usersRes, channelsRes, ticketsOpenRes, ticketsPendingRes, ticketsClosedRes, invoicesRes] =
      await Promise.allSettled([
        api.get("/contacts", { params: { companyId, pageNumber: 1 } }),
        api.get("/users", { params: { companyId } }),
        api.get("/whatsapp/all", { params: { session: 0 } }),
        api.get("/tickets", { params: { companyId, status: "open" } }),
        api.get("/tickets", { params: { companyId, status: "pending" } }),
        api.get("/tickets", { params: { companyId, status: "closed" } }),
        fetchInvoicesByCompany(companyId),
      ]);

    if (contactsRes.status === "fulfilled") {
      const d = contactsRes.value?.data;
      if (typeof d?.count === "number") base.contacts = d.count;
      else if (Array.isArray(d?.contacts)) base.contacts = d.contacts.length;
      else if (Array.isArray(d)) base.contacts = d.length;
    }

    if (usersRes.status === "fulfilled") {
      const d = usersRes.value?.data;
      if (typeof d?.count === "number") base.users = d.count;
      else if (Array.isArray(d?.users)) base.users = d.users.length;
      else if (Array.isArray(d)) base.users = d.length;
    }

    if (channelsRes.status === "fulfilled") {
      const d = channelsRes.value?.data;
      if (Array.isArray(d)) {
        base.channels = d.filter((item) => Number(item?.companyId) === Number(companyId)).length;
      } else if (typeof d?.count === "number") base.channels = d.count;
    }

    const extractCount = (res) => {
      if (res.status !== "fulfilled") return null;
      const d = res.value?.data;
      if (typeof d?.count === "number") return d.count;
      if (Array.isArray(d?.tickets)) return d.tickets.length;
      if (Array.isArray(d)) return d.length;
      return null;
    };

    const openCount = extractCount(ticketsOpenRes);
    const pendingCount = extractCount(ticketsPendingRes);
    const closedCount = extractCount(ticketsClosedRes);
    base.tickets.open = openCount;
    base.tickets.pending = pendingCount;
    base.tickets.closed = closedCount;
    if (openCount !== null || pendingCount !== null || closedCount !== null) {
      base.tickets.total = (openCount || 0) + (pendingCount || 0) + (closedCount || 0);
    }

    if (invoicesRes.status === "fulfilled") {
      const invoices = invoicesRes.value;
      if (Array.isArray(invoices)) {
        const paid = invoices.filter((i) => i.status === "paid");
        const open = invoices.filter((i) => i.status !== "paid");
        base.invoices.paidValue = paid.reduce((sum, i) => sum + Number(i.value || 0), 0);
        base.invoices.openValue = open.reduce((sum, i) => sum + Number(i.value || 0), 0);
      }
    }

    return base;
  };

  const fetchInvoicesByCompany = async (companyId) => {
    const requests = [
      () => api.get("/invoices/all", { params: { companyId } }),
      () => api.get("/invoices/list", { params: { companyId } }),
      () => api.get(`/api/invoicesCompany/${companyId}`),
    ];
    let lastError;
    for (const request of requests) {
      try {
        const response = await request();
        const payload = response?.data;
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.invoices)) return payload.invoices;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;
    return [];
  };

  useEffect(() => {
    loadPlans();
    loadMasterPasswordStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const companyList = await list();
      setRecords(companyList);
    } catch (e) {
      toast.error("Não foi possível carregar a lista de registros");
    }
    setLoading(false);
  };

  const loadMasterPasswordStatus = async () => {
    try {
      const { data } = await api.get("/global-config");
      const hasPassword = !!data?.hasMasterAccessPassword;
      setMasterPasswordConfigured(hasPassword);
      setMasterPasswordInput(hasPassword ? MASTER_PASSWORD_MASK : "");
    } catch (error) {
      setMasterPasswordConfigured(false);
      setMasterPasswordInput("");
    }
  };

  const handleSaveMasterPassword = async () => {
    const password = (masterPasswordInput || "").trim();
    if (!password || password === MASTER_PASSWORD_MASK) {
      toast.error("Digite uma nova senha master para salvar.");
      return;
    }
    setMasterPasswordSaving(true);
    try {
      await api.put("/global-config", { masterAccessPassword: password });
      setMasterPasswordConfigured(true);
      setMasterPasswordInput(MASTER_PASSWORD_MASK);
      toast.success("Senha master salva com sucesso.");
    } catch (error) {
      toast.error("Não foi possível salvar a senha master.");
    } finally {
      setMasterPasswordSaving(false);
    }
  };

  const handleSubmit = async (data) => {
    setLoading(true);
    try {
      if (data.id !== undefined) await update(data);
      else await save(data);
      await loadPlans();
      resetRecord();
      setCompanyModalOpen(false);
      toast.success("Operação realizada com sucesso!");
    } catch (e) {
      toastError(e);
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const idsToDelete = (deleteTargetIds.length ? deleteTargetIds : (record.id ? [record.id] : []))
        .filter((id) => Number(id) !== PROTECTED_COMPANY_ID);
      if (!idsToDelete.length) {
        toast.warn("A empresa principal não pode ser excluída.");
        setDeleteTargetIds([]); setDeleteTargetLabel(""); setShowConfirmDialog(false); setLoading(false);
        return;
      }
      const results = await Promise.allSettled(idsToDelete.map((id) => remove(id)));
      const successCount = results.filter((r) => r.status === "fulfilled").length;
      const errorCount = results.length - successCount;
      await loadPlans();
      resetRecord();
      setCompanyModalOpen(false);
      if (successCount > 0) toast.success(successCount === 1 ? "Empresa excluída com sucesso!" : `${successCount} empresas excluídas com sucesso!`);
      if (errorCount > 0) toast.error(`${errorCount} empresa(s) não puderam ser excluídas.`);
    } catch (e) {
      toast.error("Não foi possível realizar a operação");
    }
    setDeleteTargetIds([]); setDeleteTargetLabel(""); setShowConfirmDialog(false); setLoading(false);
  };

  const handleOpenDeleteDialog = (ids = [], label = "") => {
    let filteredIds = [];
    if (Array.isArray(ids)) {
      filteredIds = (ids.length ? ids : (record.id ? [record.id] : [])).filter((id) => Number(id) !== PROTECTED_COMPANY_ID);
      setDeleteTargetIds(filteredIds); setDeleteTargetLabel(label);
    } else if (ids && ids.id) {
      filteredIds = Number(ids.id) !== PROTECTED_COMPANY_ID ? [ids.id] : [];
      setDeleteTargetIds(filteredIds); setDeleteTargetLabel(ids.name || "");
    } else {
      filteredIds = record.id && Number(record.id) !== PROTECTED_COMPANY_ID ? [record.id] : [];
      setDeleteTargetIds(filteredIds); setDeleteTargetLabel(label);
    }
    if (!filteredIds.length) { toast.warn("A empresa principal não pode ser excluída."); return; }
    setShowConfirmDialog(true);
  };

  const handleCancel = () => { resetRecord(); setCompanyModalOpen(false); };

  const handleSelect = (data) => {
    setRecord((prev) => ({
      ...prev,
      id: data.id, name: data.name || "", phone: data.phone || "", email: data.email || "",
      planId: data.planId || "", status: data.status === false ? false : true,
      dueDate: data.dueDate || "", recurrence: data.recurrence || "", password: "",
      document: data.document || "", paymentMethod: data.paymentMethod || "",
    }));
    setCompanyModalOpen(true);
  };

  const handleOpenCreateModal = () => { resetRecord(); setCompanyModalOpen(true); };

  const handleToggleBulkSelection = () => { setBulkSelectionEnabled((prev) => !prev); setSelectedIds([]); };

  const handleToggleSelect = (id) => {
    if (Number(id) === PROTECTED_COMPANY_ID) return;
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const handleToggleSelectAll = () => {
    const selectableIds = filteredRecords.filter((c) => Number(c.id) !== PROTECTED_COMPANY_ID).map((c) => c.id);
    if (selectedIds.length === selectableIds.length) { setSelectedIds([]); return; }
    setSelectedIds(selectableIds);
  };

  const handleOpenInvoices = async (company) => {
    setInvoiceCompanyId(company.id || null);
    setInvoiceCompanyName(company.name || "");
    setInvoicesLoading(true);
    setInvoicesModalOpen(true);
    setInvoicesPage(1);
    try {
      const invoices = await fetchInvoicesByCompany(company.id);
      setOpenInvoices(sortInvoicesByMostRecent(invoices || []));
    } catch (e) {
      setOpenInvoices([]);
      toast.error("Não foi possível carregar as faturas da empresa.");
    } finally {
      setInvoicesLoading(false);
    }
  };

  const handleCloseInvoicesModal = () => {
    setInvoicesModalOpen(false); setInvoicesLoading(false);
    setInvoiceActionLoadingId(null); setInvoicesPage(1);
    setInvoiceCompanyName(""); setInvoiceCompanyId(null); setOpenInvoices([]);
  };

  const refreshOpenInvoices = async () => {
    if (!invoiceCompanyId) return;
    const invoices = await fetchInvoicesByCompany(invoiceCompanyId);
    const sortedInvoices = sortInvoicesByMostRecent(invoices || []);
    setOpenInvoices(sortedInvoices);
    setInvoicesPage((prevPage) => {
      const totalPages = Math.max(1, Math.ceil(sortedInvoices.length / INVOICES_PER_PAGE));
      return Math.min(prevPage, totalPages);
    });
  };

  const handleMarkInvoiceAsPaid = async (invoice) => {
    setInvoiceActionLoadingId(`paid-${invoice.id}`);
    try {
      await api.put(`/invoices/${invoice.id}`, { id: invoice.id, status: "paid", dueDate: invoice.dueDate });
      await refreshOpenInvoices();
      toast.success(`Fatura #${invoice.id} marcada como paga.`);
    } catch (error) {
      toast.error("Não foi possível marcar a fatura como paga.");
    } finally {
      setInvoiceActionLoadingId(null);
    }
  };

  const handleDeleteInvoice = async (invoice) => {
    const confirmed = window.confirm(`Deseja excluir a fatura #${invoice.id}?`);
    if (!confirmed) return;
    setInvoiceActionLoadingId(`delete-${invoice.id}`);
    try {
      await api.delete(`/invoices/${invoice.id}`);
      await refreshOpenInvoices();
      toast.success(`Fatura #${invoice.id} excluída com sucesso.`);
    } catch (error) {
      toast.error("Não foi possível excluir a fatura.");
    } finally {
      setInvoiceActionLoadingId(null);
    }
  };

  const handleOpenDetails = (company) => {
    setDetailsCompany(company);
    setDetailsModalOpen(true);
    api.get(`/companies/${company.id}`)
      .then(({ data }) => { if (data && typeof data === "object") setDetailsCompany((prev) => ({ ...prev, ...data })); })
      .catch(() => {});
  };

  const handleCloseDetails = () => { setDetailsModalOpen(false); setDetailsCompany(null); };

  const handleAddOneMonth = async (company) => {
    setLoading(true);
    try {
      const currentDueDate = moment(company.dueDate).isValid() ? moment(company.dueDate) : moment();
      const updatedDueDate = currentDueDate.clone().add(1, "month").format("YYYY-MM-DD");
      await update({
        id: company.id, name: company.name || "", email: company.email || "",
        phone: company.phone || "", planId: company.planId, status: company.status,
        dueDate: updatedDueDate, recurrence: company.recurrence || "MENSAL",
        document: company.document || "", paymentMethod: company.paymentMethod || ""
      });
      const invoicesResponse = await api.get("/invoices/all", { params: { companyId: company.id } });
      const pendingInvoices = (invoicesResponse.data || []).filter((inv) => inv.status !== "paid");
      const sameDueDateInvoices = pendingInvoices.filter((inv) => moment(inv.dueDate).isSame(currentDueDate, "day"));
      const invoicesToUpdate = sameDueDateInvoices.length ? sameDueDateInvoices : pendingInvoices.slice(0, 1);
      if (invoicesToUpdate.length > 0) {
        await Promise.all(invoicesToUpdate.map((inv) => api.put(`/invoices/${inv.id}`, { id: inv.id, status: inv.status || "open", dueDate: updatedDueDate })));
      }
      toast.success(`Vencimento de ${company.name} atualizado para ${moment(updatedDueDate).format("DD/MM/YYYY")}.`);
      await loadPlans();
    } catch (e) {
      toast.error("Não foi possível adicionar 1 mês ao vencimento.");
    }
    setLoading(false);
  };

  const handleOpenMasterAccess = (company) => {
    setMasterAccessEmail(company?.email || "");
    setMasterAccessPassword("");
    setMasterAccessModalOpen(true);
  };

  const handleShowStorageUsage = async (company) => {
    setStorageCompanyName(company.name || "");
    setStorageUsage(null);
    setStorageLoading(true);
    setStorageModalOpen(true);
    try {
      const usage = await getStorageUsage(company.id);
      setStorageUsage(usage || null);
    } catch (error) {
      setStorageUsage({ gb: Number(company?.folderSize || 0), bytes: 0 });
      toast.error("Não foi possível consultar o armazenamento em tempo real. Exibindo valor do cadastro.");
    } finally {
      setStorageLoading(false);
    }
  };

  const handleOpenStats = async (company) => {
    setStatsCompany(company);
    setStatsData(null);
    setStatsLoading(true);
    setStatsModalOpen(true);
    try {
      const data = await fetchCompanyStats(company.id);
      setStatsData(data);
    } catch {
      setStatsData(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleCloseStats = () => {
    setStatsModalOpen(false);
    setStatsCompany(null);
    setStatsData(null);
    setStatsLoading(false);
  };

  const handleRefreshStats = async () => {
    if (!statsCompany) return;
    setStatsLoading(true);
    try {
      const data = await fetchCompanyStats(statsCompany.id);
      setStatsData(data);
    } catch {
      setStatsData(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleOpenUsers = async (company) => {
    setUsersCompany(company);
    setCompanyUsers([]);
    setUsersPage(1);
    setUsersLoading(true);
    setUsersModalOpen(true);
    try {
      const { data } = await api.get("/users/list", { params: { companyId: company.id } });
      const list = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
      setCompanyUsers(list);
    } catch {
      toast.error("Não foi possível carregar os usuários da empresa.");
    } finally {
      setUsersLoading(false);
    }
  };

  const handleCloseUsers = () => {
    setUsersModalOpen(false);
    setUsersCompany(null);
    setCompanyUsers([]);
    setUsersPage(1);
  };

  const handleOpenConnections = async (company) => {
    setConnectionsCompany(company);
    setCompanyConnections([]);
    setConnectionsPage(1);
    setConnectionsLoading(true);
    setConnectionsModalOpen(true);
    try {
      const { data } = await api.get("/whatsapp/all", { params: { session: 0 } });
      const list = Array.isArray(data)
        ? data.filter((item) => Number(item?.companyId) === Number(company.id))
        : [];
      setCompanyConnections(list);
    } catch {
      toast.error("Não foi possível carregar as conexões da empresa.");
    } finally {
      setConnectionsLoading(false);
    }
  };

  const handleCloseConnections = () => {
    setConnectionsModalOpen(false);
    setConnectionsCompany(null);
    setCompanyConnections([]);
    setConnectionsPage(1);
  };

  const handleRestartConnection = async (conn) => {
    setConnectionRestartingId(conn.id);
    try {
      await api.put(`/whatsappsession/${conn.id}`);
      toast.success(`Conexão "${conn.name}" reiniciada com sucesso.`);
    } catch {
      toast.error("Não foi possível reiniciar a conexão.");
    } finally {
      setConnectionRestartingId(null);
    }
  };

  const handleOpenConnectionEdit = (conn) => {
    setSelectedConnection(conn);
    setWhatsAppEditOpen(true);
  };

  const handleCloseConnectionEdit = () => {
    setWhatsAppEditOpen(false);
    setSelectedConnection(null);
  };

  const handleOpenChangePassword = (user) => {
    setChangePasswordUser(user);
    setChangePasswordValue("");
    setChangePasswordModalOpen(true);
  };

  const handleCloseChangePassword = () => {
    setChangePasswordModalOpen(false);
    setChangePasswordUser(null);
    setChangePasswordValue("");
  };

  const handleSubmitChangePassword = async () => {
    if (!changePasswordValue || changePasswordValue.trim().length < 5) {
      toast.error("A senha deve ter pelo menos 5 caracteres.");
      return;
    }
    setChangePasswordLoading(true);
    try {
      await api.put(`/users/${changePasswordUser.id}`, { password: changePasswordValue.trim() });
      toast.success(`Senha de ${changePasswordUser.name} alterada com sucesso.`);
      handleCloseChangePassword();
    } catch {
      toast.error("Não foi possível alterar a senha do usuário.");
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleCloseStorageModal = () => { setStorageModalOpen(false); setStorageLoading(false); setStorageCompanyName(""); setStorageUsage(null); };
  const handleCloseMasterAccess = () => { setMasterAccessModalOpen(false); setMasterAccessPassword(""); };

  const handleMasterAccessSubmit = async () => {
    if (!masterAccessEmail || !masterAccessPassword) {
      toast.error("Informe o e-mail da empresa e a senha master.");
      return;
    }
    setMasterAccessLoading(true);
    await handleLogin({ email: masterAccessEmail.trim(), password: masterAccessPassword });
    setMasterAccessLoading(false);
  };

  const filteredRecords = records.filter((company) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchesSearch = !normalizedSearch ||
      (company.name || "").toLowerCase().includes(normalizedSearch) ||
      (company.email || "").toLowerCase().includes(normalizedSearch) ||
      String(company.id || "").includes(normalizedSearch);
    if (!matchesSearch) return false;
    if (dueFilter === "all") return true;
    if (!company.dueDate || !moment(company.dueDate).isValid()) return false;
    const isExpired = moment(company.dueDate).endOf("day").isBefore(moment());
    return dueFilter === "expired" ? isExpired : !isExpired;
  });

  const totalInvoicePages = Math.max(1, Math.ceil(openInvoices.length / INVOICES_PER_PAGE));
  const safeInvoicesPage = Math.min(invoicesPage, totalInvoicePages);
  const startInvoiceIndex = (safeInvoicesPage - 1) * INVOICES_PER_PAGE;
  const paginatedInvoices = openInvoices.slice(startInvoiceIndex, startInvoiceIndex + INVOICES_PER_PAGE);
  const visibleInvoicePages = buildVisiblePages(safeInvoicesPage, totalInvoicePages);

  const totalUsersPages = Math.max(1, Math.ceil(companyUsers.length / USERS_PER_PAGE));
  const safeUsersPage = Math.min(usersPage, totalUsersPages);
  const startUsersIndex = (safeUsersPage - 1) * USERS_PER_PAGE;
  const paginatedUsers = companyUsers.slice(startUsersIndex, startUsersIndex + USERS_PER_PAGE);
  const visibleUsersPages = buildVisiblePages(safeUsersPage, totalUsersPages);

  const totalConnectionsPages = Math.max(1, Math.ceil(companyConnections.length / CONNECTIONS_PER_PAGE));
  const safeConnectionsPage = Math.min(connectionsPage, totalConnectionsPages);
  const startConnectionsIndex = (safeConnectionsPage - 1) * CONNECTIONS_PER_PAGE;
  const paginatedConnections = companyConnections.slice(startConnectionsIndex, startConnectionsIndex + CONNECTIONS_PER_PAGE);
  const visibleConnectionsPages = buildVisiblePages(safeConnectionsPage, totalConnectionsPages);

  useEffect(() => {
    setSelectedIds((prev) => {
      const visibleIds = new Set(filteredRecords.map((c) => c.id));
      const next = prev.filter((id) => visibleIds.has(id) && Number(id) !== PROTECTED_COMPANY_ID);
      return next.length === prev.length ? prev : next;
    });
  }, [filteredRecords]);

  return (
    <Paper className={classes.mainPaper} elevation={0}>
      {/* Master Password Card */}
      <Box className={classes.masterCard}>
        <Box className={classes.masterCardIcon}>
          <LockIcon />
        </Box>
        <Box className={classes.masterCardBody}>
          <Typography className={classes.masterCardTitle}>Senha master de acesso</Typography>
          <Typography className={classes.masterCardSubtitle}>
            Define a senha global usada para entrar em qualquer empresa do sistema.
          </Typography>
          <Box className={classes.masterCardControls}>
            <TextField
              label="Senha master"
              type="password"
              variant="outlined"
              size="small"
              value={masterPasswordInput}
              onChange={(e) => setMasterPasswordInput(e.target.value)}
              className={classes.masterCardInput}
              autoComplete="new-password"
            />
            <ButtonWithSpinner
              loading={masterPasswordSaving}
              onClick={handleSaveMasterPassword}
              variant="contained"
              color="primary"
              classes={{ root: classes.btnPrimary }}
            >
              Salvar senha
            </ButtonWithSpinner>
          </Box>
          <Box className={classes.masterCardStatus}>
            {masterPasswordConfigured
              ? <><CheckCircleIcon style={{ fontSize: 12, color: "#059669" }} /> Senha configurada</>
              : <><CancelIcon style={{ fontSize: 12, color: "#dc2626" }} /> Senha não configurada</>
            }
          </Box>
        </Box>
      </Box>

      {/* Toolbar */}
      <Box className={classes.toolbar}>
        <Box className={classes.toolbarLeft}>
          <Typography className={classes.toolbarTitle}>Empresas cadastradas</Typography>
          <Typography className={classes.toolbarMeta}>
            {filteredRecords.length} de {records.length} empresa{records.length !== 1 ? "s" : ""}
          </Typography>
        </Box>
        <Box className={classes.toolbarRight}>
          <TextField
            placeholder="Buscar por nome ou e-mail…"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={classes.searchInput}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon style={{ fontSize: 16, opacity: 0.5 }} />
                </InputAdornment>
              ),
            }}
          />

          <FormControl variant="outlined" size="small" className={classes.filterSelect}>
            <InputLabel id="company-due-filter-label">Filtro</InputLabel>
            <Select
              labelId="company-due-filter-label"
              value={dueFilter}
              onChange={(e) => setDueFilter(e.target.value)}
              label="Filtro"
            >
              <MenuItem value="all">Todas empresas</MenuItem>
              <MenuItem value="expired">Vencidas</MenuItem>
              <MenuItem value="active">Não vencidas</MenuItem>
            </Select>
          </FormControl>

          <Button
            onClick={handleToggleBulkSelection}
            variant="outlined"
            classes={{ root: classes.btnOutlined }}
            startIcon={bulkSelectionEnabled ? <LayersClearIcon style={{ fontSize: 15 }} /> : <FilterListIcon style={{ fontSize: 15 }} />}
          >
            {bulkSelectionEnabled ? "Cancelar seleção" : "Selecionar"}
          </Button>

          {bulkSelectionEnabled && selectedIds.length > 0 && (
            <Button
              onClick={() => handleOpenDeleteDialog(selectedIds, `${selectedIds.length} empresas selecionadas`)}
              classes={{ root: classes.btnDanger }}
              startIcon={loading ? <CircularProgress size={14} /> : <DeleteSweepIcon style={{ fontSize: 15 }} />}
              disabled={loading}
            >
              Excluir ({selectedIds.length})
            </Button>
          )}

          <Button
            onClick={handleOpenCreateModal}
            variant="contained"
            color="primary"
            classes={{ root: classes.btnPrimary }}
            startIcon={<AddIcon style={{ fontSize: 16 }} />}
          >
            Nova empresa
          </Button>
        </Box>
      </Box>

      {/* Table */}
      <CompaniesManagerGrid
        records={filteredRecords}
        onSelect={handleSelect}
        onRequestDelete={handleOpenDeleteDialog}
        onOpenInvoices={handleOpenInvoices}
        onAddOneMonth={handleAddOneMonth}
        onOpenDetails={handleOpenDetails}
        onOpenMasterAccess={handleOpenMasterAccess}
        onShowStorageUsage={handleShowStorageUsage}
        onOpenStats={handleOpenStats}
        onOpenUsers={handleOpenUsers}
        onOpenConnections={handleOpenConnections}
        bulkSelectionEnabled={bulkSelectionEnabled}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        isCompanyProtected={(company) => Number(company?.id) === PROTECTED_COMPANY_ID}
      />

      {/* Company Create/Edit Dialog */}
      <Dialog
        open={companyModalOpen}
        onClose={handleCancel}
        fullWidth
        fullScreen={isMobile}
        maxWidth="md"
        classes={{ paper: isMobile ? undefined : classes.dialogPaper }}
      >
        <Box className={classes.dialogHeader}>
          <Box className={classes.dialogHeaderIcon}>
            <BusinessIcon />
          </Box>
          <Box className={classes.dialogHeaderText}>
            <Typography className={classes.dialogTitle}>
              {record.id ? "Editar empresa" : "Cadastrar nova empresa"}
            </Typography>
            <Typography className={classes.dialogSubtitle}>
              Preencha os dados para gerenciar plano, vencimento e status da empresa.
            </Typography>
          </Box>
          {isMobile && (
            <IconButton size="small" onClick={handleCancel} style={{ marginLeft: "auto" }}>
              <CancelIcon style={{ fontSize: 20, opacity: 0.5 }} />
            </IconButton>
          )}
        </Box>
        <DialogContent className={classes.dialogContent}>
          <CompanyForm
            initialValue={record}
            onDelete={handleOpenDeleteDialog}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
            canDelete={Number(record?.id) !== PROTECTED_COMPANY_ID}
            cancelLabel="Fechar"
          />
        </DialogContent>
      </Dialog>

      {/* Invoices Dialog */}
      <Dialog
        open={invoicesModalOpen}
        onClose={handleCloseInvoicesModal}
        fullWidth
        fullScreen={isMobile}
        maxWidth="md"
        classes={{ paper: isMobile ? undefined : classes.dialogPaper }}
      >
        <Box className={classes.dialogHeader}>
          <Box className={classes.dialogHeaderIcon}>
            <MonetizationOnIcon />
          </Box>
          <Box className={classes.dialogHeaderText}>
            <Typography className={classes.dialogTitle}>
              Faturas — {invoiceCompanyName || "Empresa"}
            </Typography>
            <Typography className={classes.dialogSubtitle}>
              {openInvoices.length > 0 ? `${openInvoices.length} fatura(s) encontrada(s)` : "Histórico de cobranças desta empresa"}
            </Typography>
          </Box>
          {isMobile && (
            <IconButton size="small" onClick={handleCloseInvoicesModal} style={{ marginLeft: "auto" }}>
              <CancelIcon style={{ fontSize: 20, opacity: 0.5 }} />
            </IconButton>
          )}
        </Box>
        <DialogContent className={classes.dialogContent}>
          {invoicesLoading ? (
            <Box className={classes.loadingState}>
              <CircularProgress size={28} />
            </Box>
          ) : openInvoices.length === 0 ? (
            <Box className={classes.emptyState}>
              <MonetizationOnIcon style={{ fontSize: 36, opacity: 0.25, marginBottom: 8 }} />
              <Typography variant="body2">Nenhuma fatura encontrada para esta empresa.</Typography>
            </Box>
          ) : (
            <Box>
              <Box className={classes.invoicesTableWrap}>
                <Table size="small" className={classes.invoicesTable}>
                  <TableHead className={classes.tableHead}>
                    <TableRow>
                      <TableCell align="center"># ID</TableCell>
                      <TableCell align="left">Plano</TableCell>
                      <TableCell align="right">Valor</TableCell>
                      <TableCell align="center">Vencimento</TableCell>
                      <TableCell align="center">Status</TableCell>
                      <TableCell align="center">Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody className={classes.tableBody}>
                    {paginatedInvoices.map((invoice) => {
                      const isOverdue = moment(invoice.dueDate).endOf("day").isBefore(moment());
                      const isMarkPaidLoading = invoiceActionLoadingId === `paid-${invoice.id}`;
                      const isDeleteLoading = invoiceActionLoadingId === `delete-${invoice.id}`;
                      const isRowLoading = Boolean(invoiceActionLoadingId) && (isMarkPaidLoading || isDeleteLoading);
                      const isPaid = invoice.status === "paid";

                      return (
                        <TableRow key={invoice.id} className={classes.rowNormal}>
                          <TableCell align="center" style={{ fontWeight: 600, fontSize: "0.78rem" }}>#{invoice.id}</TableCell>
                          <TableCell align="left" style={{ fontSize: "0.82rem" }}>{invoice.detail || "Fatura"}</TableCell>
                          <TableCell align="right" style={{ fontWeight: 600, fontSize: "0.82rem" }}>
                            {Number(invoice.value || 0).toLocaleString("pt-br", { style: "currency", currency: "BRL" })}
                          </TableCell>
                          <TableCell align="center" style={{ fontSize: "0.78rem" }}>
                            {moment(invoice.dueDate).format("DD/MM/YYYY")}
                          </TableCell>
                          <TableCell align="center">
                            <span className={`${classes.badge} ${isPaid ? classes.badgePaid : isOverdue ? classes.badgeOverdue : classes.badgeOpen}`}>
                              {isPaid ? "Pago" : isOverdue ? "Vencida" : "Em aberto"}
                            </span>
                          </TableCell>
                          <TableCell align="center" style={{ whiteSpace: "nowrap" }}>
                            <Tooltip title={isPaid ? "Fatura já está paga" : "Marcar como paga"} arrow>
                              <span>
                                <IconButton
                                  size="small"
                                  className={classes.actionBtn}
                                  onClick={() => handleMarkInvoiceAsPaid(invoice)}
                                  disabled={isRowLoading || isPaid}
                                >
                                  {isMarkPaidLoading ? <CircularProgress size={14} /> : <AttachMoneyIcon style={{ fontSize: 15 }} />}
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Excluir fatura" arrow>
                              <span>
                                <IconButton
                                  size="small"
                                  className={classes.actionBtnDanger}
                                  onClick={() => handleDeleteInvoice(invoice)}
                                  disabled={isRowLoading}
                                >
                                  {isDeleteLoading ? <CircularProgress size={14} /> : <DeleteOutlineIcon style={{ fontSize: 15 }} />}
                                </IconButton>
                              </span>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>

              <Box className={classes.invoicesPaginationRow}>
                <Typography variant="caption" color="textSecondary">
                  Página {safeInvoicesPage} de {totalInvoicePages} · {openInvoices.length} fatura(s)
                </Typography>
                <Box className={classes.invoicesPaginationPages}>
                  <Button
                    size="small"
                    className={classes.paginationBtn}
                    onClick={() => setInvoicesPage((prev) => Math.max(1, prev - 1))}
                    disabled={safeInvoicesPage === 1}
                  >
                    ← Anterior
                  </Button>
                  {visibleInvoicePages[0] > 1 && (
                    <>
                      <Button size="small" className={`${classes.paginationBtn} ${safeInvoicesPage === 1 ? classes.paginationBtnActive : ""}`} onClick={() => setInvoicesPage(1)}>1</Button>
                      {visibleInvoicePages[0] > 2 && <Typography variant="caption" color="textSecondary" style={{ padding: "0 2px" }}>…</Typography>}
                    </>
                  )}
                  {visibleInvoicePages.map((page) => (
                    <Button
                      key={page}
                      size="small"
                      className={`${classes.paginationBtn} ${safeInvoicesPage === page ? classes.paginationBtnActive : ""}`}
                      onClick={() => setInvoicesPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  {visibleInvoicePages[visibleInvoicePages.length - 1] < totalInvoicePages && (
                    <>
                      {visibleInvoicePages[visibleInvoicePages.length - 1] < totalInvoicePages - 1 && <Typography variant="caption" color="textSecondary" style={{ padding: "0 2px" }}>…</Typography>}
                      <Button size="small" className={`${classes.paginationBtn} ${safeInvoicesPage === totalInvoicePages ? classes.paginationBtnActive : ""}`} onClick={() => setInvoicesPage(totalInvoicePages)}>{totalInvoicePages}</Button>
                    </>
                  )}
                  <Button
                    size="small"
                    className={classes.paginationBtn}
                    onClick={() => setInvoicesPage((prev) => Math.min(totalInvoicePages, prev + 1))}
                    disabled={safeInvoicesPage === totalInvoicePages}
                  >
                    Próxima →
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <Box className={classes.dialogActions} display="flex" justifyContent="flex-end">
          <Button onClick={handleCloseInvoicesModal} variant="outlined" classes={{ root: classes.btnOutlined }}>
            Fechar
          </Button>
        </Box>
      </Dialog>

      {/* Storage Dialog */}
      <Dialog
        open={storageModalOpen}
        onClose={handleCloseStorageModal}
        fullWidth
        fullScreen={isMobile}
        maxWidth="sm"
        classes={{ paper: isMobile ? undefined : classes.dialogPaperSm }}
      >
        <Box className={classes.dialogHeader}>
          <Box className={classes.dialogHeaderIcon}>
            <StorageIcon />
          </Box>
          <Box className={classes.dialogHeaderText}>
            <Typography className={classes.dialogTitle}>
              Armazenamento — {storageCompanyName || "Empresa"}
            </Typography>
            <Typography className={classes.dialogSubtitle}>
              Volume total de arquivos desta empresa.
            </Typography>
          </Box>
          {isMobile && (
            <IconButton size="small" onClick={handleCloseStorageModal} style={{ marginLeft: "auto" }}>
              <CancelIcon style={{ fontSize: 20, opacity: 0.5 }} />
            </IconButton>
          )}
        </Box>
        <DialogContent className={classes.dialogContent}>
          {storageLoading ? (
            <Box className={classes.loadingState}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Box>
              {/* Hero card */}
              <Box style={{
                background: "linear-gradient(135deg, #1e40af 0%, #6d28d9 100%)",
                borderRadius: 16,
                padding: "20px 24px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 16,
                boxShadow: "0 6px 28px rgba(109,40,217,0.22)",
              }}>
                <Box style={{
                  width: 54,
                  height: 54,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <StorageIcon style={{ fontSize: 30, color: "white" }} />
                </Box>
                <Box>
                  <Typography style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                    Total utilizado
                  </Typography>
                  <Typography style={{ color: "white", fontSize: "2.1rem", fontWeight: 800, lineHeight: 1 }}>
                    {Number(storageUsage?.gb || 0).toLocaleString("pt-br", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    <span style={{ fontSize: "1rem", fontWeight: 600, opacity: 0.75, marginLeft: 7 }}>GB</span>
                  </Typography>
                </Box>
              </Box>

              {/* Breakdown grid */}
              <Typography className={classes.statsSectionTitle} style={{ marginTop: 0 }}>Detalhamento</Typography>
              <Box className={classes.statsGrid2}>
                {[
                  {
                    label: "Megabytes (MB)",
                    value: Number((storageUsage?.gb || 0) * 1024).toLocaleString("pt-br", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " MB",
                    bg: "#eff6ff",
                    color: "#1d4ed8",
                    border: "#bfdbfe",
                  },
                  {
                    label: "Equivale a",
                    value: (() => {
                      const mb = (storageUsage?.gb || 0) * 1024;
                      if (mb >= 1024) return `${Number(storageUsage?.gb || 0).toLocaleString("pt-br", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`;
                      if (mb >= 1) return `${Number(mb).toLocaleString("pt-br", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;
                      return `${Number(mb * 1024).toLocaleString("pt-br", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} KB`;
                    })(),
                    bg: "#fff7ed",
                    color: "#ea580c",
                    border: "#fed7aa",
                  },
                ].map(({ label, value, bg, color, border }) => (
                  <Box key={label} className={classes.statCard} style={{ background: bg, borderColor: border, border: `1px solid ${border}` }}>
                    <Typography className={classes.statCardLabel} style={{ color }}>{label}</Typography>
                    <Typography className={classes.statCardValue} style={{ color, fontSize: "1rem", wordBreak: "break-all" }}>
                      {value}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <Box className={classes.dialogActions} display="flex" justifyContent="flex-end">
          <Button onClick={handleCloseStorageModal} variant="outlined" classes={{ root: classes.btnOutlined }}>
            Fechar
          </Button>
        </Box>
      </Dialog>

      {/* Master Access Dialog */}
      <Dialog
        open={masterAccessModalOpen}
        onClose={handleCloseMasterAccess}
        fullWidth
        fullScreen={isMobile}
        maxWidth="xs"
        classes={{ paper: isMobile ? undefined : classes.dialogPaperSm }}
      >
        <Box className={classes.dialogHeader}>
          <Box className={classes.dialogHeaderIcon}>
            <VpnKeyIcon />
          </Box>
          <Box className={classes.dialogHeaderText}>
            <Typography className={classes.dialogTitle}>Acesso com senha master</Typography>
            <Typography className={classes.dialogSubtitle}>
              Informe o e-mail da empresa e a senha master global.
            </Typography>
          </Box>
          {isMobile && (
            <IconButton size="small" onClick={handleCloseMasterAccess} style={{ marginLeft: "auto" }}>
              <CancelIcon style={{ fontSize: 20, opacity: 0.5 }} />
            </IconButton>
          )}
        </Box>
        <DialogContent className={classes.dialogContent}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="E-mail da empresa"
                value={masterAccessEmail}
                onChange={(e) => setMasterAccessEmail(e.target.value)}
                variant="outlined"
                fullWidth
                size="small"
                className={classes.inputField}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Senha master"
                value={masterAccessPassword}
                onChange={(e) => setMasterAccessPassword(e.target.value)}
                variant="outlined"
                fullWidth
                size="small"
                type="password"
                autoComplete="new-password"
                className={classes.inputField}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <Box className={classes.dialogActions} display="flex" justifyContent="flex-end" style={{ gap: 8 }}>
          <Button onClick={handleCloseMasterAccess} variant="outlined" classes={{ root: classes.btnOutlined }}>
            Cancelar
          </Button>
          <ButtonWithSpinner
            loading={masterAccessLoading}
            onClick={handleMasterAccessSubmit}
            variant="contained"
            color="primary"
            classes={{ root: classes.btnPrimary }}
          >
            Entrar na conta
          </ButtonWithSpinner>
        </Box>
      </Dialog>

      {/* Details Dialog */}
      <Dialog
        open={detailsModalOpen}
        onClose={handleCloseDetails}
        fullWidth
        fullScreen={isMobile}
        maxWidth="sm"
        classes={{ paper: isMobile ? undefined : classes.dialogPaperSm }}
      >
        <Box className={classes.dialogHeader}>
          <Box className={classes.dialogHeaderIcon}>
            <VisibilityOutlinedIcon />
          </Box>
          <Box className={classes.dialogHeaderText}>
            <Typography className={classes.dialogTitle}>
              {detailsCompany?.name || "Detalhes da empresa"}
            </Typography>
            <Typography className={classes.dialogSubtitle}>
              Resumo rápido sem editar o cadastro.
            </Typography>
          </Box>
          {isMobile && (
            <IconButton size="small" onClick={handleCloseDetails} style={{ marginLeft: "auto" }}>
              <CancelIcon style={{ fontSize: 20, opacity: 0.5 }} />
            </IconButton>
          )}
        </Box>
        <DialogContent className={classes.dialogContent}>
          {detailsCompany && (
            <Box className={classes.detailGrid}>
              {[
                { label: "ID", value: detailsCompany.id },
                { label: "Nome", value: detailsCompany.name || "—" },
                { label: "E-mail", value: detailsCompany.email || "—" },
                { label: "Telefone", value: detailsCompany.phone || "—" },
                { label: "Plano", value: detailsCompany?.plan?.name || "—" },
                { label: "Status", value: detailsCompany.status ? "Ativa" : "Inativa" },
                { label: "Criada em", value: dateToClient(detailsCompany.createdAt) },
                { label: "Vencimento", value: dateToClient(detailsCompany.dueDate) },
                { label: "Recorrência", value: detailsCompany.recurrence || "—" },
                { label: "Último login", value: datetimeToClient(detailsCompany.lastLogin) },
              ].map(({ label, value }) => (
                <Box key={label} className={classes.detailItem}>
                  <Typography className={classes.detailLabel}>{label}</Typography>
                  <Typography className={classes.detailValue}>{value}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <Box className={classes.dialogActions} display="flex" justifyContent="flex-end">
          <Button onClick={handleCloseDetails} variant="outlined" classes={{ root: classes.btnOutlined }}>
            Fechar
          </Button>
        </Box>
      </Dialog>

      {/* Stats Dialog */}
      <Dialog
        open={statsModalOpen}
        onClose={handleCloseStats}
        fullWidth
        fullScreen={isMobile}
        maxWidth="sm"
        classes={{ paper: isMobile ? undefined : classes.dialogPaperSm }}
      >
        <Box className={classes.dialogHeader}>
          <Box className={classes.dialogHeaderIcon}>
            <AssessmentIcon />
          </Box>
          <Box className={classes.dialogHeaderText}>
            <Typography className={classes.dialogTitle}>
              Estatísticas — {statsCompany?.name || "Empresa"}
            </Typography>
            <Typography className={classes.dialogSubtitle}>
              Totais de uso desta empresa.
            </Typography>
          </Box>
          {isMobile && (
            <IconButton size="small" onClick={handleCloseStats} style={{ marginLeft: "auto" }}>
              <CancelIcon style={{ fontSize: 20, opacity: 0.5 }} />
            </IconButton>
          )}
        </Box>
        <DialogContent className={classes.dialogContent}>
          {statsLoading ? (
            <Box className={classes.loadingState}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Box>
              <Typography className={classes.statsSectionTitle} style={{ marginTop: 0 }}>Visão geral</Typography>
              <Box className={classes.statsGrid4}>
                {[
                  { label: "Contatos", value: statsData?.contacts, bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
                  { label: "Usuários", value: statsData?.users, bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
                  { label: "Canais", value: statsData?.channels, bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
                  { label: "Mensagens", value: statsData?.messages, bg: "#fff7ed", color: "#ea580c", border: "#fed7aa" },
                ].map(({ label, value, bg, color, border }) => (
                  <Box key={label} className={classes.statCard} style={{ background: bg, borderColor: border }}>
                    <Typography className={classes.statCardLabel} style={{ color }}>{label}</Typography>
                    <Typography className={classes.statCardValue} style={{ color }}>
                      {value !== null && value !== undefined ? Number(value).toLocaleString("pt-br") : "—"}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Typography className={classes.statsSectionTitle}>Tickets</Typography>
              <Box className={classes.statsGrid4}>
                {[
                  { label: "Total", value: statsData?.tickets?.total, bg: "#f8fafc", color: "#334155", border: "#e2e8f0" },
                  { label: "Abertos", value: statsData?.tickets?.open, bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
                  { label: "Pendentes", value: statsData?.tickets?.pending, bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
                  { label: "Fechados", value: statsData?.tickets?.closed, bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
                ].map(({ label, value, bg, color, border }) => (
                  <Box key={label} className={classes.statCard} style={{ background: bg, borderColor: border }}>
                    <Typography className={classes.statCardLabel} style={{ color }}>{label}</Typography>
                    <Typography className={classes.statCardValue} style={{ color }}>
                      {value !== null && value !== undefined ? Number(value).toLocaleString("pt-br") : "—"}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Typography className={classes.statsSectionTitle}>Faturas</Typography>
              <Box className={classes.statsGrid2}>
                {[
                  { label: "Pagas no total", value: statsData?.invoices?.paidValue, bg: "#ecfdf5", color: "#059669", border: "#6ee7b7" },
                  { label: "Em aberto", value: statsData?.invoices?.openValue, bg: "#fff7ed", color: "#ea580c", border: "#fed7aa" },
                ].map(({ label, value, bg, color, border }) => (
                  <Box key={label} className={classes.statCard} style={{ background: bg, borderColor: border }}>
                    <Typography className={classes.statCardLabel} style={{ color }}>{label}</Typography>
                    <Typography className={classes.statCardValue} style={{ color }}>
                      {value !== null && value !== undefined
                        ? Number(value).toLocaleString("pt-br", { style: "currency", currency: "BRL" })
                        : "—"}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <Box className={classes.dialogActions} display="flex" justifyContent="flex-end" style={{ gap: 8 }}>
          <Button onClick={handleCloseStats} variant="outlined" classes={{ root: classes.btnOutlined }}>
            Fechar
          </Button>
          <ButtonWithSpinner
            loading={statsLoading}
            onClick={handleRefreshStats}
            variant="contained"
            color="primary"
            classes={{ root: classes.btnPrimary }}
            startIcon={<RefreshIcon style={{ fontSize: 15 }} />}
          >
            Atualizar
          </ButtonWithSpinner>
        </Box>
      </Dialog>

      {/* Users Dialog */}
      <Dialog
        open={usersModalOpen}
        onClose={handleCloseUsers}
        fullWidth
        fullScreen={isMobile}
        maxWidth="md"
        classes={{ paper: isMobile ? undefined : classes.dialogPaper }}
      >
        <Box className={classes.dialogHeader}>
          <Box className={classes.dialogHeaderIcon}>
            <PeopleIcon />
          </Box>
          <Box className={classes.dialogHeaderText}>
            <Typography className={classes.dialogTitle}>
              Usuários — {usersCompany?.name || "Empresa"}
            </Typography>
            <Typography className={classes.dialogSubtitle}>
              {companyUsers.length > 0 ? `${companyUsers.length} usuário(s) encontrado(s)` : "Lista de usuários desta empresa"}
            </Typography>
          </Box>
          {isMobile && (
            <IconButton size="small" onClick={handleCloseUsers} style={{ marginLeft: "auto" }}>
              <CancelIcon style={{ fontSize: 20, opacity: 0.5 }} />
            </IconButton>
          )}
        </Box>
        <DialogContent className={classes.dialogContent}>
          {usersLoading ? (
            <Box className={classes.loadingState}>
              <CircularProgress size={28} />
            </Box>
          ) : companyUsers.length === 0 ? (
            <Box className={classes.emptyState}>
              <PeopleIcon style={{ fontSize: 36, opacity: 0.25, marginBottom: 8 }} />
              <Typography variant="body2">Nenhum usuário encontrado para esta empresa.</Typography>
            </Box>
          ) : (
            <Box>
              <Box className={classes.invoicesTableWrap}>
                <Table size="small" className={classes.invoicesTable}>
                  <TableHead className={classes.tableHead}>
                    <TableRow>
                      <TableCell align="center">Status</TableCell>
                      <TableCell align="left">Nome</TableCell>
                      <TableCell align="left">E-mail</TableCell>
                      <TableCell align="center">Perfil</TableCell>
                      <TableCell align="center">Último Login</TableCell>
                      <TableCell align="center">Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody className={classes.tableBody}>
                    {paginatedUsers.map((user) => (
                      <TableRow key={user.id} className={classes.rowNormal}>
                        <TableCell align="center">
                          <Tooltip title={user.online ? "Online" : "Offline"} arrow>
                            <span style={{
                              display: "inline-block",
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              backgroundColor: user.online ? "#22c55e" : "#ef4444",
                            }} />
                          </Tooltip>
                        </TableCell>
                        <TableCell align="left" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                          {user.name || "—"}
                        </TableCell>
                        <TableCell align="left" style={{ fontSize: "0.78rem", color: "inherit" }}>
                          {user.email || "—"}
                        </TableCell>
                        <TableCell align="center">
                          <span className={`${classes.badge} ${user.profile === "admin" ? classes.badgeActive : classes.badgeOpen}`}>
                            {user.profile === "admin" ? "Admin" : "Usuário"}
                          </span>
                        </TableCell>
                        <TableCell align="center" style={{ fontSize: "0.78rem" }}>
                          {user.lastLogin ? datetimeToClient(user.lastLogin) : "—"}
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Alterar senha" arrow>
                            <IconButton size="small" className={classes.actionBtn} onClick={() => handleOpenChangePassword(user)}>
                              <LockIcon style={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>

              <Box className={classes.invoicesPaginationRow}>
                <Typography variant="caption" color="textSecondary">
                  Página {safeUsersPage} de {totalUsersPages} · {companyUsers.length} usuário(s)
                </Typography>
                <Box className={classes.invoicesPaginationPages}>
                  <Button
                    size="small"
                    className={classes.paginationBtn}
                    onClick={() => setUsersPage((prev) => Math.max(1, prev - 1))}
                    disabled={safeUsersPage === 1}
                  >
                    ← Anterior
                  </Button>
                  {visibleUsersPages[0] > 1 && (
                    <>
                      <Button size="small" className={`${classes.paginationBtn} ${safeUsersPage === 1 ? classes.paginationBtnActive : ""}`} onClick={() => setUsersPage(1)}>1</Button>
                      {visibleUsersPages[0] > 2 && <Typography variant="caption" color="textSecondary" style={{ padding: "0 2px" }}>…</Typography>}
                    </>
                  )}
                  {visibleUsersPages.map((page) => (
                    <Button
                      key={page}
                      size="small"
                      className={`${classes.paginationBtn} ${safeUsersPage === page ? classes.paginationBtnActive : ""}`}
                      onClick={() => setUsersPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  {visibleUsersPages[visibleUsersPages.length - 1] < totalUsersPages && (
                    <>
                      {visibleUsersPages[visibleUsersPages.length - 1] < totalUsersPages - 1 && <Typography variant="caption" color="textSecondary" style={{ padding: "0 2px" }}>…</Typography>}
                      <Button size="small" className={`${classes.paginationBtn} ${safeUsersPage === totalUsersPages ? classes.paginationBtnActive : ""}`} onClick={() => setUsersPage(totalUsersPages)}>{totalUsersPages}</Button>
                    </>
                  )}
                  <Button
                    size="small"
                    className={classes.paginationBtn}
                    onClick={() => setUsersPage((prev) => Math.min(totalUsersPages, prev + 1))}
                    disabled={safeUsersPage === totalUsersPages}
                  >
                    Próxima →
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <Box className={classes.dialogActions} display="flex" justifyContent="flex-end">
          <Button onClick={handleCloseUsers} variant="outlined" classes={{ root: classes.btnOutlined }}>
            Fechar
          </Button>
        </Box>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog
        open={changePasswordModalOpen}
        onClose={handleCloseChangePassword}
        fullWidth
        fullScreen={isMobile}
        maxWidth="xs"
        classes={{ paper: isMobile ? undefined : classes.dialogPaperSm }}
      >
        <Box className={classes.dialogHeader}>
          <Box className={classes.dialogHeaderIcon}>
            <LockIcon />
          </Box>
          <Box className={classes.dialogHeaderText}>
            <Typography className={classes.dialogTitle}>Alterar senha</Typography>
            <Typography className={classes.dialogSubtitle}>
              {changePasswordUser?.name || "Usuário"} — {changePasswordUser?.email || ""}
            </Typography>
          </Box>
          {isMobile && (
            <IconButton size="small" onClick={handleCloseChangePassword} style={{ marginLeft: "auto" }}>
              <CancelIcon style={{ fontSize: 20, opacity: 0.5 }} />
            </IconButton>
          )}
        </Box>
        <DialogContent className={classes.dialogContent}>
          <TextField
            label="Nova senha"
            value={changePasswordValue}
            onChange={(e) => setChangePasswordValue(e.target.value)}
            variant="outlined"
            fullWidth
            size="small"
            type="password"
            autoComplete="new-password"
            className={classes.inputField}
          />
        </DialogContent>
        <Box className={classes.dialogActions} display="flex" justifyContent="flex-end" style={{ gap: 8 }}>
          <Button onClick={handleCloseChangePassword} variant="outlined" classes={{ root: classes.btnOutlined }}>
            Cancelar
          </Button>
          <ButtonWithSpinner
            loading={changePasswordLoading}
            onClick={handleSubmitChangePassword}
            variant="contained"
            color="primary"
            classes={{ root: classes.btnPrimary }}
          >
            Salvar senha
          </ButtonWithSpinner>
        </Box>
      </Dialog>

      {/* Connections Dialog */}
      <Dialog
        open={connectionsModalOpen}
        onClose={handleCloseConnections}
        fullWidth
        fullScreen={isMobile}
        maxWidth="md"
        classes={{ paper: isMobile ? undefined : classes.dialogPaper }}
      >
        <Box className={classes.dialogHeader}>
          <Box className={classes.dialogHeaderIcon}>
            <CropFreeIcon />
          </Box>
          <Box className={classes.dialogHeaderText}>
            <Typography className={classes.dialogTitle}>
              Conexões — {connectionsCompany?.name || "Empresa"}
            </Typography>
            <Typography className={classes.dialogSubtitle}>
              {companyConnections.length > 0 ? `${companyConnections.length} conexão(ões) encontrada(s)` : "Lista de conexões desta empresa"}
            </Typography>
          </Box>
          {isMobile && (
            <IconButton size="small" onClick={handleCloseConnections} style={{ marginLeft: "auto" }}>
              <CancelIcon style={{ fontSize: 20, opacity: 0.5 }} />
            </IconButton>
          )}
        </Box>
        <DialogContent className={classes.dialogContent}>
          {connectionsLoading ? (
            <Box className={classes.loadingState}>
              <CircularProgress size={28} />
            </Box>
          ) : companyConnections.length === 0 ? (
            <Box className={classes.emptyState}>
              <CropFreeIcon style={{ fontSize: 36, opacity: 0.25, marginBottom: 8 }} />
              <Typography variant="body2">Nenhuma conexão encontrada para esta empresa.</Typography>
            </Box>
          ) : (
            <Box>
              <Box className={classes.invoicesTableWrap}>
                <Table size="small" className={classes.invoicesTable}>
                  <TableHead className={classes.tableHead}>
                    <TableRow>
                      <TableCell align="left">Nome</TableCell>
                      <TableCell align="center">Status</TableCell>
                      <TableCell align="left">Canal</TableCell>
                      <TableCell align="center">Última atualização</TableCell>
                      <TableCell align="center">Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody className={classes.tableBody}>
                    {paginatedConnections.map((conn) => {
                      const status = conn.status || "DISCONNECTED";
                      const isRestarting = connectionRestartingId === conn.id;

                      const channel = String(conn.channel || "").toLowerCase();
                      let channelLabel = "—";
                      if (channel === "whatsapp_oficial") channelLabel = "WhatsApp Oficial";
                      else if (channel === "whatsapp") {
                        const provider = String(conn.provider || "beta").toLowerCase();
                        channelLabel = provider === "wuzapi" ? "WhatsApp Wuzapi" : "WhatsApp Baileys";
                      } else if (channel === "facebook") channelLabel = "Facebook";
                      else if (channel === "instagram") channelLabel = "Instagram";
                      else if (channel) channelLabel = channel;

                      let statusBadgeClass = classes.badgeOpen;
                      let statusLabel = status;
                      if (status === "CONNECTED") { statusBadgeClass = classes.badgeActive; statusLabel = "Conectada"; }
                      else if (status === "DISCONNECTED") { statusBadgeClass = classes.badgeInactive; statusLabel = "Desconectada"; }
                      else if (status === "qrcode") { statusBadgeClass = classes.badgeWarning; statusLabel = "Aguardando QR Code"; }

                      return (
                        <TableRow key={conn.id} className={classes.rowNormal}>
                          <TableCell align="left" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                            {conn.name || "—"}
                          </TableCell>
                          <TableCell align="center">
                            <span className={`${classes.badge} ${statusBadgeClass}`}>{statusLabel}</span>
                          </TableCell>
                          <TableCell align="left" style={{ fontSize: "0.78rem" }}>{channelLabel}</TableCell>
                          <TableCell align="center" style={{ fontSize: "0.78rem" }}>
                            {conn.updatedAt ? datetimeToClient(conn.updatedAt) : "—"}
                          </TableCell>
                          <TableCell align="center" style={{ whiteSpace: "nowrap" }}>
                            <Tooltip title="Editar conexão" arrow>
                              <IconButton size="small" className={classes.actionBtn} onClick={() => handleOpenConnectionEdit(conn)}>
                                <EditOutlinedIcon style={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reiniciar conexão" arrow>
                              <span>
                                <IconButton
                                  size="small"
                                  className={classes.actionBtn}
                                  onClick={() => handleRestartConnection(conn)}
                                  disabled={isRestarting}
                                >
                                  {isRestarting ? <CircularProgress size={14} /> : <RefreshIcon style={{ fontSize: 16 }} />}
                                </IconButton>
                              </span>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>

              <Box className={classes.invoicesPaginationRow}>
                <Typography variant="caption" color="textSecondary">
                  Página {safeConnectionsPage} de {totalConnectionsPages} · {companyConnections.length} conexão(ões)
                </Typography>
                <Box className={classes.invoicesPaginationPages}>
                  <Button
                    size="small"
                    className={classes.paginationBtn}
                    onClick={() => setConnectionsPage((prev) => Math.max(1, prev - 1))}
                    disabled={safeConnectionsPage === 1}
                  >
                    ← Anterior
                  </Button>
                  {visibleConnectionsPages[0] > 1 && (
                    <>
                      <Button size="small" className={`${classes.paginationBtn} ${safeConnectionsPage === 1 ? classes.paginationBtnActive : ""}`} onClick={() => setConnectionsPage(1)}>1</Button>
                      {visibleConnectionsPages[0] > 2 && <Typography variant="caption" color="textSecondary" style={{ padding: "0 2px" }}>…</Typography>}
                    </>
                  )}
                  {visibleConnectionsPages.map((page) => (
                    <Button
                      key={page}
                      size="small"
                      className={`${classes.paginationBtn} ${safeConnectionsPage === page ? classes.paginationBtnActive : ""}`}
                      onClick={() => setConnectionsPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  {visibleConnectionsPages[visibleConnectionsPages.length - 1] < totalConnectionsPages && (
                    <>
                      {visibleConnectionsPages[visibleConnectionsPages.length - 1] < totalConnectionsPages - 1 && <Typography variant="caption" color="textSecondary" style={{ padding: "0 2px" }}>…</Typography>}
                      <Button size="small" className={`${classes.paginationBtn} ${safeConnectionsPage === totalConnectionsPages ? classes.paginationBtnActive : ""}`} onClick={() => setConnectionsPage(totalConnectionsPages)}>{totalConnectionsPages}</Button>
                    </>
                  )}
                  <Button
                    size="small"
                    className={classes.paginationBtn}
                    onClick={() => setConnectionsPage((prev) => Math.min(totalConnectionsPages, prev + 1))}
                    disabled={safeConnectionsPage === totalConnectionsPages}
                  >
                    Próxima →
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <Box className={classes.dialogActions} display="flex" justifyContent="flex-end">
          <Button onClick={handleCloseConnections} variant="outlined" classes={{ root: classes.btnOutlined }}>
            Fechar
          </Button>
        </Box>
      </Dialog>

      {/* WhatsApp Edit Modal (from Connections modal) */}
      <WhatsAppModalAdmin
        open={whatsAppEditOpen}
        onClose={handleCloseConnectionEdit}
        whatsAppId={whatsAppEditOpen ? selectedConnection?.id : undefined}
      />

      <ConfirmationModal
        title={deleteTargetLabel ? `Excluir ${deleteTargetLabel}?` : "Exclusão de Registro"}
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => handleDelete()}
      >
        {deleteTargetIds.length > 1
          ? "Deseja realmente excluir as empresas selecionadas?"
          : "Deseja realmente excluir esse registro?"}
      </ConfirmationModal>
    </Paper>
  );
}
