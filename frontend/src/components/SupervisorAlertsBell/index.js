import React, { useState, useEffect, useContext, useRef } from "react";
import { useHistory } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import ptBR from "date-fns/locale/pt-BR";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Popover from "@material-ui/core/Popover";
import IconButton from "@material-ui/core/IconButton";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import Badge from "@material-ui/core/Badge";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";
import TrackChangesIcon from "@material-ui/icons/TrackChanges";
import DeleteSweepIcon from "@material-ui/icons/DeleteSweep";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import ScheduleIcon from "@material-ui/icons/Schedule";
import ErrorOutlineIcon from "@material-ui/icons/ErrorOutline";
import RecordVoiceOverIcon from "@material-ui/icons/RecordVoiceOver";

import { AuthContext } from "../../context/Auth/AuthContext";
import useSupervisorPanel from "../../hooks/useSupervisorPanel";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  popoverPaper: {
    width: "100%",
    maxWidth: 360,
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
    borderRadius: 12,
    overflow: "hidden",
  },
  tabContainer: {
    overflowY: "auto",
    maxHeight: 380,
    ...theme.scrollbarStyles,
  },
  popoverHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  popoverHeaderTitle: {
    fontWeight: 700,
    fontSize: 13,
  },
  emptyItem: {
    padding: "20px 16px",
    color: theme.palette.text.secondary,
    fontSize: 13,
    textAlign: "center",
  },
}));

const TYPE_META = {
  sla_overdue: { icon: <ErrorOutlineIcon fontSize="small" style={{ color: "#ef4444" }} /> },
  sla_risk: { icon: <ScheduleIcon fontSize="small" style={{ color: "#f59e0b" }} /> },
  supervisor_message: { icon: <RecordVoiceOverIcon fontSize="small" style={{ color: "#3b82f6" }} /> },
};

// Painel Vigia (ver docs/MANUAL_TECNICO.md): sino separado do sino "normal"
// de tickets, pros alertas de SLA (risco/fora do prazo) e mensagens ao vivo
// de um supervisor. Fica visível pra qualquer usuário autenticado — cada um
// só vê o que é seu, a menos que tenha acesso ao Painel Vigia (aí vê tudo).
const SupervisorAlertsBell = () => {
  const classes = useStyles();
  const history = useHistory();
  const { user, socket } = useContext(AuthContext);
  const supervisorPanel = useSupervisorPanel();

  const anchorEl = useRef();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState([]);

  const canManage = user.profile === "admin" || !!user.super;

  const fetchItems = async () => {
    try {
      const data = await supervisorPanel.getNotifications();
      setItems(data);
    } catch (err) {
      // Silencioso: o Painel Vigia pode não estar contratado pra essa
      // empresa — nesse caso o endpoint só devolve lista vazia mesmo assim
      // (não requer o add-on pra listar as próprias mensagens).
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!socket || !user?.companyId) return;
    const companyId = user.companyId;

    const onNotification = (payload) => {
      setItems((prev) => [payload, ...prev.filter((i) => i.id !== payload.id)]);
    };

    const onSupervisorMessage = (payload) => {
      setItems((prev) => [payload, ...prev.filter((i) => i.id !== payload.id)]);
      toast.info(`${payload.title}: ${payload.message}`, { autoClose: 8000 });
    };

    // Assim que um atendimento é fechado, o alerta dele deixa de fazer
    // sentido aqui (mesma regra do backend, ver NotificationService.list
    // e docs/MANUAL_TECNICO.md seção 31) — mas como esse sino só busca a
    // lista uma vez ao montar e depois só empilha o que chega ao vivo, um
    // alerta recebido antes do fechamento ficava preso na tela pra sempre.
    // Remove na hora, sem esperar reabrir o sino ou recarregar a página.
    const onTicketUpdate = (payload) => {
      if (payload?.ticket?.status !== "closed") return;
      const closedTicketId = payload.ticket.id;
      setItems((prev) => prev.filter((i) => i.ticket?.id !== closedTicketId));
    };

    socket.on(`company-${companyId}-notification`, onNotification);
    socket.on(`company-${companyId}-supervisorMessage`, onSupervisorMessage);
    socket.on(`company-${companyId}-ticket`, onTicketUpdate);

    return () => {
      socket.off(`company-${companyId}-notification`, onNotification);
      socket.off(`company-${companyId}-supervisorMessage`, onSupervisorMessage);
      socket.off(`company-${companyId}-ticket`, onTicketUpdate);
    };
  }, [socket, user]);

  const handleClick = () => {
    setIsOpen((prev) => {
      // Reconsulta o backend (que já filtra atendimentos fechados) toda
      // vez que o sino é aberto, além da remoção ao vivo acima — cobre o
      // caso de um alerta de atendimento fechado em outra aba/dispositivo
      // antes desse socket chegar.
      if (!prev) fetchItems();
      return !prev;
    });
  };
  const handleClickAway = () => setIsOpen(false);

  const handleOpenTicket = (item) => {
    if (item.ticket?.uuid) {
      history.push(`/tickets/${item.ticket.uuid}`);
      setIsOpen(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await supervisorPanel.deleteNotification(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      toastError(err);
    }
  };

  const handleClearAll = async () => {
    try {
      await supervisorPanel.clearNotifications();
      setItems([]);
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <>
      <Tooltip title="Alertas do Painel Vigia">
        <IconButton
          onClick={handleClick}
          ref={anchorEl}
          aria-label="Alertas do Painel Vigia"
          color="inherit"
          style={{ color: "white" }}
        >
          <Badge overlap="rectangular" badgeContent={items.length} color="secondary">
            <TrackChangesIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        disableScrollLock
        open={isOpen}
        anchorEl={anchorEl.current}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        classes={{ paper: classes.popoverPaper }}
        onClose={handleClickAway}
      >
        <div className={classes.popoverHeader}>
          <Typography className={classes.popoverHeaderTitle}>Alertas do Painel Vigia</Typography>
          {canManage && items.length > 0 && (
            <Tooltip title="Apagar todas">
              <IconButton size="small" onClick={handleClearAll}>
                <DeleteSweepIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </div>
        <List dense className={classes.tabContainer}>
          {items.length === 0 ? (
            <ListItem className={classes.emptyItem}>
              <ListItemText>Nenhum alerta no momento.</ListItemText>
            </ListItem>
          ) : (
            items.map((item) => (
              <ListItem key={item.id} button onClick={() => handleOpenTicket(item)}>
                <span style={{ marginRight: 10 }}>{TYPE_META[item.type]?.icon}</span>
                <ListItemText
                  primary={item.title}
                  secondary={
                    <>
                      {item.message}
                      <br />
                      <Typography variant="caption" color="textSecondary">
                        {item.createdAt &&
                          formatDistanceToNow(new Date(item.createdAt), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                      </Typography>
                    </>
                  }
                />
                {canManage && (
                  <ListItemSecondaryAction>
                    <IconButton size="small" onClick={(e) => handleDelete(item.id, e)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                )}
              </ListItem>
            ))
          )}
        </List>
      </Popover>
    </>
  );
};

export default SupervisorAlertsBell;
