import React, { useState, useEffect } from "react";
import {
  makeStyles,
  withStyles,
  Paper,
  Box,
  Grid,
  Typography,
  TextField,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
  Dialog,
  DialogContent,
  IconButton,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Tooltip,
  Button,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from "@material-ui/core";
import { Formik, Form, Field } from "formik";
import ButtonWithSpinner from "../ButtonWithSpinner";
import ConfirmationModal from "../ConfirmationModal";

import {
  Edit as EditIcon,
  Add as AddIcon,
  LayersOutlined as LayersIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  DeleteOutline as DeleteOutlineIcon,
  People as PeopleIcon,
  Link as LinkIcon,
  AttachMoney as MoneyIcon,
  Public as PublicIcon,
} from "@material-ui/icons";

import { toast } from "react-toastify";
import usePlans from "../../hooks/usePlans";
import { i18n } from "../../translate/i18n";

// ─── iOS-style Switch ─────────────────────────────────────────────────────────
const IOSSwitch = withStyles((theme) => ({
  root: {
    width: 44,
    height: 26,
    padding: 0,
    flexShrink: 0,
  },
  switchBase: {
    padding: 2,
    transition: "transform 0.22s cubic-bezier(.4,0,.2,1)",
    "&$checked": {
      transform: "translateX(18px)",
      color: "#fff",
      "& + $track": {
        backgroundColor: "#34c759",
        opacity: 1,
        border: "none",
      },
    },
  },
  thumb: {
    width: 22,
    height: 22,
    backgroundColor: "#ffffff",
    boxShadow: "0 2px 6px rgba(0,0,0,0.22), 0 1px 2px rgba(0,0,0,0.12)",
    transition: "transform 0.22s cubic-bezier(.4,0,.2,1)",
  },
  track: {
    borderRadius: 13,
    backgroundColor: theme.palette.type === "light" ? "#d1d1d6" : "#3a3a3c",
    opacity: 1,
    transition: "background-color 0.22s ease",
  },
  checked: {},
}))(({ classes, ...props }) => (
  <Switch
    disableRipple
    classes={{
      root: classes.root,
      switchBase: classes.switchBase,
      thumb: classes.thumb,
      track: classes.track,
      checked: classes.checked,
    }}
    {...props}
  />
));

const useStyles = makeStyles((theme) => ({
  root: { width: "100%" },
  mainPaper: {
    width: "100%",
    flex: 1,
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: "transparent",
    boxShadow: "none",
    padding: 0,
  },
  fullWidth: { width: "100%" },

  // ─── Toolbar ──────────────────────────────────────────────────────
  toolbar: {
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1.5, 2),
    marginBottom: theme.spacing(1.5),
    background: theme.palette.type === "light" ? "#ffffff" : theme.palette.background.default,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(1),
  },
  toolbarLeft: { display: "flex", flexDirection: "column" },
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
  btnPrimary: {
    borderRadius: 8,
    height: 36,
    padding: "0 16px",
    fontSize: "0.78rem",
    fontWeight: 600,
    textTransform: "none",
    whiteSpace: "nowrap",
    boxShadow: "none",
    "&:hover": { boxShadow: "none" },
    [theme.breakpoints.down("xs")]: {
      width: "100%",
    },
  },

  // ─── Desktop table ────────────────────────────────────────────────
  tableContainer: {
    width: "100%",
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    overflowX: "auto",
    backgroundColor: theme.palette.background.paper,
    ...theme.scrollbarStyles,
    [theme.breakpoints.down("sm")]: { display: "none" },
  },
  table: {
    minWidth: 720,
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
  rowHover: {
    transition: "background 0.15s ease",
    "&:hover": {
      backgroundColor: theme.palette.type === "light" ? "#f8fbff" : theme.palette.action.hover,
    },
    "&:last-child td": { borderBottom: "none" },
  },
  planName: {
    fontWeight: 600,
    fontSize: "0.86rem",
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

  // ─── Feature summary badge ────────────────────────────────────────
  featureSummaryBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    padding: "3px 12px",
    fontSize: "0.72rem",
    fontWeight: 700,
    border: "1px solid transparent",
    cursor: "default",
    whiteSpace: "nowrap",
  },
  featureSummaryAll: {
    color: "#065f46",
    backgroundColor: "#d1fae5",
    borderColor: "#6ee7b7",
  },
  featureSummaryPartial: {
    color: "#92400e",
    backgroundColor: "#fef3c7",
    borderColor: "#fcd34d",
  },
  featureSummaryNone: {
    color: "#9f1239",
    backgroundColor: "#ffe4e6",
    borderColor: "#fda4af",
  },
  featureTooltipWrap: {
    padding: "6px 2px",
    minWidth: 180,
  },
  featureTooltipTitle: {
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: 6,
    opacity: 0.7,
  },
  featureTooltipRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: "0.75rem",
    padding: "2px 0",
    lineHeight: 1.4,
  },

  publicBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    padding: "2px 10px",
    fontSize: "0.7rem",
    fontWeight: 700,
    border: "1px solid transparent",
  },
  publicBadgeYes: {
    color: "#065f46",
    backgroundColor: "#d1fae5",
    borderColor: "#6ee7b7",
  },
  publicBadgeNo: {
    color: "#6b7280",
    backgroundColor: theme.palette.type === "light" ? "#f3f4f6" : "#1f2937",
    borderColor: theme.palette.divider,
  },
  valueCell: {
    fontWeight: 700,
    fontSize: "0.86rem",
  },

  // ─── Mobile card list ─────────────────────────────────────────────
  mobileCardList: {
    display: "none",
    [theme.breakpoints.down("sm")]: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(1.25),
    },
  },
  planCard: {
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    overflow: "hidden",
  },
  planCardHeader: {
    padding: theme.spacing(1.25, 1.75),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: theme.palette.type === "light" ? "#f8fbff" : theme.palette.background.default,
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  planCardHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    minWidth: 0,
  },
  planCardIdBadge: {
    flexShrink: 0,
    fontSize: "0.65rem",
    fontWeight: 700,
    color: theme.palette.text.secondary,
    opacity: 0.55,
    lineHeight: 1,
  },
  planCardName: {
    fontWeight: 700,
    fontSize: "0.9rem",
    color: theme.palette.text.primary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  planCardActions: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  planCardBody: {
    padding: theme.spacing(1.25, 1.75),
  },
  planCardStats: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.25),
  },
  planCardStatItem: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.75, 1),
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.type === "light" ? "#f8fafc" : "transparent",
  },
  planCardStatIcon: {
    fontSize: 14,
    color: theme.palette.primary.main,
    flexShrink: 0,
    opacity: 0.75,
  },
  planCardStatText: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  planCardStatLabel: {
    fontSize: "0.62rem",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    lineHeight: 1.2,
  },
  planCardStatValue: {
    fontSize: "0.82rem",
    fontWeight: 700,
    color: theme.palette.text.primary,
    lineHeight: 1.3,
  },
  planCardFeatureRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: theme.spacing(1),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  planCardFeatureLabel: {
    fontSize: "0.72rem",
    fontWeight: 600,
    color: theme.palette.text.secondary,
  },

  // ─── Empty state ──────────────────────────────────────────────────
  emptyState: {
    padding: theme.spacing(5, 2),
    textAlign: "center",
    color: theme.palette.text.secondary,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 14,
    backgroundColor: theme.palette.background.paper,
  },

  // ─── Dialog ───────────────────────────────────────────────────────
  dialogPaper: {
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
    [theme.breakpoints.down("xs")]: {
      margin: 0,
      borderRadius: 0,
      maxHeight: "100%",
      height: "100%",
    },
  },
  dialogHeader: {
    padding: theme.spacing(2, 2.5),
    background: theme.palette.type === "light" ? "#fafbff" : theme.palette.background.default,
    borderBottom: `1px solid ${theme.palette.divider}`,
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1.5),
  },
  dialogHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    backgroundColor: theme.palette.type === "light" ? "#eff6ff" : "#1e3a5f",
    "& svg": { color: theme.palette.primary.main, fontSize: 18 },
  },
  dialogHeaderText: { display: "flex", flexDirection: "column" },
  dialogTitle: {
    fontWeight: 700,
    fontSize: "0.97rem",
    color: theme.palette.text.primary,
    lineHeight: 1.3,
  },
  dialogSubtitle: {
    fontSize: "0.76rem",
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  dialogContent: {
    padding: theme.spacing(2.5, 3),
    [theme.breakpoints.down("sm")]: { padding: theme.spacing(2) },
    [theme.breakpoints.down("xs")]: { padding: theme.spacing(1.5) },
  },

  // ─── Form sections ────────────────────────────────────────────────
  formSection: {
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(2),
    background: theme.palette.type === "light" ? "#fafbff" : theme.palette.background.paper,
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down("xs")]: { padding: theme.spacing(1.5) },
  },
  formSectionTitle: {
    fontSize: "0.72rem",
    fontWeight: 700,
    letterSpacing: "0.07em",
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

  // ─── Feature toggles in form ──────────────────────────────────────
  featureToggleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
    gap: theme.spacing(1),
    [theme.breakpoints.down("xs")]: {
      gridTemplateColumns: "1fr 1fr",
      gap: theme.spacing(0.75),
    },
  },
  featureToggleItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(0.75, 1.25, 0.75, 1.5),
    background: theme.palette.background.paper,
    transition: "border-color 0.22s ease, background 0.22s ease",
    minHeight: 46,
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(0.75, 0.75, 0.75, 1),
      minHeight: 44,
    },
  },
  featureToggleItemActive: {
    borderColor: theme.palette.type === "light" ? "#86efac" : "#166534",
    backgroundColor: theme.palette.type === "light" ? "#f0fdf4" : "#052e16",
  },
  featureToggleLabel: {
    fontSize: "0.8rem",
    fontWeight: 500,
    color: theme.palette.text.primary,
    lineHeight: 1.3,
    flex: 1,
    paddingRight: theme.spacing(0.5),
    [theme.breakpoints.down("xs")]: { fontSize: "0.72rem" },
  },

  // ─── Form actions ─────────────────────────────────────────────────
  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    [theme.breakpoints.down("xs")]: {
      flexDirection: "column-reverse",
      "& > *": { width: "100%" },
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
    "&:hover": { backgroundColor: "#fecaca" },
    boxShadow: "none",
  },
}));

