import React, { useEffect, useState, useContext } from "react";
import { useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import api from "../../services/api";
import usePlans from "../../hooks/usePlans";
import { i18n } from "../../translate/i18n";
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from "@material-ui/core";
import ForbiddenPage from "../../components/ForbiddenPage";
import SaveIcon from "@material-ui/icons/Save";

import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    padding: theme.spacing(2),
    height: "calc(100% - 48px)",
    overflowY: "auto",
    ...theme.scrollbarStyles,
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
    },
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: theme.spacing(2),
    gap: theme.spacing(2),
    flexWrap: "wrap",
  },
  headerLeft: {},
  headerTitle: {
    fontWeight: 700,
    fontSize: "1.45rem",
    letterSpacing: "-0.3px",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
    lineHeight: 1.2,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: "0.82rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    fontWeight: 400,
  },
  headerActions: {
    display: "flex",
    gap: theme.spacing(1),
    alignItems: "center",
  },

  // ── Buttons ──────────────────────────────────────────────────────────────
  actionButton: {
    minHeight: 36,
    borderRadius: 9,
    fontWeight: 600,
    fontSize: "0.72rem",
    padding: theme.spacing(0.6, 1.4),
    textTransform: "none",
    boxShadow: "0 4px 10px rgba(7, 64, 171, 0.12)",
    whiteSpace: "nowrap",
  },

  // ── Main paper ────────────────────────────────────────────────────────────
  mainPaper: {
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "0 12px 26px rgba(17, 24, 39, 0.09)",
    padding: theme.spacing(2.5),
  },

  // ── Section ───────────────────────────────────────────────────────────────
  sectionLabel: {
    fontWeight: 700,
    fontSize: "0.76rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
  },
  fieldsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: theme.spacing(2),
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "1fr",
    },
  },

  fieldGroupLabel: {
    fontSize: "0.78rem",
    fontWeight: 600,
    color: theme.palette.type === "dark" ? "#cbd5e1" : "#334155",
    marginBottom: theme.spacing(1),
  },
  intervalRow: {
    display: "flex",
    gap: theme.spacing(1),
  },
  intervalUnit: {
    flex: "0 0 42%",
  },
  intervalValue: {
    flex: 1,
  },
  intervalHelper: {
    marginTop: theme.spacing(0.75),
    fontSize: "0.72rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
  },

  // ── Select ────────────────────────────────────────────────────────────────
  formControl: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 9,
      backgroundColor: theme.palette.background.default,
    },
    "& .MuiInputLabel-outlined": {
      fontSize: "0.78rem",
      transform: "translate(14px, 11px) scale(1)",
    },
    "& .MuiInputLabel-outlined.MuiInputLabel-shrink": {
      transform: "translate(14px, -6px) scale(0.75)",
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: theme.palette.divider,
    },
    "& .MuiOutlinedInput-input": {
      fontSize: "0.78rem",
      paddingTop: 10,
      paddingBottom: 10,
      display: "flex",
      alignItems: "center",
    },
  },
}));

const initialSettings = {
  messageInterval: 20,
  longerIntervalAfter: 20,
  greaterInterval: 60,
  variables: [],
  sabado: "false",
  domingo: "false",
  startHour: "09:00",
  endHour: "18:00",
};

// Teto de segurança para os intervalos de disparo (5 minutos), evitando
// configurações que travem a fila de processamento das campanhas.
const MAX_INTERVAL_SECONDS = 5 * 60;

const MINUTE_UNIT_OPTIONS = [0, 1, 2, 3, 4, 5]; // valor exibido em minutos, salvo em segundos (* 60)
const SECOND_UNIT_OPTIONS = [
  ...Array.from({ length: 13 }, (_, i) => i * 5), // 0, 5, 10 ... 60
  ...Array.from({ length: 24 }, (_, i) => 70 + i * 10), // 70, 80 ... 300
];

const nearestOption = (value, options) =>
  options.reduce((closest, current) =>
    Math.abs(current - value) < Math.abs(closest - value) ? current : closest
  );

const defaultUnitFor = (totalSeconds) => {
  const value = Number(totalSeconds) || 0;
  return value > 0 && value % 60 === 0 ? "minutes" : "seconds";
};

