import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import { useParams, useHistory } from "react-router-dom";

import clsx from "clsx";

import { IconButton, InputBase, Paper, makeStyles } from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import CloseIcon from "@material-ui/icons/Close";

import ContactDrawer from "../ContactDrawer";
import MessageInput from "../MessageInput";
import TicketHeader from "../TicketHeader";
import TicketInfo from "../TicketInfo";
import TicketActionButtons from "../TicketActionButtonsCustom";
import MessagesList from "../MessagesList";
import api from "../../services/api";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { ForwardMessageProvider } from "../../context/ForwarMessage/ForwardMessageContext";

import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TagsContainer } from "../TagsContainer";
import { isNil } from 'lodash';
import { EditMessageProvider } from "../../context/EditingMessage/EditingMessageContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";

const drawerWidth = 320;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100%",
    minHeight: 0,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "transparent",
    padding: "8px",
    [theme.breakpoints.down("sm")]: {
      padding: 0,
      overscrollBehavior: "contain",
    },
  },

  mainWrapper: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeft: "0",
    borderRadius: 14,
    border: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.2)" : "rgba(148,163,184,0.15)"}`,
    backgroundColor:
      theme.mode === "light" ? "#ffffff" : "rgba(15,23,42,0.95)",
    marginRight: -drawerWidth,
    boxShadow:
      theme.mode === "light"
        ? "0 4px 12px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.04)"
        : "0 4px 12px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)",
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },

  mainWrapperShift: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginRight: 0,
  },
  tagsPaper: {
    borderRadius: 0,
    borderTop: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.2)" : "rgba(148,163,184,0.15)"}`,
    borderBottom: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.2)" : "rgba(148,163,184,0.15)"}`,
    backgroundColor:
      theme.mode === "light" ? "#f8fafc" : "rgba(30,41,59,0.8)",
    padding: "4px 12px",
    [theme.breakpoints.down("sm")]: {
      padding: "1px 6px",
    },
  },
  searchBarWrapper: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 2),
    borderBottom: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.2)" : "rgba(148,163,184,0.15)"}`,
    backgroundColor:
      theme.mode === "light" ? "#ffffff" : "rgba(30,41,59,0.8)",
  },
  searchIcon: {
    color: theme.palette.text.secondary,
    fontSize: 20,
  },
  searchInput: {
    flex: 1,
    fontSize: "0.86rem",
  },
}));

