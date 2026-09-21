/* eslint-disable no-unused-vars */

import React, { useState, useEffect, useReducer, useContext } from "react";
import { toast } from "react-toastify";

import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import DescriptionIcon from "@material-ui/icons/Description";
import FileCopyOutlinedIcon from "@material-ui/icons/FileCopyOutlined";
import PlayCircleOutlineIcon from "@material-ui/icons/PlayCircleOutline";
import PauseCircleOutlineIcon from "@material-ui/icons/PauseCircleOutline";
import AddIcon from "@material-ui/icons/Add";

import MainHeader from "../../components/MainHeader";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import CampaignModal from "../../components/CampaignModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import {
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip
} from "@material-ui/core";
import SendIcon from "@material-ui/icons/Send";
import VerifiedUserIcon from "@material-ui/icons/VerifiedUser";
import { isArray } from "lodash";
import { useDate } from "../../hooks/useDate";
import ForbiddenPage from "../../components/ForbiddenPage";
import usePlans from "../../hooks/usePlans";
import { AuthContext } from "../../context/Auth/AuthContext";
import OfficialCampaignsTab from "../../components/OfficialCampaignsTab";

const reducer = (state, action) => {
  if (action.type === "LOAD_CAMPAIGNS") {
    const campaigns = action.payload;
    const newCampaigns = [];

    if (isArray(campaigns)) {
      campaigns.forEach((campaign) => {
        const campaignIndex = state.findIndex((u) => u.id === campaign.id);
        if (campaignIndex !== -1) {
          state[campaignIndex] = campaign;
        } else {
          newCampaigns.push(campaign);
        }
      });
    }

    return [...state, ...newCampaigns];
  }

  if (action.type === "UPDATE_CAMPAIGNS") {
    const campaign = action.payload;
    const campaignIndex = state.findIndex((u) => u.id === campaign.id);

    if (campaignIndex !== -1) {
      state[campaignIndex] = campaign;
      return [...state];
    } else {
      return [campaign, ...state];
    }
  }

  if (action.type === "DELETE_CAMPAIGN") {
    const campaignId = action.payload;

    const campaignIndex = state.findIndex((u) => u.id === campaignId);
    if (campaignIndex !== -1) {
      state.splice(campaignIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }

  return state;
};

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    padding: theme.spacing(2),
    height: "calc(100% - 48px)",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
      height: "auto",
      minHeight: "calc(100vh - 48px)",
      overflowY: "auto",
    },
  },
  // ── Channel tabs ─────────────────────────────────────────────────────────
  pageTabs: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    width: "100%",
    marginBottom: theme.spacing(2),
    padding: 0,
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(248,250,252,0.96)",
    boxShadow:
      theme.palette.type === "dark"
        ? "inset 0 1px 0 rgba(255,255,255,0.04)"
        : "0 3px 10px rgba(15,23,42,0.04)",
  },
  pageTabButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    padding: theme.spacing(1.6, 2),
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "0.92rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#475569",
    transition: "all 0.18s ease",
    position: "relative",
    textAlign: "center",
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.04)"
          : "rgba(255,255,255,0.7)",
      color: theme.palette.type === "dark" ? "#e2e8f0" : "#0f172a",
    },
  },
  pageTabButtonActive: {
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.08)",
    color: theme.palette.type === "dark" ? "#c7d2fe" : "#3730a3",
    "&::after": {
      content: "\"\"",
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 3,
      backgroundColor: theme.palette.type === "dark" ? "#818cf8" : "#4f46e5",
    },
  },
  pageTabsDivider: {
    padding: theme.spacing(0, 1),
    fontSize: "1rem",
    fontWeight: 700,
    color: theme.palette.type === "dark" ? "#475569" : "#94a3b8",
    userSelect: "none",
  },

  headerChip: {
    backgroundColor: "#EAF1FF",
    color: "#2f4b7c",
    border: "1px solid #d7e5ff",
    fontWeight: 500,
    fontSize: "0.7rem",
    height: 22,
  },
  controlsPaper: {
    marginBottom: theme.spacing(2),
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.08)",
    padding: theme.spacing(1),
    backgroundColor: theme.palette.background.paper,
  },
  warningPaper: {
    marginBottom: theme.spacing(2),
    borderRadius: 12,
    border: "1px solid #ffe0b2",
    backgroundColor: "#fff8e1",
    padding: theme.spacing(1.5, 2),
  },
  warningTitle: {
    fontWeight: 700,
    color: "#8a4b00",
    fontSize: "0.82rem",
    marginBottom: theme.spacing(0.5),
  },
  warningText: {
    color: "#7a4a12",
    fontSize: "0.78rem",
    lineHeight: 1.45,
  },
  searchField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 9,
      backgroundColor: theme.palette.background.default,
    },
    "& .MuiInputBase-input": {
      fontSize: "0.78rem",
      paddingTop: 10,
      paddingBottom: 10,
    },
    "& .MuiInputLabel-outlined": {
      fontSize: "0.78rem",
    },
  },
  compactSelect: {
    "& .MuiInputLabel-outlined": {
      fontSize: "0.78rem",
      transform: "translate(14px, 11px) scale(1)",
    },
    "& .MuiInputLabel-outlined.MuiInputLabel-shrink": {
      transform: "translate(14px, -6px) scale(0.75)",
    },
    "& .MuiOutlinedInput-input": {
      paddingTop: 10,
      paddingBottom: 10,
      display: "flex",
      alignItems: "center",
    },
  },
  actionButton: {
    minHeight: 36,
    borderRadius: 9,
    fontWeight: 600,
    fontSize: "0.72rem",
    padding: theme.spacing(0.6, 1.1),
    boxShadow: "0 4px 10px rgba(7, 64, 171, 0.12)",
    whiteSpace: "nowrap",
    "& .MuiButton-label": {
      whiteSpace: "nowrap",
    },
  },
  controlsActions: {
    display: "flex",
    gap: theme.spacing(0.75),
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "nowrap",
    [theme.breakpoints.down("sm")]: {
      justifyContent: "flex-start",
      flexWrap: "wrap",
    },
  },
  mainPaper: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    ...theme.scrollbarStyles,
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "0 12px 26px rgba(17, 24, 39, 0.09)",
    [theme.breakpoints.down("sm")]: {
      flex: "0 0 auto",
      minHeight: "48vh",
      maxHeight: "62vh",
      overflowX: "auto",
    },
  },
  tableHeaderCell: {
    fontWeight: 700,
    color: theme.palette.text.secondary,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(15, 23, 42, 0.03)",
    fontSize: "0.76rem",
  },
  tableRow: {
    transition: "background-color 0.2s ease",
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.03)"
          : "rgba(15, 23, 42, 0.035)",
    },
  },
  tableCellText: {
    fontSize: "0.78rem",
  },
  actionCell: {
    minWidth: 170,
  },
  actionsCell: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    justifyContent: "center",
  },
  actionIconButton: {
    width: 30,
    height: 30,
    borderRadius: 6,
    border: `1px solid ${theme.palette.divider}`,
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.08)"
          : "rgba(15,23,42,0.06)",
      color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
    },
  },
  actionIconButtonDanger: {
    "&:hover": {
      backgroundColor: "rgba(239,68,68,0.08)",
      borderColor: "rgba(239,68,68,0.4)",
      color: "#ef4444",
    },
  },
}));