const ALL_FEATURES = [
  { key: "useWhatsappBaileys", label: "WhatsApp Baileys" },
  { key: "useWhatsappWuzapi", label: "WhatsApp wuzAPI" },
  { key: "useWhatsappOficial", label: "WA API Oficial" },
  { key: "useWebchat", label: "Webchat" },
  { key: "useFacebook", label: "Facebook" },
  { key: "useInstagram", label: "Instagram" },
  { key: "useCampaigns", label: i18n.t("plans.form.campaigns") },
  { key: "useSchedules", label: i18n.t("plans.form.schedules") },
  { key: "useInternalChat", label: "Chat Interno" },
  { key: "useExternalApi", label: "API Externa" },
  { key: "useKanban", label: "Kanban" },
  { key: "useOpenAi", label: "Atendimento IA" },
  { key: "useIntegrations", label: "Integrações" },
  { key: "useFinancial", label: "Financeiro (add-on)" },
];

const FEATURE_FIELDS = [
  { name: "useWhatsappBaileys", label: "WhatsApp Baileys" },
  { name: "useWhatsappWuzapi", label: "WhatsApp wuzAPI" },
  { name: "useWhatsappOficial", label: "WhatsApp API Oficial" },
  { name: "useWebchat", label: "Webchat" },
  { name: "useFacebook", label: "Facebook" },
  { name: "useInstagram", label: "Instagram" },
  { name: "useCampaigns", label: i18n.t("plans.form.campaigns") },
  { name: "useSchedules", label: i18n.t("plans.form.schedules") },
  { name: "useInternalChat", label: "Chat Interno" },
  { name: "useExternalApi", label: "API Externa" },
  { name: "useKanban", label: "Kanban" },
  { name: "useOpenAi", label: "Atendimento IA" },
  { name: "useIntegrations", label: "Integrações" },
  { name: "useFinancial", label: "Financeiro (add-on)" },
];