const Ticket = () => {
  const { ticketId } = useParams();
  const history = useHistory();
  const classes = useStyles();

  const { user, socket } = useContext(AuthContext);
  const { setTabOpen } = useContext(TicketsContext);


  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({});
  const [ticket, setTicket] = useState({});
  const [dragDropFiles, setDragDropFiles] = useState([]);
  const [messageSearch, setMessageSearch] = useState("");
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [contactPresence, setContactPresence] = useState(null); // null | "typing" | "online"
  const presenceTimerRef = useRef(null);
  const { companyId } = user;

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchTicket = async () => {
        try {

          if (!isNil(ticketId) && ticketId !== "undefined") {

            const { data } = await api.get("/tickets/u/" + ticketId);

            setContact(data.contact);
            // setWhatsapp(data.whatsapp);
            // setQueueId(data.queueId);
            setTicket(data);
            if (["pending", "open", "group"].includes(data.status)) {
              setTabOpen(data.status);
            }
            setLoading(false);
          }
        } catch (err) {
          history.push("/tickets");   // correção para evitar tela branca uuid não encontrado Feito por Altemir 16/08/2023
          setLoading(false);
          toastError(err);
        }
      };
      fetchTicket();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [ticketId, user, history]);

  useEffect(() => {
    if (!socket || !user.companyId || !ticket?.id || !ticketId || ticketId === "undefined") {
      return;
    }

    const currentTicketId = String(ticket.id);

    const onConnectTicket = () => {
      socket.emit("joinChatBox", currentTicketId);
    };

    const onCompanyTicket = (data) => {
      if (data.action === "update" && String(data?.ticket?.id) === currentTicketId) {
        setTicket(data.ticket);
      }

      if (data.action === "delete" && String(data?.ticketId) === currentTicketId) {
        history.push("/tickets");
      }
    };

    const onCompanyContactTicket = (data) => {
      if (data.action === "update") {
        setContact((prevState) => {
          if (prevState.id === data.contact?.id) {
            return { ...prevState, ...data.contact };
          }
          return prevState;
        });
      }
    };

    const onContactPresence = (data) => {
      if (String(data?.ticketId) !== currentTicketId) return;
      if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
      if (data.isTyping) {
        setContactPresence("typing");
        presenceTimerRef.current = setTimeout(() => setContactPresence(null), 6500);
      } else if (data.isOnline === true) {
        setContactPresence("online");
        presenceTimerRef.current = setTimeout(() => setContactPresence(null), 30000);
      } else {
        setContactPresence(null);
      }
    };

    socket.on("connect", onConnectTicket);
    socket.on(`company-${companyId}-ticket`, onCompanyTicket);
    socket.on(`company-${companyId}-contact`, onCompanyContactTicket);
    socket.on(`company-${companyId}-typing`, onContactPresence);
    onConnectTicket();

    return () => {
      socket.emit("joinChatBoxLeave", currentTicketId);
      if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
      socket.off("connect", onConnectTicket);
      socket.off(`company-${companyId}-ticket`, onCompanyTicket);
      socket.off(`company-${companyId}-contact`, onCompanyContactTicket);
      socket.off(`company-${companyId}-typing`, onContactPresence);
    };
  }, [socket, user.companyId, companyId, ticket?.id, ticketId, history]);

  // Previne o espaço branco entre o teclado virtual e o input no iOS/PWA.
  //
  // Problema: quando o usuário toca no input, o iOS Safari rola o document
  // (window.scrollY) para tentar mostrar o input — mesmo quando o layout root
  // é position:fixed. Isso expõe o fundo branco da página abaixo do elemento
  // fixo, criando o gap visual. O fix anterior (--app-height = viewport.height)
  // corrige o tamanho do layout, mas há uma janela de timing onde o scroll já
  // aconteceu antes do evento visualViewport.resize disparar.
  //
  // Solução: travar overflow do body + capturar e cancelar imediatamente qualquer
  // scroll de documento via window.scroll e visualViewport.scroll.
  useEffect(() => {
    if (!window.matchMedia("(max-width: 959.95px)").matches) return;

    const contentEl = document.querySelector("main");
    if (!contentEl) return;

    // Trava o scroll do body para que o iOS não consiga rolar o documento
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const prevOverflow = contentEl.style.overflowY;
    contentEl.style.overflowY = "hidden";

    // Cancela qualquer scroll de documento que o iOS possa ter iniciado
    const resetScroll = () => {
      if (contentEl.scrollTop !== 0) contentEl.scrollTop = 0;
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };

    const vv = window.visualViewport;
    vv?.addEventListener("resize", resetScroll);
    vv?.addEventListener("scroll", resetScroll);
    // Captura o scroll do window imediatamente (antes do visualViewport.resize)
    window.addEventListener("scroll", resetScroll, { passive: true });

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      contentEl.style.overflowY = prevOverflow;
      vv?.removeEventListener("resize", resetScroll);
      vv?.removeEventListener("scroll", resetScroll);
      window.removeEventListener("scroll", resetScroll);
    };
  }, []);

  const handleDrawerOpen = useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const handleToggleMessageSearch = useCallback(() => {
    setShowMessageSearch((prev) => {
      if (prev) {
        setMessageSearch("");
      }
      return !prev;
    });
  }, []);

  const renderMessagesList = () => {
    return (
      <>
        <MessagesList
          isGroup={ticket.isGroup}
          onDrop={setDragDropFiles}
          whatsappId={ticket.whatsappId}
          queueId={ticket.queueId}
          channel={ticket.channel}
          ticketDbId={ticket.id}
          ticketUuid={ticket.uuid}
          searchParam={messageSearch}
        >
        </MessagesList>
        <MessageInput
          ticketId={ticket.id}
          ticketStatus={ticket.status}
          ticketChannel={ticket.channel}
          ticketIsGroup={ticket.isGroup}
          droppedFiles={dragDropFiles}
          contactId={contact.id}
          disableAutoFocus={showMessageSearch}
        />
      </>
    );
  };


  return (
    <div className={classes.root} id="drawer-container">
      <Paper
        elevation={0}
        className={clsx(classes.mainWrapper, {
          [classes.mainWrapperShift]: drawerOpen,
        })}
      >
        {/* <div id="TicketHeader"> */}
        <TicketHeader loading={loading}>
          {ticket.contact !== undefined && (
            <div id="TicketHeader">
              <TicketInfo
                contact={contact}
                ticket={ticket}
                onClick={handleDrawerOpen}
                contactPresence={contactPresence}
              />
            </div>
          )}
          <TicketActionButtons
            ticket={ticket}
            onToggleSearch={handleToggleMessageSearch}
            isSearching={showMessageSearch}
          />
        </TicketHeader>
        {showMessageSearch && (
          <div className={classes.searchBarWrapper}>
            <SearchIcon className={classes.searchIcon} />
            <InputBase
              autoFocus
              className={classes.searchInput}
              placeholder="Buscar mensagens nesta conversa..."
              value={messageSearch}
              onChange={(e) => setMessageSearch(e.target.value)}
            />
            <IconButton size="small" onClick={handleToggleMessageSearch}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </div>
        )}
        {/* </div> */}
        <Paper className={classes.tagsPaper}>
          <TagsContainer contact={contact} />
        </Paper>
        <ReplyMessageProvider>
          <ForwardMessageProvider>
            <EditMessageProvider>
              {renderMessagesList()}
            </EditMessageProvider>
          </ForwardMessageProvider>
        </ReplyMessageProvider>
      </Paper>

      <ContactDrawer
        open={drawerOpen}
        handleDrawerClose={handleDrawerClose}
        contact={contact}
        loading={loading}
        ticket={ticket}
      />

    </div>
  );
};

export default Ticket;