const Campaigns = () => {
  const classes = useStyles();
  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [deletingCampaign, setDeletingCampaign] = useState(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [contactListNameFilter, setContactListNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [whatsappIdFilter, setWhatsappIdFilter] = useState("");
  const [scheduledDateFilter, setScheduledDateFilter] = useState("");
  const [whatsapps, setWhatsapps] = useState([]);
  const [duplicateCampaignData, setDuplicateCampaignData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [campaigns, dispatch] = useReducer(reducer, []);
  //   const socketManager = useContext(SocketContext);
  const { user, socket } = useContext(AuthContext);


  const { datetimeToClient } = useDate();
  const { getPlanCompany } = usePlans();

  useEffect(() => {
    async function fetchData() {
      const companyId = user?.companyId;
      if (!companyId) return;

      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs?.plan?.useCampaigns) {
        toast.error("Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando.");
        setTimeout(() => {
          history.push(`/`);
        }, 1000);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [
    searchParam,
    contactListNameFilter,
    statusFilter,
    whatsappIdFilter,
    scheduledDateFilter,
  ]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      fetchCampaigns();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchParam,
    contactListNameFilter,
    statusFilter,
    whatsappIdFilter,
    scheduledDateFilter,
    pageNumber
  ]);

  useEffect(() => {
    const companyId = user?.companyId;
    if (!companyId) return;

    api
      .get("/whatsapp", { params: { companyId, session: 0 } })
      .then(({ data }) => {
        setWhatsapps(isArray(data) ? data : []);
      })
      .catch(() => {
        setWhatsapps([]);
      });
  }, [user?.companyId]);

  useEffect(() => {
    const companyId = user?.companyId;
    if (!companyId || !socket) return;
    // const socket = socketManager.GetSocket();

    const onCompanyCampaign = (data) => {
      if (!data) return;

      const hasActiveFilters = Boolean(
        searchParam ||
          contactListNameFilter ||
          statusFilter ||
          whatsappIdFilter ||
          scheduledDateFilter
      );

      if (data.action === "update" || data.action === "create") {
        if (hasActiveFilters) {
          dispatch({ type: "RESET" });
          setPageNumber(1);
          fetchCampaigns(1);
          return;
        }
        dispatch({ type: "UPDATE_CAMPAIGNS", payload: data.record });
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE_CAMPAIGN", payload: +data.id });
      }
    }

    socket.on(`company-${companyId}-campaign`, onCompanyCampaign);
    return () => {
      socket.off(`company-${companyId}-campaign`, onCompanyCampaign);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    socket,
    user?.companyId,
    searchParam,
    contactListNameFilter,
    statusFilter,
    whatsappIdFilter,
    scheduledDateFilter
  ]);

  const fetchCampaigns = async (forcedPageNumber) => {
    try {
      const currentPageNumber = forcedPageNumber || pageNumber;
      const { data } = await api.get("/campaigns/", {
        params: {
          searchParam,
          contactListName: contactListNameFilter,
          status: statusFilter,
          whatsappId: whatsappIdFilter,
          scheduledDate: scheduledDateFilter,
          pageNumber: currentPageNumber
        },
      });
      if (currentPageNumber === 1) {
        dispatch({ type: "RESET" });
      }
      dispatch({ type: "LOAD_CAMPAIGNS", payload: data.records });
      setHasMore(data.hasMore);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCampaignModal = () => {
    setSelectedCampaign(null);
    setDuplicateCampaignData(null);
    setCampaignModalOpen(true);
  };

  const handleCloseCampaignModal = () => {
    setSelectedCampaign(null);
    setDuplicateCampaignData(null);
    setCampaignModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleContactListNameFilter = (event) => {
    setContactListNameFilter(event.target.value.toLowerCase());
  };

  const handleStatusFilter = (event) => {
    setStatusFilter(event.target.value);
  };

  const handleWhatsappIdFilter = (event) => {
    setWhatsappIdFilter(event.target.value);
  };

  const handleScheduledDateFilter = (event) => {
    setScheduledDateFilter(event.target.value);
  };

  const handleClearFilters = () => {
    setSearchParam("");
    setContactListNameFilter("");
    setStatusFilter("");
    setWhatsappIdFilter("");
    setScheduledDateFilter("");
  };

  const handleEditCampaign = (campaign) => {
    setDuplicateCampaignData(null);
    setSelectedCampaign(campaign);
    setCampaignModalOpen(true);
  };

  const handleDuplicateCampaign = (campaign) => {
    const duplicatedCampaign = {
      name: `${campaign.name} (Cópia)`,
      message1: campaign.message1 || "",
      message2: campaign.message2 || "",
      message3: campaign.message3 || "",
      message4: campaign.message4 || "",
      message5: campaign.message5 || "",
      confirmationMessage1: campaign.confirmationMessage1 || "",
      confirmationMessage2: campaign.confirmationMessage2 || "",
      confirmationMessage3: campaign.confirmationMessage3 || "",
      confirmationMessage4: campaign.confirmationMessage4 || "",
      confirmationMessage5: campaign.confirmationMessage5 || "",
      status: "INATIVA",
      confirmation: !!campaign.confirmation,
      scheduledAt: "",
      contactListId: campaign.contactListId || "",
      tagListId: campaign.tagListId || "",
      companyId: campaign.companyId,
      whatsappId: campaign.whatsappId || "",
      statusTicket: campaign.statusTicket || "closed",
      openTicket: campaign.openTicket || "disabled",
      fileListId: campaign.fileListId || "",
      userId: campaign.userId || null,
      queueId: campaign.queueId || null,
      mediaPath: campaign.mediaPath || null,
      mediaName: campaign.mediaName || null
    };

    setSelectedCampaign(null);
    setDuplicateCampaignData(duplicatedCampaign);
    setCampaignModalOpen(true);
  };

  const handleDeleteCampaign = async (campaignId) => {
    try {
      await api.delete(`/campaigns/${campaignId}`);
      toast.success(i18n.t("campaigns.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingCampaign(null);
    setSearchParam("");
    setPageNumber(1);
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

  const formatStatus = (val) => {
    switch (val) {
      case "INATIVA":
        return "Inativa";
      case "PROGRAMADA":
        return "Programada";
      case "EM_ANDAMENTO":
        return "Em Andamento";
      case "CANCELADA":
        return "Cancelada";
      case "FINALIZADA":
        return "Finalizada";
      default:
        return val;
    }
  };

  const cancelCampaign = async (campaign) => {
    try {
      await api.post(`/campaigns/${campaign.id}/cancel`);
      toast.success(i18n.t("campaigns.toasts.cancel"));
      setPageNumber(1);
      fetchCampaigns(1);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const restartCampaign = async (campaign) => {
    try {
      await api.post(`/campaigns/${campaign.id}/restart`);
      toast.success(i18n.t("campaigns.toasts.restart"));
      setPageNumber(1);
      fetchCampaigns(1);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className={classes.pageRoot}>
      <ConfirmationModal
        title={
          deletingCampaign &&
          `${i18n.t("campaigns.confirmationModal.deleteTitle")} ${deletingCampaign.name}?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => deletingCampaign && handleDeleteCampaign(deletingCampaign.id)}
      >
        {i18n.t("campaigns.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      {campaignModalOpen && (
        <CampaignModal
          resetPagination={() => {
            setPageNumber(1);
            fetchCampaigns(1);
          }}
          open={campaignModalOpen}
          onClose={handleCloseCampaignModal}
          aria-labelledby="form-dialog-title"
          initialValues={duplicateCampaignData}
          campaignId={selectedCampaign && selectedCampaign.id}
        />
      )}
      {
        user?.profile === "user"?
          <ForbiddenPage />
          :
          <>
            <div className={classes.pageTabs}>
              <button
                type="button"
                className={`${classes.pageTabButton} ${
                  activeTab === 0 ? classes.pageTabButtonActive : ""
                }`}
                onClick={() => setActiveTab(0)}
              >
                <SendIcon fontSize="small" />
                API não oficial
              </button>
              <span className={classes.pageTabsDivider}>|</span>
              <button
                type="button"
                className={`${classes.pageTabButton} ${
                  activeTab === 1 ? classes.pageTabButtonActive : ""
                }`}
                onClick={() => setActiveTab(1)}
              >
                <VerifiedUserIcon fontSize="small" />
                API oficial
              </button>
            </div>
            {activeTab === 0 ? (
            <MainHeader>
              <Grid style={{ width: "100%" }} container>
                <Grid item xs={12}>
                  <Paper elevation={0} className={classes.controlsPaper}>
                    <Grid spacing={2} container>
                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          fullWidth
                          placeholder="Nome da campanha"
                          type="search"
                          value={searchParam}
                          onChange={handleSearch}
                          variant="outlined"
                          size="small"
                          className={classes.searchField}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon style={{ color: "gray" }} />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={2}>
                        <TextField
                          fullWidth
                          placeholder="Nome da lista"
                          type="search"
                          value={contactListNameFilter}
                          onChange={handleContactListNameFilter}
                          variant="outlined"
                          size="small"
                          className={classes.searchField}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon style={{ color: "gray" }} />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={4} md={1}>
                        <TextField
                          fullWidth
                          label="Data"
                          type="date"
                          value={scheduledDateFilter}
                          onChange={handleScheduledDateFilter}
                          variant="outlined"
                          size="small"
                          className={classes.searchField}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={4} md={2}>
                        <FormControl
                          variant="outlined"
                          fullWidth
                          className={`${classes.searchField} ${classes.compactSelect}`}
                        >
                          <InputLabel id="campaign-whatsapp-filter-label">
                            Conexão
                          </InputLabel>
                          <Select
                            labelId="campaign-whatsapp-filter-label"
                            value={whatsappIdFilter}
                            onChange={handleWhatsappIdFilter}
                            label="Conexão"
                            size="small"
                          >
                            <MenuItem value="">
                              <em>Todas</em>
                            </MenuItem>
                            {whatsapps.map((whatsapp) => (
                              <MenuItem key={whatsapp.id} value={String(whatsapp.id)}>
                                {whatsapp.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={4} md={2}>
                        <FormControl
                          variant="outlined"
                          fullWidth
                          className={`${classes.searchField} ${classes.compactSelect}`}
                        >
                          <InputLabel id="campaign-status-filter-label">Status</InputLabel>
                          <Select
                            labelId="campaign-status-filter-label"
                            value={statusFilter}
                            onChange={handleStatusFilter}
                            label="Status"
                            size="small"
                          >
                            <MenuItem value="">
                              <em>Todos</em>
                            </MenuItem>
                            <MenuItem value="INATIVA">Inativa</MenuItem>
                            <MenuItem value="PROGRAMADA">Programada</MenuItem>
                            <MenuItem value="EM_ANDAMENTO">Em andamento</MenuItem>
                            <MenuItem value="CANCELADA">Cancelada</MenuItem>
                            <MenuItem value="FINALIZADA">Finalizada</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={12} md={2}>
                        <div className={classes.controlsActions}>
                          <Button
                            variant="outlined"
                            onClick={handleClearFilters}
                            className={classes.actionButton}
                          >
                            Limpar
                          </Button>
                          <Button
                            variant="contained"
                            onClick={handleOpenCampaignModal}
                            color="primary"
                            className={classes.actionButton}
                            startIcon={<AddIcon />}
                          >
                            {i18n.t("campaigns.buttons.add")}
                          </Button>
                        </div>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
                <Grid item xs={12}>
                  <Paper elevation={0} className={classes.warningPaper}>
                    <Typography className={classes.warningTitle}>
                      Leia com atenção
                    </Typography>
                    <Typography className={classes.warningText}>
                      Envios em massa feitos sem controle de qualidade, sem consentimento dos contatos ou com alto volume de denúncias podem levar ao bloqueio/banimento do número pelo provedor do canal. A plataforma apenas disponibiliza a ferramenta de disparo e não tem controle sobre reputação da linha, conteúdo enviado, frequência de mensagens ou denúncias recebidas, ficando isenta de responsabilidade por bloqueios decorrentes da operação do número.
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </MainHeader>
            ) : null}
            {activeTab === 0 ? (
            <Paper
              className={classes.mainPaper}
              variant="outlined"
              onScroll={handleScroll}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell align="center" className={classes.tableHeaderCell}>
                      {i18n.t("campaigns.table.name")}
                    </TableCell>
                    <TableCell align="center" className={classes.tableHeaderCell}>
                      {i18n.t("campaigns.table.status")}
                    </TableCell>
                    <TableCell align="center" className={classes.tableHeaderCell}>
                      {i18n.t("campaigns.table.contactList")}
                    </TableCell>
                    <TableCell align="center" className={classes.tableHeaderCell}>
                      {i18n.t("campaigns.table.whatsapp")}
                    </TableCell>
                    <TableCell align="center" className={classes.tableHeaderCell}>
                      {i18n.t("campaigns.table.scheduledAt")}
                    </TableCell>
                    <TableCell align="center" className={classes.tableHeaderCell}>
                      {i18n.t("campaigns.table.completedAt")}
                    </TableCell>
                    <TableCell align="center" className={classes.tableHeaderCell}>
                      {i18n.t("campaigns.table.confirmation")}
                    </TableCell>
                    <TableCell align="center" className={classes.tableHeaderCell}>
                      {i18n.t("campaigns.table.actions")}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <>
                    {campaigns.map((campaign) => (
                      <TableRow key={campaign.id} className={classes.tableRow}>
                        <TableCell align="center" className={classes.tableCellText}>{campaign.name}</TableCell>
                        <TableCell align="center" className={classes.tableCellText}>
                          {formatStatus(campaign.status)}
                        </TableCell>
                        <TableCell align="center" className={classes.tableCellText}>
                          {campaign.contactListId
                            ? campaign.contactList?.name || "Não definida"
                            : "Não definida"}
                        </TableCell>
                        <TableCell align="center" className={classes.tableCellText}>
                          {campaign.whatsappId
                            ? campaign.whatsapp?.name || "Não definido"
                            : "Não definido"}
                        </TableCell>
                        <TableCell align="center" className={classes.tableCellText}>
                          {campaign.scheduledAt
                            ? datetimeToClient(campaign.scheduledAt)
                            : "Sem agendamento"}
                        </TableCell>
                        <TableCell align="center" className={classes.tableCellText}>
                          {campaign.completedAt
                            ? datetimeToClient(campaign.completedAt)
                            : "Não concluída"}
                        </TableCell>
                        <TableCell align="center" className={classes.tableCellText}>
                          <Tooltip
                            title={campaign.confirmation ? "Confirmação de envio habilitada" : "Confirmação de envio desabilitada"}
                            arrow
                          >
                            <span
                              style={{
                                display: "inline-block",
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                backgroundColor: campaign.confirmation ? "#22c55e" : "#ef4444"
                              }}
                            />
                          </Tooltip>
                        </TableCell>
                        <TableCell align="center" className={classes.actionCell}>
                          <div className={classes.actionsCell}>
                            {campaign.status === "EM_ANDAMENTO" && (
                              <Tooltip title="Parar Campanha" arrow>
                                <IconButton
                                  onClick={() => cancelCampaign(campaign)}
                                  size="small"
                                  className={classes.actionIconButton}
                                >
                                  <PauseCircleOutlineIcon style={{ fontSize: 15 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            {campaign.status === "CANCELADA" && (
                              <Tooltip title="Reiniciar Campanha" arrow>
                                <IconButton
                                  onClick={() => restartCampaign(campaign)}
                                  size="small"
                                  className={classes.actionIconButton}
                                >
                                  <PlayCircleOutlineIcon style={{ fontSize: 15 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            {campaign.status === "FINALIZADA" && (
                              <Tooltip title="Duplicar Campanha" arrow>
                                <IconButton
                                  onClick={() => handleDuplicateCampaign(campaign)}
                                  size="small"
                                  className={classes.actionIconButton}
                                >
                                  <FileCopyOutlinedIcon style={{ fontSize: 15 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Relatório" arrow>
                              <IconButton
                                onClick={() =>
                                  history.push(`/campaign/${campaign.id}/report`)
                                }
                                size="small"
                                className={classes.actionIconButton}
                              >
                                <DescriptionIcon style={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Editar Campanha" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleEditCampaign(campaign)}
                                className={classes.actionIconButton}
                              >
                                <EditIcon style={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Excluir Campanha" arrow>
                              <IconButton
                                size="small"
                                className={`${classes.actionIconButton} ${classes.actionIconButtonDanger}`}
                                onClick={(e) => {
                                  setConfirmModalOpen(true);
                                  setDeletingCampaign(campaign);
                                }}
                              >
                                <DeleteOutlineIcon style={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {loading && <TableRowSkeleton columns={8} />}
                  </>
                </TableBody>
              </Table>
            </Paper>
            ) : (
              <OfficialCampaignsTab />
            )}
          </>}
    </div>
  );
};

export default Campaigns;
