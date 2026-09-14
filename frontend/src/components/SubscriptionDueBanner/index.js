import React, { useContext } from "react";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import { makeStyles } from "@material-ui/core/styles";
import WarningIcon from "@material-ui/icons/Warning";
import ErrorIcon from "@material-ui/icons/Error";
import { useHistory } from "react-router-dom";
import moment from "moment";

import { AuthContext } from "../../context/Auth/AuthContext";

// Quantos dias antes do vencimento o aviso já aparece no Dashboard/sistema
// (independente do dia configurado pelo Master para o disparo automático de
// e-mail/WhatsApp em GlobalConfig — esse aqui é só um alerta visual, mais
// cedo, pra dar tempo da empresa se programar).
const WARNING_WINDOW_DAYS = 7;

const useStyles = makeStyles((theme) => ({
  banner: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    flexWrap: "wrap",
    borderRadius: 12,
    padding: theme.spacing(1.25, 2),
    marginBottom: theme.spacing(2),
  },
  bannerWarning: {
    backgroundColor: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
  },
  bannerOverdue: {
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
  },
  icon: {
    flexShrink: 0,
  },
  text: {
    flex: 1,
    minWidth: 200,
    fontSize: "0.85rem",
    fontWeight: 500,
  },
  action: {
    borderRadius: 8,
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.78rem",
    whiteSpace: "nowrap",
  },
}));

// Alerta proativo de vencimento da assinatura — usado no Dashboard (e pode
// ser reaproveitado em outras telas). Só aparece pro Admin de uma
// empresa-cliente real (nunca pro Master, cuja empresa — o "esqueleto" — não
// tem vencimento de verdade).
const SubscriptionDueBanner = () => {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);

  if (!user || user.super) return null;
  if (user.profile !== "admin") return null;

  const dueDate = user?.company?.dueDate;
  if (!dueDate || !moment(dueDate).isValid()) return null;

  const today = moment().startOf("day");
  const due = moment(dueDate).startOf("day");
  const diffDays = due.diff(today, "days");

  if (diffDays > WARNING_WINDOW_DAYS) return null;

  const isOverdue = diffDays < 0;
  const dueDateLabel = due.format("DD/MM/YYYY");

  const message = isOverdue
    ? `Sua assinatura venceu em ${dueDateLabel} (${Math.abs(diffDays)} dia(s) atrás). Renove para continuar usando o sistema sem interrupções.`
    : diffDays === 0
    ? `Sua assinatura vence hoje (${dueDateLabel}).`
    : `Sua assinatura vence em ${diffDays} dia(s) (${dueDateLabel}).`;

  return (
    <Box className={`${classes.banner} ${isOverdue ? classes.bannerOverdue : classes.bannerWarning}`}>
      {isOverdue ? (
        <ErrorIcon className={classes.icon} />
      ) : (
        <WarningIcon className={classes.icon} />
      )}
      <Typography className={classes.text}>{message}</Typography>
      <Button
        variant="contained"
        color="primary"
        size="small"
        className={classes.action}
        onClick={() => history.push("/settings?tab=subscription")}
      >
        Ver assinatura
      </Button>
    </Box>
  );
};

export default SubscriptionDueBanner;