export function PlanManagerForm(props) {
  const { onSubmit, onDelete, onCancel, initialValue, loading } = props;
  const classes = useStyles();

  const [record, setRecord] = useState({
    name: "", users: 0, connections: 0, queues: 0, amount: 0,
    useWhatsapp: true, useWhatsappBaileys: true, useWhatsappWuzapi: true,
    useWhatsappOficial: true, useWebchat: true, useFacebook: true, useInstagram: true,
    useCampaigns: true, useSchedules: true, useInternalChat: true,
    useExternalApi: true, useKanban: true, useOpenAi: true,
    useIntegrations: true, useFinancial: false, isPublic: true,
  });

  useEffect(() => { setRecord(initialValue); }, [initialValue]);

  return (
    <Formik
      enableReinitialize
      className={classes.fullWidth}
      initialValues={record}
      onSubmit={(values) => onSubmit(values)}
    >
      {({ values, setFieldValue }) => (
        <Form className={classes.fullWidth}>
          <Box className={classes.formSection}>
            <Typography className={classes.formSectionTitle}>Informações do plano</Typography>
            <Grid spacing={2} container>
              <Grid xs={12} sm={12} md={5} item>
                <Field
                  as={TextField}
                  label={i18n.t("plans.form.name")}
                  name="name"
                  variant="outlined"
                  size="small"
                  className={`${classes.fullWidth} ${classes.inputField}`}
                />
              </Grid>
              <Grid xs={6} sm={4} md={2} item>
                <FormControl variant="outlined" size="small" fullWidth className={classes.inputField}>
                  <InputLabel htmlFor="public-selection">{i18n.t("plans.form.public")}</InputLabel>
                  <Field
                    as={Select}
                    id="public-selection"
                    label={i18n.t("plans.form.public")}
                    labelId="public-selection-label"
                    name="isPublic"
                  >
                    <MenuItem value={true}>Sim</MenuItem>
                    <MenuItem value={false}>Não</MenuItem>
                  </Field>
                </FormControl>
              </Grid>
              <Grid xs={6} sm={4} md={2} item>
                <Field
                  as={TextField}
                  label="Valor (R$)"
                  name="amount"
                  variant="outlined"
                  size="small"
                  className={`${classes.fullWidth} ${classes.inputField}`}
                  type="text"
                />
              </Grid>
              <Grid xs={4} sm={4} md={1} item>
                <Field
                  as={TextField}
                  label={i18n.t("plans.form.users")}
                  name="users"
                  variant="outlined"
                  size="small"
                  className={`${classes.fullWidth} ${classes.inputField}`}
                  type="number"
                />
              </Grid>
              <Grid xs={4} sm={4} md={1} item>
                <Field
                  as={TextField}
                  label={i18n.t("plans.form.connections")}
                  name="connections"
                  variant="outlined"
                  size="small"
                  className={`${classes.fullWidth} ${classes.inputField}`}
                  type="number"
                />
              </Grid>
              <Grid xs={4} sm={4} md={1} item>
                <Field
                  as={TextField}
                  label="Filas"
                  name="queues"
                  variant="outlined"
                  size="small"
                  className={`${classes.fullWidth} ${classes.inputField}`}
                  type="number"
                />
              </Grid>
            </Grid>
          </Box>

          <Box className={classes.formSection}>
            <Typography className={classes.formSectionTitle}>Canais e recursos habilitados</Typography>
            <Box className={classes.featureToggleGrid}>
              {FEATURE_FIELDS.map((field) => {
                const isActive = values[field.name] !== false;
                return (
                  <Box
                    key={field.name}
                    className={`${classes.featureToggleItem} ${isActive ? classes.featureToggleItemActive : ""}`}
                  >
                    <Typography className={classes.featureToggleLabel}>{field.label}</Typography>
                    <IOSSwitch
                      checked={isActive}
                      onChange={(e) => setFieldValue(field.name, e.target.checked)}
                    />
                  </Box>
                );
              })}
            </Box>
          </Box>

          <Box className={classes.formActions}>
            <Button
              onClick={() => onCancel()}
              variant="outlined"
              classes={{ root: classes.btnOutlined }}
              disabled={loading}
            >
              {i18n.t("plans.form.clear")}
            </Button>
            {record.id !== undefined && (
              <Button
                onClick={() => onDelete(record)}
                classes={{ root: classes.btnDanger }}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={14} /> : <DeleteOutlineIcon style={{ fontSize: 15 }} />}
              >
                {i18n.t("plans.form.delete")}
              </Button>
            )}
            <ButtonWithSpinner
              loading={loading}
              type="submit"
              variant="contained"
              color="primary"
              classes={{ root: classes.btnPrimary }}
            >
              {i18n.t("plans.form.save")}
            </ButtonWithSpinner>
          </Box>
        </Form>
      )}
    </Formik>
  );
}

