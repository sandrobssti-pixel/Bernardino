import React, { useState, useEffect, useReducer, useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Chip from "@material-ui/core/Chip";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import CardHeader from "@material-ui/core/CardHeader";
import Divider from "@material-ui/core/Divider";
import Avatar from "@material-ui/core/Avatar";
import CircularProgress from "@material-ui/core/CircularProgress";
import Tooltip from "@material-ui/core/Tooltip";

// Ícones
import PaymentIcon from "@material-ui/icons/Payment";
import ReceiptIcon from "@material-ui/icons/Receipt";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import ErrorIcon from "@material-ui/icons/Error";
import HourglassEmptyIcon from "@material-ui/icons/HourglassEmpty";
import PersonIcon from "@material-ui/icons/Person";
import DevicesIcon from "@material-ui/icons/Devices";
import QueueIcon from "@material-ui/icons/Queue";
import MoneyIcon from "@material-ui/icons/Money";
import DateRangeIcon from "@material-ui/icons/DateRange";
import InfoIcon from "@material-ui/icons/Info";
import AutorenewIcon from "@material-ui/icons/Autorenew";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";

import SubscriptionModal from "../SubscriptionModal";
import api from "../../services/api";
import TableRowSkeleton from "../TableRowSkeleton";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import confianzaLogo from "../../assets/confianza-logo.png";

import moment from "moment";

const SUBSCRIPTION_EXPIRED_FLAG_KEY = "subscriptionExpiredOnLogin";
// WhatsApp de suporte da Confianza Technologies (fornecedora do sistema).
const SUPPORT_WHATSAPP_NUMBER = "595986283927";
const SUPPORT_WHATSAPP_LINK = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`;

const reducer = (state, action) => {
  if (action.type === "LOAD_INVOICES") {
    const invoices = action.payload;
    const newUsers = [];

    invoices.forEach((user) => {
      const userIndex = state.findIndex((u) => u.id === user.id);
      if (userIndex !== -1) {
        state[userIndex] = user;
      } else {
        newUsers.push(user);
      }
    });

    return [...state, ...newUsers];
  }

  if (action.type === "UPDATE_USERS") {
    const user = action.payload;
    const userIndex = state.findIndex((u) => u.id === user.id);

    if (userIndex !== -1) {
      state[userIndex] = user;
      return [...state];
    } else {
      return [user, ...state];
    }
  }

  if (action.type === "DELETE_USER") {
    const userId = action.payload;

    const userIndex = state.findIndex((u) => u.id === userId);
    if (userIndex !== -1) {
      state.splice(userIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    width: "100%",
  },
  pageHeader: {
    width: "100%",
    marginBottom: theme.spacing(2),
    padding: theme.spacing(2),
    borderRadius: 16,
    color: "#1e2a44",
    background: "#EDF4FF",
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    flexWrap: "wrap",
  },
  pageHeaderLogo: {
    height: 26,
    flexShrink: 0,
  },
  pageHeaderInfo: {
    flex: 1,
    minWidth: 220,
  },
  pageHeaderTitle: {
    fontWeight: 600,
    letterSpacing: 0.1,
    fontSize: "1.2rem",
  },
  pageHeaderSubtitle: {
    marginTop: theme.spacing(0.25),
    color: "rgba(30,42,68,0.78)",
    fontSize: "0.8rem",
    lineHeight: 1.35,
  },
  pageHeaderActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  renewButton: {
    borderRadius: 10,
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.78rem",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  },
  whatsappButton: {
    borderRadius: 10,
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.78rem",
    color: "#fff",
    backgroundColor: "#25D366",
    "&:hover": {
      backgroundColor: "#1ebe57",
    },
  },
  mainPaper: {
    padding: theme.spacing(1.5),
    overflowY: "auto",
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "0 12px 26px rgba(17, 24, 39, 0.09)",
    ...theme.scrollbarStyles,
  },
  tableContainer: {
    overflowX: "auto",
  },
  table: {
    minWidth: 600,
  },
  tableHead: {
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(15, 23, 42, 0.03)",
  },
  tableHeadCell: {
    fontWeight: 700,
    color: theme.palette.text.secondary,
    padding: theme.spacing(1.25),
    fontSize: "0.76rem",
  },
  tableRow: {
    "&:hover": {
      backgroundColor: "rgba(0, 0, 0, 0.04)",
    },
    transition: "background-color 0.2s",
  },
  tableCell: {
    padding: theme.spacing(1.1),
    borderBottom: "1px solid rgba(224, 224, 224, 0.5)",
    fontSize: "0.78rem",
  },
  chipPaid: {
    backgroundColor: theme.palette.success.main,
    color: "#fff",
    fontWeight: "bold",
  },
  chipPending: {
    backgroundColor: theme.palette.warning.main,
    color: "#fff",
    fontWeight: "bold",
  },
  chipOverdue: {
    backgroundColor: theme.palette.error.main,
    color: "#fff",
    fontWeight: "bold",
  },
  avatarIcon: {
    backgroundColor: theme.palette.primary.main,
    marginRight: theme.spacing(1),
  },
  paymentButton: {
    borderRadius: 10,
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.74rem",
    minHeight: 34,
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
    color: "#fff",
    background: `linear-gradient(45deg, ${theme.palette.secondary.main} 30%, ${theme.palette.secondary.light} 90%)`,
    "&:hover": {
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    },
  },
  paidButton: {
    borderRadius: 10,
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.74rem",
    minHeight: 34,
    color: theme.palette.success.main,
    borderColor: theme.palette.success.main,
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: theme.spacing(3),
    padding: theme.spacing(2, 0),
    [theme.breakpoints.down("xs")]: {
      gridTemplateColumns: "1fr",
    },
  },
  card: {
    borderRadius: 14,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
    transition: "transform 0.2s, box-shadow 0.2s",
    "&:hover": {
      transform: "translateY(-4px)",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
    },
  },
  cardHeader: {
    paddingBottom: 0,
  },
  cardAvatar: {
    backgroundColor: theme.palette.primary.main,
  },
  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  detailItem: {
    display: "flex",
    alignItems: "center",
    marginBottom: theme.spacing(1),
  },
  detailIcon: {
    marginRight: theme.spacing(1),
    color: theme.palette.primary.main,
    fontSize: 16,
  },
  bold: {
    fontWeight: "bold",
  },
  statusDivider: {
    margin: theme.spacing(2, 0),
  },
  cardActions: {
    display: "flex",
    justifyContent: "flex-end",
    padding: theme.spacing(2),
  },
  mobileView: {
    display: "none",
    [theme.breakpoints.down("sm")]: {
      display: "block",
    },
  },
  desktopView: {
    display: "block",
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  invoiceCount: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    borderRadius: 20,
    padding: theme.spacing(0.5, 1.5),
    fontSize: 14,
    marginLeft: theme.spacing(1),
  },
  cardTitle: {
    fontSize: "0.9rem",
    fontWeight: 600,
  },
  cardSubheader: {
    fontSize: "0.72rem",
  },
  amountText: {
    fontSize: "1rem",
    fontWeight: 600,
  },
  expiredAlert: {
    marginBottom: theme.spacing(1.5),
    borderRadius: 10,
    border: "1px solid #fecaca",
    backgroundColor: "#fef2f2",
    color: "#991b1b",
    padding: theme.spacing(1.25, 1.5),
  },
  expiredAlertTitle: {
    fontWeight: 700,
    fontSize: "0.86rem",
    marginBottom: theme.spacing(0.25),
  },
  expiredAlertText: {
    fontSize: "0.78rem",
    lineHeight: 1.45,
  },
}));

// Painel "Minha assinatura" — mostra o plano contratado (tipo/nome, início e
// fim da vigência e valor), com histórico de faturas. Vive em Configurações
// (não no módulo Financeiro — este é sobre a assinatura da empresa com o
// AtendeFlow, o módulo Financeiro é sobre a operação da própria empresa).
// A marca Confianza Technologies aparece aqui porque é ela quem emite essa
// cobrança (ver Painel SaaS, exclusivo do Master).
const SubscriptionPanel = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchParam] = useState("");
  const [invoices, dispatch] = useReducer(reducer, []);
  const [storagePlans, setStoragePlans] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [companyPlan, setCompanyPlan] = useState(null);
  const [expiredLoginFlag, setExpiredLoginFlag] = useState(null);

  const readExpiredFlag = () => {
    try {
      const flagRaw = localStorage.getItem(SUBSCRIPTION_EXPIRED_FLAG_KEY);
      return flagRaw ? JSON.parse(flagRaw) : null;
    } catch (_) {
      return null;
    }
  };

  const isCompanyExpired =
    user?.company?.id !== 1 &&
    user?.company?.dueDate &&
    moment(user.company.dueDate).isValid() &&
    moment().isSameOrAfter(moment(user.company.dueDate), "day");

  const expiredDueDateLabel = (() => {
    if (isCompanyExpired) {
      return moment(user.company.dueDate).format("DD/MM/YYYY");
    }
    if (expiredLoginFlag?.dueDate && moment(expiredLoginFlag.dueDate).isValid()) {
      return moment(expiredLoginFlag.dueDate).format("DD/MM/YYYY");
    }
    return null;
  })();

  const showExpiredWarning = Boolean(isCompanyExpired || expiredLoginFlag);

  const handleOpenContactModal = (invoice) => {
    // Create a copy of the invoice but replace the value with the plan amount
    const invoiceWithPlanValue = {
      ...invoice,
      value: companyPlan && companyPlan.amount ? parseFloat(companyPlan.amount) : invoice.value
    };

    setStoragePlans(invoiceWithPlanValue);
    setSelectedContactId(null);
    setContactModalOpen(true);
  };

  const handleCloseContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(false);
  };

  // "Renovar plano": reaproveita a fatura mais recente (mesmo fluxo de
  // pagamento do botão "PAGAR" na tabela), sem exigir que o usuário procure
  // uma fatura específica na lista.
  const latestInvoice = invoices.length > 0 ? invoices[0] : null;
  const handleRenewPlan = () => {
    if (!latestInvoice) return;
    handleOpenContactModal(latestInvoice);
  };

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    const initialFlag = readExpiredFlag();
    setExpiredLoginFlag(initialFlag);
  }, []);

  useEffect(() => {
    if (!isCompanyExpired && expiredLoginFlag) {
      try {
        localStorage.removeItem(SUBSCRIPTION_EXPIRED_FLAG_KEY);
      } catch (_) {}
      setExpiredLoginFlag(null);
    }
  }, [isCompanyExpired, expiredLoginFlag]);

  // Fetch Company info first, then get the plan using the planId
  useEffect(() => {
    const fetchCompanyPlan = async () => {
      try {
        if (user && user.companyId) {
          // First get the company info to access its planId
          const companyResponse = await api.get(`/companies/${user.companyId}`);
          const company = companyResponse.data;

          if (company && company.planId) {
            // Now use the planId to get the plan details
            const planResponse = await api.get(`/plans/${company.planId}`);
            setCompanyPlan(planResponse.data);
          }
        }
      } catch (err) {
        toastError(err);
      }
    };
    fetchCompanyPlan();
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchInvoices = async () => {
        try {
          const { data } = await api.get("/invoices/all", {
            params: { searchParam, pageNumber },
          });

          dispatch({ type: "LOAD_INVOICES", payload: data });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchInvoices();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  const isLoadingFallback = !user || !user.companyId || !companyPlan;

  if (isLoadingFallback) {
    return (
      <div className={classes.pageRoot}>
        <Box display="flex" justifyContent="center" my={6}>
          <CircularProgress />
        </Box>
      </div>
    );
  }

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

  const rowStyle = (record) => {
    const hoje = moment(moment()).format("DD/MM/yyyy");
    const vencimento = moment(record.dueDate).format("DD/MM/yyyy");
    var diff = moment(vencimento, "DD/MM/yyyy").diff(moment(hoje, "DD/MM/yyyy"));
    var dias = moment.duration(diff).asDays();
    if (dias < 0 && record.status !== "paid") {
      return { backgroundColor: "rgba(255, 188, 188, 0.15)" };
    }
  };

  const getInvoiceStatus = (record) => {
    const hoje = moment(moment()).format("DD/MM/yyyy");
    const vencimento = moment(record.dueDate).format("DD/MM/yyyy");
    var diff = moment(vencimento, "DD/MM/yyyy").diff(moment(hoje, "DD/MM/yyyy"));
    var dias = moment.duration(diff).asDays();
    const status = record.status;
    if (status === "paid") {
      return { text: "Pago", chip: classes.chipPaid, icon: <CheckCircleIcon /> };
    }
    if (dias < 0) {
      return { text: "Vencido", chip: classes.chipOverdue, icon: <ErrorIcon /> };
    } else {
      return { text: "Em Aberto", chip: classes.chipPending, icon: <HourglassEmptyIcon /> };
    }
  };

  const renderDaysLeft = (record) => {
    const hoje = moment(moment()).format("DD/MM/yyyy");
    const vencimento = moment(record.dueDate).format("DD/MM/yyyy");
    var diff = moment(vencimento, "DD/MM/yyyy").diff(moment(hoje, "DD/MM/yyyy"));
    var dias = moment.duration(diff).asDays();

    if (record.status === "paid") {
      return null;
    }

    if (dias < 0) {
      return `Vencido há ${Math.abs(Math.floor(dias))} dias`;
    } else if (dias === 0) {
      return "Vence hoje";
    } else {
      return `Vence em ${Math.floor(dias)} dias`;
    }
  };

  // Renderização de cards para visualização móvel
  const renderMobileCards = () => {
    if (loading && invoices.length === 0) {
      return (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      );
    }

    return (
      <div className={classes.cardGrid}>
        {invoices.map((invoice) => {
          const statusInfo = getInvoiceStatus(invoice);
          return (
            <Card key={invoice.id} className={classes.card}>
              <CardHeader
                className={classes.cardHeader}
                avatar={
                  <Avatar className={classes.cardAvatar}>
                    <ReceiptIcon />
                  </Avatar>
                }
                title={
                  <Typography className={classes.cardTitle} component="h2">
                    {invoice.detail}
                  </Typography>
                }
                subheader={
                  <Typography className={classes.cardSubheader}>
                    ID: {invoice.id}
                  </Typography>
                }
              />
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Chip
                    icon={statusInfo.icon}
                    label={statusInfo.text}
                    className={statusInfo.chip}
                    size="small"
                  />
                  <Typography variant="body2" color="textSecondary">
                    {renderDaysLeft(invoice)}
                  </Typography>
                </Box>

                <Divider className={classes.statusDivider} />

                <div className={classes.detailsGrid}>
                  <div className={classes.detailItem}>
                    <PersonIcon className={classes.detailIcon} />
                    <Typography variant="body2">
                      {companyPlan && companyPlan.users} usuários
                    </Typography>
                  </div>
                  <div className={classes.detailItem}>
                    <DevicesIcon className={classes.detailIcon} />
                    <Typography variant="body2">
                      {companyPlan && companyPlan.connections} conexões
                    </Typography>
                  </div>
                  <div className={classes.detailItem}>
                    <QueueIcon className={classes.detailIcon} />
                    <Typography variant="body2">
                      {companyPlan && companyPlan.queues} filas
                    </Typography>
                  </div>
                  <div className={classes.detailItem}>
                    <DateRangeIcon className={classes.detailIcon} />
                    <Typography variant="body2">
                      {moment(invoice.dueDate).format("DD/MM/YYYY")}
                    </Typography>
                  </div>
                </div>

                <Box mt={3}>
                  <Typography className={classes.amountText} color="primary">
                    <MoneyIcon className={classes.detailIcon} />
                    {companyPlan && companyPlan.amount
                      ? parseFloat(companyPlan.amount).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })
                      : invoice.value.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })}
                  </Typography>
                </Box>

                <Box mt={3} display="flex" justifyContent="flex-end">
                  {statusInfo.text !== "Pago" ? (
                    <Button
                      variant="contained"
                      className={classes.paymentButton}
                      startIcon={<PaymentIcon />}
                      onClick={() => handleOpenContactModal(invoice)}
                    >
                      PAGAR AGORA
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      className={classes.paidButton}
                      startIcon={<CheckCircleIcon />}
                    >
                      PAGO
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className={classes.pageRoot}>
      <SubscriptionModal
        open={contactModalOpen}
        onClose={handleCloseContactModal}
        aria-labelledby="form-dialog-title"
        Invoice={storagePlans}
        contactId={selectedContactId}
      />

      <Box className={classes.pageHeader}>
        <img src={confianzaLogo} alt="Confianza Technologies" className={classes.pageHeaderLogo} />
        <Box className={classes.pageHeaderInfo}>
          <Typography className={classes.pageHeaderTitle}>Minha assinatura</Typography>
          <Typography className={classes.pageHeaderSubtitle}>
            Plano contratado, vigência e cobranças emitidas por Confianza Technologies,
            fornecedora do AtendeFlow.
          </Typography>
        </Box>
        <Box className={classes.pageHeaderActions}>
          <Tooltip title={latestInvoice ? "" : "Nenhuma fatura disponível"}>
            <span>
              <Button
                variant="contained"
                color="primary"
                className={classes.renewButton}
                startIcon={<AutorenewIcon />}
                disabled={!latestInvoice}
                onClick={handleRenewPlan}
              >
                Renovar plano
              </Button>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            className={classes.whatsappButton}
            startIcon={<WhatsAppIcon />}
            component="a"
            href={SUPPORT_WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
          >
            Suporte
          </Button>
        </Box>
      </Box>

      {showExpiredWarning && (
        <Box className={classes.expiredAlert}>
          <Typography className={classes.expiredAlertTitle}>
            Assinatura vencida
          </Typography>
          <Typography className={classes.expiredAlertText}>
            {expiredDueDateLabel
              ? `Sua assinatura venceu em ${expiredDueDateLabel}. Para continuar utilizando o sistema, realize o pagamento desta cobrança. A liberação acontece automaticamente após a confirmação.`
              : "Sua assinatura venceu. Para continuar utilizando o sistema, realize o pagamento desta cobrança. A liberação acontece automaticamente após a confirmação."}
          </Typography>
        </Box>
      )}

      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        {/* Visualização móvel (cards) */}
        <div className={classes.mobileView}>
          {renderMobileCards()}
        </div>

        {/* Visualização desktop (tabela) */}
        <div className={classes.desktopView}>
          <div className={classes.tableContainer}>
            <Table className={classes.table} size="small">
              <TableHead className={classes.tableHead}>
                <TableRow>
                  <TableCell className={classes.tableHeadCell}>
                    <Tooltip title="Detalhes da fatura">
                      <Box display="flex" alignItems="center">
                        <InfoIcon fontSize="small" style={{ marginRight: 8 }} />
                        Detalhes
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell className={classes.tableHeadCell} align="center">
                    <Tooltip title="Número de usuários">
                      <Box display="flex" alignItems="center" justifyContent="center">
                        <PersonIcon fontSize="small" style={{ marginRight: 8 }} />
                        Usuários
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell className={classes.tableHeadCell} align="center">
                    <Tooltip title="Número de conexões">
                      <Box display="flex" alignItems="center" justifyContent="center">
                        <DevicesIcon fontSize="small" style={{ marginRight: 8 }} />
                        Conexões
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell className={classes.tableHeadCell} align="center">
                    <Tooltip title="Número de filas">
                      <Box display="flex" alignItems="center" justifyContent="center">
                        <QueueIcon fontSize="small" style={{ marginRight: 8 }} />
                        Filas
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell className={classes.tableHeadCell} align="center">
                    <Tooltip title="Valor da fatura">
                      <Box display="flex" alignItems="center" justifyContent="center">
                        <MoneyIcon fontSize="small" style={{ marginRight: 8 }} />
                        Valor
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell className={classes.tableHeadCell} align="center">
                    <Tooltip title="Data de vencimento">
                      <Box display="flex" alignItems="center" justifyContent="center">
                        <DateRangeIcon fontSize="small" style={{ marginRight: 8 }} />
                        Vencimento
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell className={classes.tableHeadCell} align="center">Status</TableCell>
                  <TableCell className={classes.tableHeadCell} align="center">Ação</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((invoice) => {
                  const statusInfo = getInvoiceStatus(invoice);
                  return (
                    <TableRow
                      key={invoice.id}
                      style={rowStyle(invoice)}
                      className={classes.tableRow}
                    >
                      <TableCell className={classes.tableCell}>{companyPlan.name}</TableCell>
                      <TableCell className={classes.tableCell} align="center">{companyPlan && companyPlan.users}</TableCell>
                      <TableCell className={classes.tableCell} align="center">{companyPlan && companyPlan.connections}</TableCell>
                      <TableCell className={classes.tableCell} align="center">{companyPlan && companyPlan.queues}</TableCell>
                      <TableCell className={classes.tableCell} align="center" style={{ fontWeight: 'bold' }}>
                        {companyPlan && companyPlan.amount
                          ? parseFloat(companyPlan.amount).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })
                          : invoice.value.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                      <TableCell className={classes.tableCell} align="center">
                        <Box display="flex" flexDirection="column">
                          <Typography variant="body2">
                            {moment(invoice.dueDate).format("DD/MM/YYYY")}
                          </Typography>
                          <Typography className={classes.cardSubheader} color="textSecondary">
                            {renderDaysLeft(invoice)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell className={classes.tableCell} align="center">
                        <Chip
                          icon={statusInfo.icon}
                          label={statusInfo.text}
                          className={statusInfo.chip}
                          size="small"
                        />
                      </TableCell>
                      <TableCell className={classes.tableCell} align="center">
                        {statusInfo.text !== "Pago" ? (
                          <Button
                            size="small"
                            variant="contained"
                            className={classes.paymentButton}
                            startIcon={<PaymentIcon />}
                            onClick={() => handleOpenContactModal(invoice)}
                          >
                            PAGAR
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            variant="outlined"
                            className={classes.paidButton}
                            startIcon={<CheckCircleIcon />}
                          >
                            PAGO
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {loading && <TableRowSkeleton columns={8} />}
              </TableBody>
            </Table>
          </div>
        </div>
      </Paper>
    </div>
  );
};

export default SubscriptionPanel;
