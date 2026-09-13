import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import { useDebouncedCallback } from "use-debounce";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import Board from "react-trello";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import { useHistory } from "react-router-dom";
import {
  Typography,
  Button,
  TextField,
  Box,
  Paper,
  Grid,
  IconButton,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle
} from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import EditIcon from "@material-ui/icons/Edit";
import { format } from "date-fns";
import NumberFormat from "react-number-format";
import { Can } from "../../components/Can";
import MainHeader from "../../components/MainHeader";
import TagModal from "../../components/TagModal";
import formatToCurrency from "../../utils/formatToCurrency";

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    padding: theme.spacing(2),
    minHeight: "calc(100% - 48px)",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    ...theme.scrollbarStyles,
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
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
      padding: theme.spacing(2),
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
  filterCard: {
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.08)",
    padding: theme.spacing(1.25),
    marginBottom: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
  },
  dateInput: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 14,
      backgroundColor:
        theme.mode === "light" ? "#f8fbff" : theme.palette.background.default,
      transition: "all 0.2s ease",
      "& .MuiOutlinedInput-notchedOutline": {
        borderColor:
          theme.mode === "light"
            ? "rgba(37, 99, 235, 0.22)"
            : "rgba(148, 163, 184, 0.35)",
        borderWidth: 1.5,
      },
      "&:hover .MuiOutlinedInput-notchedOutline": {
        borderColor:
          theme.mode === "light"
            ? "rgba(29, 78, 216, 0.42)"
            : "rgba(148, 163, 184, 0.55)",
      },
      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
        borderColor: theme.palette.primary.main,
        borderWidth: 2,
      },
    },
    "& .MuiInputBase-input": {
      fontSize: "0.82rem",
      paddingTop: 12,
      paddingBottom: 12,
      color: theme.palette.text.primary,
    },
    "& .MuiInputLabel-outlined": {
      fontSize: "0.8rem",
      color: theme.palette.text.secondary,
    },
    "& .MuiOutlinedInput-inputMarginDense": {
      paddingTop: 11,
      paddingBottom: 11,
    },
    "& input[type='date']::-webkit-calendar-picker-indicator": {
      cursor: "pointer",
      filter: theme.mode === "light" ? "none" : "invert(0.82)",
    },
  },
  actionButton: {
    minHeight: 42,
    borderRadius: 10,
    fontWeight: 600,
    fontSize: "0.75rem",
    padding: theme.spacing(0.8, 1.4),
    boxShadow: "0 6px 14px rgba(7, 64, 171, 0.14)",
  },
  helperText: {
    fontSize: "0.8rem",
  },
  laneHeaderContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    width: "100%",
    gap: theme.spacing(0.5),
  },
  laneHeaderRight: {
    marginLeft: "auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 1,
  },
  laneHeaderLabel: {
    fontSize: "0.78rem",
    opacity: 0.9,
    fontWeight: 600,
  },
  laneHeaderValueSum: {
    fontSize: "0.65rem",
    fontWeight: 600,
    opacity: 0.82,
    whiteSpace: "nowrap",
  },
  laneHeaderTitle: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  laneHeaderEditButton: {
    color: "inherit",
    padding: 2,
  },
  boardShell: {
    flex: 1,
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "0 12px 26px rgba(17, 24, 39, 0.09)",
    backgroundColor: theme.palette.background.paper,
    minHeight: 0,
    padding: theme.spacing(1.5),
    overflow: "auto",
    ...theme.scrollbarStyles,
  },
  boardScroll: {
    width: "100%",
    minHeight: "100%",
    overflowX: "auto",
    overflowY: "visible",
    ...theme.scrollbarStyles,
    "& .react-trello-board": {
      backgroundColor: "transparent !important",
      minHeight: "100%",
      paddingBottom: theme.spacing(1),
    },
    "& section": {
      background:
        theme.mode === "light"
          ? "linear-gradient(180deg, #f8fbff 0%, #f3f7ff 100%)"
          : "linear-gradient(180deg, #0f172a 0%, #111827 100%)",
      borderRadius: 14,
      border: `1px solid ${theme.palette.divider}`,
      boxShadow:
        theme.mode === "light"
          ? "0 10px 24px rgba(15, 23, 42, 0.08)"
          : "0 10px 24px rgba(2, 6, 23, 0.45)",
      paddingBottom: theme.spacing(1),
    },
    "& [data-id='lane-title'], & .react-trello-lane-header": {
      fontWeight: 700,
      letterSpacing: 0.2,
    },
    "& .react-trello-lane": {
      marginRight: theme.spacing(1.5),
    },
  },
  // ─── Card interno ────────────────────────────────────────────────────────
  // Substitui o MovableCardWrapper do react-trello (que some ao usar Card custom)
  cardRoot: {
    position: "relative",
    borderRadius: 12,
    minWidth: 230,
    maxWidth: 260,
    marginBottom: 7,
    cursor: "pointer",
    transition: "transform 0.16s ease, box-shadow 0.16s ease",
    backdropFilter: "blur(2px)",
    "&:hover": {
      transform: "translateY(-2px)",
    },
  },
  cardInner: {
    padding: "10px 12px 8px",
    userSelect: "none",
    minWidth: 0,
  },
  cardTopRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(0.75),
    marginBottom: theme.spacing(0.75),
  },
  cardName: {
    fontWeight: 700,
    fontSize: "0.86rem",
    lineHeight: 1.25,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "inherit",
  },
  cardTicketNum: {
    fontSize: "0.68rem",
    opacity: 0.48,
    whiteSpace: "nowrap",
    flexShrink: 0,
    color: "inherit",
    marginTop: 1,
    fontWeight: 500,
  },
  cardMidRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.75),
    marginBottom: theme.spacing(0.5),
  },
  cardIconBtn: {
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
    borderRadius: 4,
    transition: "opacity 0.15s",
    "&:hover": {
      opacity: 0.7,
    },
  },
  cardConnectionImg: {
    width: 15,
    height: 15,
    display: "block",
  },
  cardNumber: {
    fontSize: "0.73rem",
    opacity: 0.62,
    color: "inherit",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  cardLastMsg: {
    fontSize: "0.71rem",
    opacity: 0.55,
    color: "inherit",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginBottom: theme.spacing(0.75),
  },
  cardDivider: {
    borderTop: "1px solid rgba(0,0,0,0.07)",
    margin: `${theme.spacing(0.5)}px 0 ${theme.spacing(0.75)}px`,
  },
  cardValueRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 20,
  },
  cardValue: {
    fontSize: "0.78rem",
    fontWeight: 600,
    color: "#047857",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cardEditBtn: {
    background: "#047857",
    color: "#fff",
    border: "none",
    borderRadius: "999px",
    fontSize: "10px",
    fontWeight: 700,
    padding: "2px 8px",
    cursor: "pointer",
    lineHeight: 1.6,
    flexShrink: 0,
    transition: "background 0.15s",
    "&:hover": {
      background: "#065f46",
    },
  },
}));