function FeatureTooltip({ row, classes }) {
  const enabledCount = ALL_FEATURES.filter(({ key }) => row[key] !== false).length;
  const total = ALL_FEATURES.length;
  return (
    <Box className={classes.featureTooltipWrap}>
      <Typography className={classes.featureTooltipTitle}>
        Recursos — {enabledCount}/{total} ativos
      </Typography>
      {ALL_FEATURES.map(({ key, label }) => {
        const isOn = row[key] !== false;
        return (
          <Box key={key} className={classes.featureTooltipRow}>
            {isOn
              ? <CheckCircleIcon style={{ fontSize: 12, color: "#34d399", flexShrink: 0 }} />
              : <CancelIcon style={{ fontSize: 12, color: "#f87171", flexShrink: 0 }} />
            }
            <span style={{ opacity: isOn ? 1 : 0.55 }}>{label}</span>
          </Box>
        );
      })}
    </Box>
  );
}

function FeatureSummaryBadge({ row, classes, placement = "left" }) {
  const enabledCount = ALL_FEATURES.filter(({ key }) => row[key] !== false).length;
  const total = ALL_FEATURES.length;
  const badgeClass =
    enabledCount === total ? classes.featureSummaryAll
    : enabledCount === 0  ? classes.featureSummaryNone
    : classes.featureSummaryPartial;

  return (
    <Tooltip
      title={<FeatureTooltip row={row} classes={classes} />}
      arrow
      placement={placement}
      interactive
    >
      <span className={`${classes.featureSummaryBadge} ${badgeClass}`}>
        {enabledCount === total
          ? <CheckCircleIcon style={{ fontSize: 12 }} />
          : <CancelIcon style={{ fontSize: 12 }} />
        }
        {enabledCount} / {total} recursos
      </span>
    </Tooltip>
  );
}