const CampaignsConfig = () => {
  const classes = useStyles();
  const history = useHistory();

  const [settings, setSettings] = useState(initialSettings);
  const [intervalUnits, setIntervalUnits] = useState({
    messageInterval: defaultUnitFor(initialSettings.messageInterval),
    greaterInterval: defaultUnitFor(initialSettings.greaterInterval),
  });
  const { user } = useContext(AuthContext);

  const { getPlanCompany } = usePlans();

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useCampaigns) {
        toast.error(
          "Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando."
        );
        setTimeout(() => {
          history.push(`/`);
        }, 1000);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.get("/campaign-settings").then(({ data }) => {
      const settingsList = [];
      if (Array.isArray(data) && data.length > 0) {
        data.forEach((item) => {
          settingsList.push([item.key, item.value]);
        });
        const loadedSettings = Object.fromEntries(settingsList);
        setSettings(loadedSettings);
        setIntervalUnits({
          messageInterval: defaultUnitFor(loadedSettings.messageInterval),
          greaterInterval: defaultUnitFor(loadedSettings.greaterInterval),
        });
      }
    });
  }, []);

  const handleOnChangeSettings = (e) => {
    const changedProp = {};
    changedProp[e.target.name] = e.target.value;
    setSettings((prev) => ({ ...prev, ...changedProp }));
  };

  const handleIntervalUnitChange = (fieldName) => (e) => {
    const newUnit = e.target.value;
    setIntervalUnits((prev) => ({ ...prev, [fieldName]: newUnit }));
    setSettings((prev) => {
      const current = Number(prev[fieldName]) || 0;
      const snapped =
        newUnit === "minutes"
          ? Math.min(Math.round(current / 60) * 60, MAX_INTERVAL_SECONDS)
          : nearestOption(current, SECOND_UNIT_OPTIONS);
      return { ...prev, [fieldName]: snapped };
    });
  };

  const handleIntervalValueChange = (fieldName, unit) => (e) => {
    const raw = Number(e.target.value);
    const seconds = unit === "minutes" ? raw * 60 : raw;
    setSettings((prev) => ({ ...prev, [fieldName]: Math.min(seconds, MAX_INTERVAL_SECONDS) }));
  };

  const saveSettings = async () => {
    await api.post("/campaign-settings", { settings });
    toast.success("Configurações salvas");
  };

  if (user.profile === "user") {
    return <ForbiddenPage />;
  }

  const renderIntervalField = (fieldName, label, helperText) => {
    const unit = intervalUnits[fieldName] || "seconds";
    const valueOptions = unit === "minutes" ? MINUTE_UNIT_OPTIONS : SECOND_UNIT_OPTIONS;
    const displayValue =
      unit === "minutes" ? Math.round((settings[fieldName] || 0) / 60) : settings[fieldName] || 0;

    return (
      <div>
        <Typography className={classes.fieldGroupLabel}>{label}</Typography>
        <div className={classes.intervalRow}>
          <FormControl
            variant="outlined"
            className={`${classes.formControl} ${classes.intervalUnit}`}
          >
            <InputLabel id={`${fieldName}-unit-label`}>Unidade</InputLabel>
            <Select
              labelId={`${fieldName}-unit-label`}
              label="Unidade"
              value={unit}
              onChange={handleIntervalUnitChange(fieldName)}
            >
              <MenuItem value="seconds">Segundos</MenuItem>
              <MenuItem value="minutes">Minutos</MenuItem>
            </Select>
          </FormControl>
          <FormControl
            variant="outlined"
            className={`${classes.formControl} ${classes.intervalValue}`}
          >
            <InputLabel id={`${fieldName}-value-label`}>Valor</InputLabel>
            <Select
              labelId={`${fieldName}-value-label`}
              label="Valor"
              value={displayValue}
              onChange={handleIntervalValueChange(fieldName, unit)}
            >
              {valueOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option} {unit === "minutes" ? "min" : "seg"}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
        <Typography className={classes.intervalHelper}>{helperText}</Typography>
      </div>
    );
  };

  return (
    <div className={classes.pageRoot}>
      {/* ── Page Header ── */}
      <div className={classes.header}>
        <div className={classes.headerLeft}>
          <Typography className={classes.headerTitle}>
            {i18n.t("campaignsConfig.title")}
          </Typography>
          <Typography className={classes.headerSubtitle}>
            Ajuste intervalos e regras de envio para melhorar performance de campanhas
          </Typography>
        </div>
        <div className={classes.headerActions}>
          <Button
            className={classes.actionButton}
            size="small"
            variant="contained"
            color="primary"
            startIcon={<SaveIcon style={{ fontSize: 15 }} />}
            onClick={saveSettings}
          >
            {i18n.t("campaigns.settings.save")}
          </Button>
        </div>
      </div>

      {/* ── Settings panel ── */}
      <Paper className={classes.mainPaper} variant="outlined">
        <Typography className={classes.sectionLabel}>
          Intervalos de disparo
        </Typography>

        <div className={classes.fieldsRow}>
          {renderIntervalField(
            "messageInterval",
            i18n.t("campaigns.settings.randomInterval"),
            `Intervalo aplicado entre cada disparo (máximo de ${MAX_INTERVAL_SECONDS / 60} minutos)`
          )}

          <div>
            <Typography className={classes.fieldGroupLabel}>
              {i18n.t("campaigns.settings.intervalGapAfter")}
            </Typography>
            <div className={classes.intervalRow}>
              <FormControl variant="outlined" className={classes.formControl} fullWidth>
                <InputLabel id="longerIntervalAfter-label">Valor</InputLabel>
                <Select
                  name="longerIntervalAfter"
                  id="longerIntervalAfter"
                  labelId="longerIntervalAfter-label"
                  label="Valor"
                  value={settings.longerIntervalAfter}
                  onChange={handleOnChangeSettings}
                >
                  <MenuItem value={0}>{i18n.t("campaigns.settings.undefined")}</MenuItem>
                  <MenuItem value={5}>5 {i18n.t("campaigns.settings.messages")}</MenuItem>
                  <MenuItem value={10}>10 {i18n.t("campaigns.settings.messages")}</MenuItem>
                  <MenuItem value={15}>15 {i18n.t("campaigns.settings.messages")}</MenuItem>
                  <MenuItem value={20}>20 {i18n.t("campaigns.settings.messages")}</MenuItem>
                  <MenuItem value={30}>30 {i18n.t("campaigns.settings.messages")}</MenuItem>
                  <MenuItem value={40}>40 {i18n.t("campaigns.settings.messages")}</MenuItem>
                  <MenuItem value={50}>50 {i18n.t("campaigns.settings.messages")}</MenuItem>
                  <MenuItem value={60}>60 {i18n.t("campaigns.settings.messages")}</MenuItem>
                </Select>
              </FormControl>
            </div>
            <Typography className={classes.intervalHelper}>
              Quantidade de mensagens enviadas antes de aplicar o intervalo maior
            </Typography>
          </div>

          {renderIntervalField(
            "greaterInterval",
            i18n.t("campaigns.settings.laggerTriggerRange"),
            `Pausa maior aplicada após o limite de mensagens acima (máximo de ${MAX_INTERVAL_SECONDS / 60} minutos)`
          )}
        </div>
      </Paper>
    </div>
  );
};

export default CampaignsConfig;