const Kanban = () => {
  const classes = useStyles();
  const theme = useTheme();
  const history = useHistory();
  const { user, socket } = useContext(AuthContext);
  const [tags, setTags] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [file, setFile] = useState({ lanes: [] });
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState(null);
  const [valueModalOpen, setValueModalOpen] = useState(false);
  const [selectedTicketForValue, setSelectedTicketForValue] = useState(null);
  const [kanbanValueInput, setKanbanValueInput] = useState("");
  const [savingKanbanValue, setSavingKanbanValue] = useState(false);
  const isMovingCard = useRef(false);

  const queueIds = user.queues.map((queue) => queue.UserQueue.queueId);

  useEffect(() => {
    fetchTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchTags = async () => {
    try {
      const response = await api.get("/tag/kanban/");
      const fetchedTags = response.data.lista || [];
      setTags(fetchedTags);
      fetchTickets();
    } catch (error) {
      console.log(error);
    }
  };

  const fetchTickets = async () => {
    try {
      const { data } = await api.get("/ticket/kanban", {
        params: {
          queueIds: JSON.stringify(queueIds),
          startDate,
          endDate,
        },
      });
      setTickets(data.tickets);
    } catch (err) {
      console.log(err);
      setTickets([]);
    }
  };

  const debouncedFetchTickets = useDebouncedCallback(fetchTickets, 1000);

  useEffect(() => {
    const companyId = user.companyId;
    const onAppMessage = (data) => {
      if (isMovingCard.current) return;
      if (data.action === "create" || data.action === "update" || data.action === "delete") {
        debouncedFetchTickets();
      }
    };
    socket.on(`company-${companyId}-ticket`, onAppMessage);
    socket.on(`company-${companyId}-appMessage`, onAppMessage);

    return () => {
      socket.off(`company-${companyId}-ticket`, onAppMessage);
      socket.off(`company-${companyId}-appMessage`, onAppMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, startDate, endDate]);

  const handleSearchClick = () => {
    fetchTickets();
  };

  const resolveConnectionIcon = (ticket) => {
    const channel = String(ticket?.whatsapp?.channel || ticket?.channel || "").toLowerCase();
    const provider = String(ticket?.whatsapp?.provider || "").toLowerCase();

    if (
      channel.includes("oficial") ||
      channel.includes("official") ||
      provider.includes("oficial") ||
      provider.includes("official") ||
      provider.includes("waba")
    ) {
      return "/connection-icons/whatsapp-oficial.png";
    }

    if (channel.includes("wuzapi") || provider.includes("wuzapi")) {
      return "/connection-icons/whatsapp-wuzapi.png";
    }

    return "/connection-icons/whatsapp-baileys.png";
  };

  const handleOpenValueModal = (ticketId) => {
    const selectedTicket = tickets.find((ticket) => String(ticket.id) === String(ticketId));
    if (!selectedTicket) return;

    setSelectedTicketForValue(selectedTicket);
    setKanbanValueInput(
      selectedTicket.kanbanValue === null || selectedTicket.kanbanValue === undefined
        ? ""
        : Number(selectedTicket.kanbanValue)
    );
    setValueModalOpen(true);
  };

  const handleCloseValueModal = () => {
    if (savingKanbanValue) return;
    setValueModalOpen(false);
    setSelectedTicketForValue(null);
    setKanbanValueInput("");
  };

  const handleSaveKanbanValue = async () => {
    if (!selectedTicketForValue?.id) return;

    setSavingKanbanValue(true);
    try {
      await api.put(`/tickets/${selectedTicketForValue.id}`, {
        kanbanValue: kanbanValueInput === "" ? null : Number(kanbanValueInput)
      });
      toast.success("Valor salvo com sucesso.");
      await fetchTickets();
      setValueModalOpen(false);
      setSelectedTicketForValue(null);
      setKanbanValueInput("");
    } catch (error) {
      console.log(error);
      toast.error("Não foi possível salvar o valor do ticket.");
    } finally {
      setSavingKanbanValue(false);
    }
  };

  const popularCards = () => {
    const filteredTickets = tickets.filter((ticket) => ticket.tags.length === 0);

    const laneBaseStyle = {
      borderRadius: 14,
      border: `1px solid ${theme.palette.divider}`,
      background:
        theme.mode === "light"
          ? "linear-gradient(180deg, #f8fbff 0%, #f3f7ff 100%)"
          : "linear-gradient(180deg, #0f172a 0%, #111827 100%)",
      color: theme.palette.text.primary,
    };

    const cardBaseStyle = {
      borderRadius: 12,
      border: `1px solid ${theme.palette.divider}`,
      backgroundColor:
        theme.mode === "light" ? "rgba(255,255,255,0.96)" : "#ffffff",
      color: theme.mode === "light" ? theme.palette.text.primary : "#0f172a",
      boxShadow:
        theme.mode === "light"
          ? "0 10px 20px rgba(15, 23, 42, 0.08)"
          : "0 10px 20px rgba(2, 6, 23, 0.45)",
    };

    const tagLaneStyle = (tagColor) => ({
      ...laneBaseStyle,
      background: tagColor,
      backgroundColor: tagColor,
      color: "#ffffff",
      borderTop: "none",
      border: "1px solid rgba(255,255,255,0.22)",
      boxShadow:
        theme.mode === "light"
          ? "0 10px 24px rgba(15, 23, 42, 0.08)"
          : "0 10px 24px rgba(2, 6, 23, 0.45)",
    });

    const laneValueSum = (ticketList) =>
      ticketList.reduce((acc, t) => acc + (Number(t.kanbanValue) || 0), 0);

    const makeCardData = (ticket) => ({
      id: ticket.id.toString(),
      label: `#${ticket.id}`,
      title: String(ticket.contact?.name || ""),
      description: "",
      draggable: true,
      href: `/tickets/${ticket.uuid}`,
      style: cardBaseStyle,
      // Campos extras para o CustomCard
      uuid: ticket.uuid,
      connectionIcon: resolveConnectionIcon(ticket),
      kanbanValue: ticket.kanbanValue,
      contactNumber: ticket.contact?.number || "",
      lastMessage: ticket.lastMessage || "",
    });

    const lanes = [
      {
        id: "lane0",
        title: i18n.t("tagsKanban.laneDefault"),
        label: filteredTickets.length.toString(),
        totalValue: laneValueSum(filteredTickets),
        style: laneBaseStyle,
        cards: filteredTickets.map(makeCardData),
      },
      ...tags.map((tag) => {
        const taggedTickets = tickets.filter((ticket) => {
          const tagIds = ticket.tags.map((item) => item.id);
          return tagIds.includes(tag.id);
        });

        return {
          id: tag.id.toString(),
          title: tag.name,
          label: taggedTickets.length.toString(),
          totalValue: laneValueSum(taggedTickets),
          cards: taggedTickets.map(makeCardData),
          style: tagLaneStyle(tag.color),
        };
      }),
    ];

    setFile({ lanes });
  };

  useEffect(() => {
    popularCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags, tickets, theme.mode]);

  const handleCardMove = async (_fromLaneId, toLaneId, cardId) => {
    isMovingCard.current = true;

    // Atualiza o estado local imediatamente para evitar stutter visual
    setTickets(prev =>
      prev.map(ticket => {
        if (String(ticket.id) !== String(cardId)) return ticket;
        const newTags = toLaneId === "lane0" ? [] : [{ id: Number(toLaneId) }];
        return { ...ticket, tags: newTags };
      })
    );

    try {
      await api.delete(`/ticket-tags/${cardId}`);
      if (toLaneId !== "lane0") {
        await api.put(`/ticket-tags/${cardId}/${toLaneId}`);
      }
      toast.success("Ticket movido com sucesso!");
      debouncedFetchTickets();
    } catch (err) {
      console.log(err);
      toast.error("Erro ao mover o ticket. Tente novamente.");
      await fetchTickets();
    } finally {
      isMovingCard.current = false;
    }
  };

  const handleAddConnectionClick = () => {
    history.push("/tagsKanban");
  };

  const handleOpenTagEdit = (tagId) => {
    setSelectedTagId(tagId);
    setTagModalOpen(true);
  };

  const handleCloseTagModal = () => {
    setTagModalOpen(false);
    setSelectedTagId(null);
    fetchTags();
  };

  const LaneHeader = ({ id, title, label, totalValue }) => {
    const isDefaultLane = id === "lane0";
    return (
      <div className={classes.laneHeaderContent}>
        {!isDefaultLane && (
          <Tooltip title="Editar lane" placement="top">
            <IconButton
              size="small"
              className={classes.laneHeaderEditButton}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleOpenTagEdit(Number(id));
              }}
            >
              <EditIcon style={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
        <span className={classes.laneHeaderTitle}>{title}</span>
        <div className={classes.laneHeaderRight}>
          <span className={classes.laneHeaderLabel}>{label}</span>
          {totalValue > 0 && (
            <span className={classes.laneHeaderValueSum}>
              {formatToCurrency(totalValue)}
            </span>
          )}
        </div>
      </div>
    );
  };

  const CustomCard = ({
    id,
    title,
    label,
    uuid,
    connectionIcon,
    kanbanValue,
    contactNumber,
    lastMessage,
    style,
  }) => (
    <div className={classes.cardRoot} style={style}>
      <div className={classes.cardInner}>
        {/* Linha 1: nome do contato + número do ticket */}
        <div className={classes.cardTopRow}>
          <span className={classes.cardName}>{title || "—"}</span>
          <span className={classes.cardTicketNum}>{label}</span>
        </div>

        {/* Linha 2: ícone de conexão (clicável) + número do contato */}
        <div className={classes.cardMidRow}>
          <button
            type="button"
            title="Abrir atendimento"
            className={classes.cardIconBtn}
            onClick={(e) => {
              e.stopPropagation();
              history.push(`/tickets/${uuid}`);
            }}
          >
            <img
              src={connectionIcon}
              alt=""
              className={classes.cardConnectionImg}
            />
          </button>
          <span className={classes.cardNumber}>{contactNumber || "—"}</span>
        </div>

        {/* Linha 3: última mensagem */}
        {lastMessage ? (
          <div className={classes.cardLastMsg}>{lastMessage}</div>
        ) : (
          <div style={{ marginBottom: 6 }} />
        )}

        {/* Separador */}
        <div className={classes.cardDivider} />

        {/* Linha 4: valor + botão de edição */}
        <div className={classes.cardValueRow}>
          <span className={classes.cardValue}>
            {kanbanValue !== null && kanbanValue !== undefined
              ? formatToCurrency(Number(kanbanValue))
              : ""}
          </span>
          <button
            type="button"
            title={i18n.t("kanban.editValue")}
            className={classes.cardEditBtn}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenValueModal(id);
            }}
          >
            R$
          </button>
        </div>
      </div>
    </div>
  );

  const ticketsWithoutLane = tickets.filter((ticket) => ticket.tags.length === 0).length;

  return (
    <div className={classes.pageRoot}>
      {tagModalOpen && (
        <TagModal
          open={tagModalOpen}
          onClose={handleCloseTagModal}
          aria-labelledby="form-dialog-title"
          tagId={selectedTagId}
          kanban={1}
        />
      )}

      <Dialog
        open={valueModalOpen}
        onClose={handleCloseValueModal}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{i18n.t("kanban.editValue")}</DialogTitle>
        <DialogContent>
          <Box mt={1}>
            <NumberFormat
              value={kanbanValueInput}
              customInput={TextField}
              label={i18n.t("kanban.value")}
              variant="outlined"
              fullWidth
              thousandSeparator="."
              decimalSeparator=","
              prefix="R$ "
              decimalScale={2}
              fixedDecimalScale
              allowNegative={false}
              placeholder={i18n.t("kanban.valuePlaceholder")}
              onValueChange={({ floatValue, value }) => {
                setKanbanValueInput(value === "" ? "" : floatValue ?? "");
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseValueModal} disabled={savingKanbanValue}>
            Cancelar
          </Button>
          <Button
            onClick={() => setKanbanValueInput("")}
            disabled={savingKanbanValue}
          >
            {i18n.t("kanban.clearValue")}
          </Button>
          <Button
            onClick={handleSaveKanbanValue}
            color="primary"
            variant="contained"
            disabled={savingKanbanValue}
          >
            {i18n.t("kanban.saveValue")}
          </Button>
        </DialogActions>
      </Dialog>

      <MainHeader>
        <Grid container style={{ width: "100%" }}>
          <Grid item xs={12}>
            <Paper elevation={0} className={classes.filterCard}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Data de início"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    variant="outlined"
                    className={classes.dateInput}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Data de fim"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    variant="outlined"
                    className={classes.dateInput}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={2}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    onClick={handleSearchClick}
                    className={classes.actionButton}
                    startIcon={<SearchIcon />}
                  >
                    Buscar
                  </Button>
                </Grid>

                <Grid item xs={12} sm={6} md={4} style={{ textAlign: "right" }}>
                  <Can
                    role={user.profile}
                    perform="dashboard:view"
                    yes={() => (
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleAddConnectionClick}
                        className={classes.actionButton}
                        size="small"
                      >
                        + Adicionar colunas
                      </Button>
                    )}
                  />
                </Grid>
              </Grid>

              <Box mt={1.5}>
                <Typography color="textSecondary" className={classes.helperText}>
                  {`Lanes ativas: ${tags.length + 1} | Sem lane: ${ticketsWithoutLane}`}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </MainHeader>

      <Paper elevation={0} className={classes.boardShell}>
        <div className={classes.boardScroll}>
          <Board
            data={file}
            onCardMoveAcrossLanes={handleCardMove}
            components={{ LaneHeader, Card: CustomCard }}
            style={{ backgroundColor: "transparent" }}
          />
        </div>
      </Paper>
    </div>
  );
};

export default Kanban;