function PublicBadge({ row, classes }) {
  return (
    <span className={`${classes.publicBadge} ${row.isPublic ? classes.publicBadgeYes : classes.publicBadgeNo}`}>
      {row.isPublic
        ? <><CheckCircleIcon style={{ fontSize: 10 }} /> Sim</>
        : <><CancelIcon style={{ fontSize: 10 }} /> Não</>
      }
    </span>
  );
}

function normalizeCurrencyValue(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const normalized = String(value)
    .trim()
    .replace(/\s+/g, "")
    .replace(/^R\$\s?/, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrencyValue(value) {
  return normalizeCurrencyValue(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function renderValue(row, classes) {
  return (
    <span className={classes.valueCell}>
      {i18n.t("plans.form.money")}{" "}
      {formatCurrencyValue(row.amount)}
    </span>
  );
}

export function PlansManagerGrid(props) {
  const { records, onSelect, onRequestDelete } = props;
  const classes = useStyles();

  if (records.length === 0) {
    return (
      <Box className={classes.emptyState}>
        <LayersIcon style={{ fontSize: 40, opacity: 0.2, marginBottom: 8 }} />
        <Typography variant="body2">Nenhum plano cadastrado ainda.</Typography>
      </Box>
    );
  }

  return (
    <>
      {/* ── Desktop table (hidden on mobile via CSS) ─────────────── */}
      <Paper className={classes.tableContainer} elevation={0}>
        <Table className={classes.table} size="small" aria-label="plans table">
          <TableHead className={classes.tableHead}>
            <TableRow>
              <TableCell align="center" style={{ width: 52 }}>#</TableCell>
              <TableCell align="left">{i18n.t("plans.form.name")}</TableCell>
              <TableCell align="center">Máx. Usuários</TableCell>
              <TableCell align="center">Máx. Conexões</TableCell>
              <TableCell align="center">Valor</TableCell>
              <TableCell align="center">{i18n.t("plans.form.public")}</TableCell>
              <TableCell align="center">Recursos Habilitados</TableCell>
              <TableCell align="center" style={{ width: 80 }}>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody className={classes.tableBody}>
            {records.map((row) => (
              <TableRow key={row.id} className={classes.rowHover}>
                <TableCell align="center">
                  <Typography style={{ fontSize: "0.75rem", fontWeight: 700, opacity: 0.5 }}>
                    #{row.id}
                  </Typography>
                </TableCell>
                <TableCell align="left">
                  <Typography className={classes.planName}>{row.name || "—"}</Typography>
                </TableCell>
                <TableCell align="center" style={{ fontWeight: 600 }}>{row.users ?? "—"}</TableCell>
                <TableCell align="center" style={{ fontWeight: 600 }}>{row.connections ?? "—"}</TableCell>
                <TableCell align="center">{renderValue(row, classes)}</TableCell>
                <TableCell align="center"><PublicBadge row={row} classes={classes} /></TableCell>
                <TableCell align="center"><FeatureSummaryBadge row={row} classes={classes} /></TableCell>
                <TableCell align="center" style={{ whiteSpace: "nowrap" }}>
                  <Tooltip title="Editar plano" arrow>
                    <IconButton size="small" className={classes.actionBtn} onClick={() => onSelect(row)}>
                      <EditIcon style={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Excluir plano" arrow>
                    <IconButton size="small" className={classes.actionBtnDanger} onClick={() => onRequestDelete(row)}>
                      <DeleteOutlineIcon style={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* ── Mobile card list (hidden on desktop via CSS) ──────────── */}
      <Box className={classes.mobileCardList}>
        {records.map((row) => (
          <Paper key={row.id} className={classes.planCard} elevation={0}>
            {/* Card header: name + actions */}
            <Box className={classes.planCardHeader}>
              <Box className={classes.planCardHeaderLeft}>
                <Typography className={classes.planCardIdBadge}>#{row.id}</Typography>
                <Typography className={classes.planCardName}>{row.name || "—"}</Typography>
              </Box>
              <Box className={classes.planCardActions}>
                <Tooltip title="Editar plano" arrow>
                  <IconButton size="small" className={classes.actionBtn} onClick={() => onSelect(row)}>
                    <EditIcon style={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Excluir plano" arrow>
                  <IconButton size="small" className={classes.actionBtnDanger} onClick={() => onRequestDelete(row)}>
                    <DeleteOutlineIcon style={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Card body: stats + feature summary */}
            <Box className={classes.planCardBody}>
              <Box className={classes.planCardStats}>
                <Box className={classes.planCardStatItem}>
                  <PeopleIcon className={classes.planCardStatIcon} />
                  <Box className={classes.planCardStatText}>
                    <Typography className={classes.planCardStatLabel}>Usuários</Typography>
                    <Typography className={classes.planCardStatValue}>{row.users ?? "—"}</Typography>
                  </Box>
                </Box>
                <Box className={classes.planCardStatItem}>
                  <LinkIcon className={classes.planCardStatIcon} />
                  <Box className={classes.planCardStatText}>
                    <Typography className={classes.planCardStatLabel}>Conexões</Typography>
                    <Typography className={classes.planCardStatValue}>{row.connections ?? "—"}</Typography>
                  </Box>
                </Box>
                <Box className={classes.planCardStatItem}>
                  <MoneyIcon className={classes.planCardStatIcon} />
                  <Box className={classes.planCardStatText}>
                    <Typography className={classes.planCardStatLabel}>Valor</Typography>
                    <Typography className={classes.planCardStatValue}>
                      {i18n.t("plans.form.money")}{" "}
                      {formatCurrencyValue(row.amount)}
                    </Typography>
                  </Box>
                </Box>
                <Box className={classes.planCardStatItem}>
                  <PublicIcon className={classes.planCardStatIcon} />
                  <Box className={classes.planCardStatText}>
                    <Typography className={classes.planCardStatLabel}>Público</Typography>
                    <Typography className={classes.planCardStatValue}>
                      {row.isPublic ? "Sim" : "Não"}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Box className={classes.planCardFeatureRow}>
                <Typography className={classes.planCardFeatureLabel}>Recursos</Typography>
                <FeatureSummaryBadge row={row} classes={classes} placement="top" />
              </Box>
            </Box>
          </Paper>
        ))}
      </Box>
    </>
  );
}

export default function PlansManager() {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("xs"));

  const { list, save, update, remove } = usePlans();

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [record, setRecord] = useState({});

  const getInitialRecord = () => ({
    id: undefined, name: "", users: 0, connections: 0, queues: 0, amount: 0,
    useWhatsapp: true, useWhatsappBaileys: true, useWhatsappWuzapi: true,
    useWhatsappOficial: true, useWebchat: true, useFacebook: true, useInstagram: true,
    useCampaigns: true, useSchedules: true, useInternalChat: true,
    useExternalApi: true, useKanban: true, useOpenAi: true,
    useIntegrations: true, useFinancial: false, isPublic: true,
  });

  useEffect(() => {
    setRecord(getInitialRecord());
    async function fetchData() { await loadPlans(); }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const planList = await list();
      setRecords(planList);
    } catch (e) {
      toast.error("Não foi possível carregar a lista de registros");
    }
    setLoading(false);
  };

  const handleSubmit = async (data) => {
    if (loading) return;
    setLoading(true);
    try {
      if (data.id !== undefined) await update(data);
      else await save(data);
      handleCancel();
      toast.success("Operação realizada com sucesso!");
      try { await loadPlans(); } catch (err) {
        toast.warn("Plano salvo, mas não foi possível atualizar a lista agora.");
      }
    } catch (e) {
      toast.error("Não foi possível realizar a operação. Verifique se já existe um plano com o mesmo nome ou se os campos foram preenchidos corretamente");
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await remove(record.id);
      handleCancel();
      toast.success("Operação realizada com sucesso!");
      try { await loadPlans(); } catch (err) {
        toast.warn("Plano excluído, mas não foi possível atualizar a lista agora.");
      }
    } catch (e) {
      toast.error("Não foi possível realizar a operação");
    }
    setLoading(false);
  };

  const handleOpenDeleteDialog = () => { setShowConfirmDialog(true); };

  const handleRequestDeleteFromGrid = (row) => {
    setRecord({
      id: row.id, name: row.name || "", users: row.users || 0,
      connections: row.connections || 0, queues: row.queues || 0, amount: row.amount || 0,
      useWhatsapp: row.useWhatsapp !== false,
      useWhatsappBaileys: row.useWhatsappBaileys !== false,
      useWhatsappWuzapi: row.useWhatsappWuzapi !== false,
      useWhatsappOficial: row.useWhatsappOficial !== false,
      useWebchat: row.useWebchat !== false,
      useFacebook: row.useFacebook !== false,
      useInstagram: row.useInstagram !== false,
      useCampaigns: row.useCampaigns !== false,
      useSchedules: row.useSchedules !== false,
      useInternalChat: row.useInternalChat !== false,
      useExternalApi: row.useExternalApi !== false,
      useKanban: row.useKanban !== false,
      useOpenAi: row.useOpenAi !== false,
      useIntegrations: row.useIntegrations !== false,
      useFinancial: row.useFinancial === true,
      isPublic: row.isPublic,
    });
    setShowConfirmDialog(true);
  };

  const handleCancel = () => { setRecord(getInitialRecord()); setPlanModalOpen(false); };

  const handleSelect = (data) => {
    const b = (v) => v === false ? false : true;
    setRecord({
      id: data.id, name: data.name || "",
      users: data.users || 0, connections: data.connections || 0, queues: data.queues || 0,
      amount: formatCurrencyValue(data.amount),
      useWhatsapp: b(data.useWhatsapp), useWhatsappBaileys: b(data.useWhatsappBaileys),
      useWhatsappWuzapi: b(data.useWhatsappWuzapi), useWhatsappOficial: b(data.useWhatsappOficial),
      useWebchat: b(data.useWebchat),
      useFacebook: b(data.useFacebook), useInstagram: b(data.useInstagram),
      useCampaigns: b(data.useCampaigns), useSchedules: b(data.useSchedules),
      useInternalChat: b(data.useInternalChat), useExternalApi: b(data.useExternalApi),
      useKanban: b(data.useKanban), useOpenAi: b(data.useOpenAi),
      useIntegrations: b(data.useIntegrations),
      useFinancial: data.useFinancial === true,
      isPublic: data.isPublic,
    });
    setPlanModalOpen(true);
  };

  const handleOpenCreateModal = () => { setRecord(getInitialRecord()); setPlanModalOpen(true); };

  return (
    <Paper className={classes.mainPaper} elevation={0}>
      <Box className={classes.toolbar}>
        <Box className={classes.toolbarLeft}>
          <Typography className={classes.toolbarTitle}>Planos cadastrados</Typography>
          <Typography className={classes.toolbarMeta}>
            {records.length} plano{records.length !== 1 ? "s" : ""} no total
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          onClick={handleOpenCreateModal}
          classes={{ root: classes.btnPrimary }}
          startIcon={<AddIcon style={{ fontSize: 16 }} />}
        >
          Novo plano
        </Button>
      </Box>

      <PlansManagerGrid
        records={records}
        onSelect={handleSelect}
        onRequestDelete={handleRequestDeleteFromGrid}
      />

      <Dialog
        open={planModalOpen}
        onClose={handleCancel}
        fullWidth
        maxWidth="lg"
        fullScreen={isMobile}
        scroll="paper"
        classes={{ paper: classes.dialogPaper }}
      >
        <Box className={classes.dialogHeader}>
          <Box className={classes.dialogHeaderIcon}><LayersIcon /></Box>
          <Box className={classes.dialogHeaderText}>
            <Typography className={classes.dialogTitle}>
              {record.id ? "Editar plano" : "Cadastrar novo plano"}
            </Typography>
            <Typography className={classes.dialogSubtitle}>
              Configure limites de uso e recursos disponíveis para este plano.
            </Typography>
          </Box>
          {isMobile && (
            <Box style={{ marginLeft: "auto" }}>
              <IconButton size="small" onClick={handleCancel} style={{ marginTop: 2 }}>
                <CancelIcon style={{ fontSize: 20, opacity: 0.5 }} />
              </IconButton>
            </Box>
          )}
        </Box>
        <DialogContent className={classes.dialogContent}>
          <PlanManagerForm
            initialValue={record}
            onDelete={handleOpenDeleteDialog}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
          />
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        title={record.name ? `Excluir plano "${record.name}"?` : "Excluir plano"}
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => handleDelete()}
      >
        Deseja realmente excluir este plano? Empresas vinculadas a ele podem ser afetadas.
      </ConfirmationModal>
    </Paper>
  );
}
