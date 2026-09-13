import React, { useState, useEffect, useRef, useContext, useCallback } from "react";

import { useHistory, useParams } from "react-router-dom";
import { parseISO, format, isSameDay } from "date-fns";
import clsx from "clsx";

import { makeStyles } from "@material-ui/core/styles";
import { grey } from "@material-ui/core/colors";
import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import MarkdownWrapper from "../MarkdownWrapper";
import { Tooltip } from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import toastError from "../../errors/toastError";
import { v4 as uuidv4 } from "uuid";

import GroupIcon from '@material-ui/icons/Group';
import ConnectionIcon from "../ConnectionIcon";
import AcceptTicketWithouSelectQueue from "../AcceptTicketWithoutQueueModal";
import TransferTicketModalCustom from "../TransferTicketModalCustom";
import ShowTicketOpen from "../ShowTicketOpenModal";
import CloseTicketFarewellDialog from "../CloseTicketFarewellDialog";
import { isNil } from "lodash";
import { toast } from "react-toastify";
import {
    DeleteForever,
    Done,
    HighlightOff,
    Replay,
    SwapHoriz
} from "@material-ui/icons";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import getConnectionColor from "../../utils/connectionColor";
import {
    Avatar,
    ListItemAvatar,
    ListItem,
    ListItemSecondaryAction,
    ListItemText,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    Paper
} from "@material-ui/core";
import VisibilityIcon from "@material-ui/icons/Visibility";
import CloseIcon from "@material-ui/icons/Close";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import MessageIcon from "@material-ui/icons/Message";
import LocalOfferOutlinedIcon from "@material-ui/icons/LocalOfferOutlined";
import ViewKanban from "@mui/icons-material/ViewKanban";

const useStyles = makeStyles((theme) => ({
    ticket: {
        position: "relative",
        width: "100%",
        boxSizing: "border-box",
        borderRadius: 10,
        margin: "4px 0",
        overflow: "visible",
        padding: "8px 12px 8px 9px",
        border: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.22)"}`,
        background:
            theme.mode === "light"
                ? "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)"
                : "linear-gradient(135deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.98) 100%)",
        boxShadow:
            theme.mode === "light"
                ? "0 2px 8px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.04)"
                : "0 2px 8px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.2)",
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:before": {
            content: '""',
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            borderRadius: "12px 0 0 12px",
            backgroundColor: theme.mode === "light" ? "#cbd5e1" : "rgba(148,163,184,0.5)",
            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            opacity: 0.85,
        },
        "&:hover": {
            transform: "translateY(-2px)",
            boxShadow:
                theme.mode === "light"
                    ? "0 8px 20px rgba(15,23,42,0.1), 0 4px 8px rgba(15,23,42,0.06)"
                    : "0 8px 20px rgba(0,0,0,0.35), 0 4px 8px rgba(0,0,0,0.25)",
            borderColor: theme.mode === "light" ? "rgba(148,163,184,0.35)" : "rgba(148,163,184,0.4)",
        },
        "&.Mui-selected": {
            borderColor: theme.mode === "light" ? "rgba(37,99,235,0.4)" : "rgba(96,165,250,0.45)",
            background:
                theme.mode === "light"
                    ? "linear-gradient(135deg, rgba(219,234,254,0.5) 0%, #ffffff 100%)"
                    : "linear-gradient(135deg, rgba(30,58,138,0.25) 0%, rgba(30,41,59,0.98) 100%)",
            boxShadow:
                theme.mode === "light"
                    ? "0 4px 12px rgba(37,99,235,0.15), 0 2px 6px rgba(15,23,42,0.08)"
                    : "0 4px 12px rgba(96,165,250,0.15), 0 2px 6px rgba(0,0,0,0.3)",
        },
        "&.Mui-selected:before": {
            width: 5,
            opacity: 1,
        },
    },

    unreadTicket: {
        "&:before": {
            background:
                theme.mode === "light"
                    ? "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)"
                    : "linear-gradient(180deg, #4ade80 0%, #22c55e 100%)",
            boxShadow:
                theme.mode === "light"
                    ? "0 0 0 1px rgba(34,197,94,0.2)"
                    : "0 0 0 1px rgba(74,222,128,0.3)",
        },
    },

    readTicket: {
        "&:before": {
            backgroundColor: theme.mode === "light" ? "#cbd5e1" : "rgba(148,163,184,0.55)",
        },
    },

    pendingTicket: {
        cursor: "unset",
    },

    avatarWrap: {
        marginLeft: 2,
        marginRight: 8,
    },

    ticketAvatar: {
        width: 42,
        height: 42,
        borderRadius: "50%",
        border: `2px solid ${theme.mode === "light" ? "rgba(148,163,184,0.25)" : "rgba(148,163,184,0.4)"}`,
        boxShadow: theme.mode === "light" ? "0 3px 8px rgba(15,23,42,0.1)" : "0 4px 10px rgba(0,0,0,0.3)",
    },

    contentRoot: {
        marginRight: 95,
        minWidth: 0,
        overflow: "hidden",
    },

    primaryRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 8,
    },

    nameLine: {
        display: "flex",
        alignItems: "center",
        minWidth: 0,
        gap: 6,
    },

    contactName: {
        color: theme.mode === "light" ? "#0f172a" : "#f8fafc",
        fontWeight: 700,
        fontSize: "0.83rem",
        letterSpacing: "0.01em",
    },

    rightTop: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginLeft: "auto",
    },

    unreadCounter: {
        minWidth: 18,
        height: 18,
        borderRadius: 10,
        padding: "0 5px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.62rem",
        fontWeight: "bold",
        color: "#fff",
        background: "#22c55e",
        boxShadow: "none",
    },

    viewIcon: {
        color: theme.mode === "light" ? "#2563eb" : "#93c5fd",
        cursor: "pointer",
        fontSize: "1rem",
    },

    lastMessageTime: {
        color: theme.mode === "light" ? "#64748b" : "#94a3b8",
        fontSize: "0.68rem",
        fontWeight: 600,
    },

    lastMessageTimeUnread: {
        color: theme.mode === "light" ? "#16a34a" : "#4ade80",
        fontSize: "0.68rem",
        fontWeight: "bold",
    },

    secondaryContent: {
        marginTop: 2,
    },

    messagePreview: {
        display: "block",
        maxWidth: "100%",
        minWidth: 0,
        color: theme.mode === "light" ? "#334155" : "#cbd5e1",
        fontSize: "0.74rem",
        lineHeight: 1.35,
        fontWeight: 500,
    },

    messagePreviewUnread: {
        color: theme.mode === "light" ? "#0f172a" : "#e2e8f0",
        fontWeight: 700,
    },
    messagePreviewTyping: {
        color: theme.mode === "light" ? "#16a34a" : "#4ade80",
        fontStyle: "italic",
        fontWeight: 700,
    },

    metaRow: {
        display: "flex",
        alignItems: "center",
        gap: 5,
        flexWrap: "wrap",
        marginTop: 6,
        paddingRight: 4,
    },

    metaPill: {
        color: "#fff",
        borderRadius: 4,
        padding: "1px 6px",
        fontSize: "0.52rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
        maxWidth: 110,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
        border: "1px solid rgba(255,255,255,0.1)",
        transition: "all 0.15s ease",
    },
    metaPillUser: {
        backgroundColor: theme.mode === "light" ? "#0f172a" : "#334155",
    },
    metaTagPill: {
        color: "#fff",
        borderRadius: 4,
        padding: "1px 6px",
        fontSize: "0.52rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        maxWidth: 120,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
        border: "1px solid rgba(255,255,255,0.1)",
        transition: "all 0.15s ease",
    },

    tagsRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        marginTop: 4,
    },

    actionsColumn: {
        right: 8,
        top: 8,
        transform: "none",
        marginTop: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        minWidth: 100,
        gap: 6,
    },

    actionButtonsRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 2,
        flexWrap: "nowrap",
        whiteSpace: "nowrap",
    },

    actionButton: {
        minWidth: 28,
        width: 28,
        height: 28,
        borderRadius: 8,
        boxShadow: "none",
        border: "none",
        padding: 0,
        transition: "filter 0.15s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "&:hover": {
            filter: "brightness(0.96)",
        },
    },
    actionIcon: {
        fontSize: "0.88rem",
    },
    actionButtonAccept: {
        background: theme.mode === "light" ? "#bbf7d0" : "rgba(34,197,94,0.3)",
        color: theme.mode === "light" ? "#15803d" : "#4ade80",
    },
    actionButtonTransfer: {
        background: theme.mode === "light" ? "#bfdbfe" : "rgba(59,130,246,0.3)",
        color: theme.mode === "light" ? "#1d4ed8" : "#60a5fa",
    },
    actionButtonDanger: {
        background: theme.mode === "light" ? "#fed7aa" : "rgba(249,115,22,0.3)",
        color: theme.mode === "light" ? "#c2410c" : "#fb923c",
    },
    actionButtonNeutral: {
        background: theme.mode === "light" ? "#e2e8f0" : "rgba(148,163,184,0.3)",
        color: theme.mode === "light" ? "#475569" : "#cbd5e1",
    },
    actionButtonDelete: {
        background: theme.mode === "light" ? "#fecaca" : "rgba(239,68,68,0.3)",
        color: theme.mode === "light" ? "#b91c1c" : "#f87171",
    },

    connectionIcon: {
        marginRight: 1,
    },

    aiBadge: {
        position: "absolute",
        right: 8,
        bottom: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: theme.mode === "light"
            ? "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
            : "linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)",
        color: "#fff",
        boxShadow: theme.mode === "light"
            ? "0 2px 6px rgba(37,99,235,0.35)"
            : "0 2px 6px rgba(0,0,0,0.4)",
        zIndex: 2,
    },
    dialogTitle: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.mode === "light" ? "rgba(15,23,42,0.08)" : "rgba(148,163,184,0.12)"}`,
        color: theme.mode === "light" ? "#0f172a" : "#f1f5f9",
        padding: theme.spacing(1.5, 2),
    },
    closeButton: {
        color: theme.mode === "light" ? "#64748b" : "#94a3b8",
        "&:hover": {
            background: theme.palette.chat.listHover,
        },
    },
    messagesContainer: {
        height: "60vh",
        maxHeight: "600px",
        overflowY: "auto",
        padding: theme.spacing(2),
        scrollBehavior: "smooth",
        backgroundColor: theme.palette.chat.background,
        ...theme.scrollbarStyles,
    },
    messageItem: {
        padding: theme.spacing(1, 1.25),
        margin: theme.spacing(1, 0),
        borderRadius: 12,
        maxWidth: "80%",
        position: "relative",
        boxShadow: theme.mode === "light"
            ? "0 1px 2px rgba(0,0,0,0.06)"
            : "0 1px 2px rgba(0,0,0,0.2)",
    },
    fromMe: {
        backgroundColor: theme.palette.chat.bubbleOutgoing,
        color: theme.palette.chat.bubbleOutgoingText,
        marginLeft: "auto",
    },
    fromThem: {
        backgroundColor: theme.palette.chat.bubbleIncoming,
        color: theme.palette.chat.bubbleIncomingText,
    },
    messageTime: {
        fontSize: "0.7rem",
        fontWeight: 600,
        color: theme.palette.chat.bubbleMeta,
        position: "absolute",
        bottom: "4px",
        right: "10px",
    },
    messageText: {
        marginBottom: theme.spacing(2),
        wordBreak: "break-word",
        color: "inherit",
        "& p, & span, & strong, & em, & a, & div": {
            color: "inherit !important",
        },
    },
    emptyMessages: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: "100%",
        color: theme.mode === "light" ? "#94a3b8" : "#64748b",
    },
    messagesHeader: {
        display: "flex",
        alignItems: "center",
        padding: theme.spacing(1.25, 2),
        backgroundColor: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.mode === "light" ? "rgba(15,23,42,0.08)" : "rgba(148,163,184,0.12)"}`,
    },
    messageAvatar: {
        marginRight: theme.spacing(1.25),
    },
    messageIcon: {
        color: theme.mode === "light" ? "#cbd5e1" : "#475569",
    },
    loadingMessages: {
        display: "flex",
        justifyContent: "center",
        padding: theme.spacing(3),
    }
}));

const handleAvatarError = (event) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = "/nopicture.png";
};

const TicketListItemCustom = ({ setTabOpen, ticket }) => {
    const classes = useStyles();
    const history = useHistory();
    const [loading, setLoading] = useState(false);
    const [acceptTicketWithouSelectQueueOpen, setAcceptTicketWithouSelectQueueOpen] = useState(false);
    const [transferTicketModalOpen, setTransferTicketModalOpen] = useState(false);

    const [openAlert, setOpenAlert] = useState(false);
    const [userTicketOpen, setUserTicketOpen] = useState("");
    const [queueTicketOpen, setQueueTicketOpen] = useState("");
    const [openTicketMessageDialog, setOpenTicketMessageDialog] = useState(false);
    const [closeFarewellDialogOpen, setCloseFarewellDialogOpen] = useState(false);
    
    // New states for the ticket messages
    const [ticketMessages, setTicketMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);

    const { ticketId } = useParams();
    const isMounted = useRef(true);
    const messagesContainerRef = useRef(null);
    const { setCurrentTicket } = useContext(TicketsContext);
    const { user } = useContext(AuthContext);

    const { get: getSetting } = useCompanySettings();
    const canDeleteTickets = user.profile === "admin" || user.canDeleteTickets === "enabled";

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    const handleOpenAcceptTicketWithouSelectQueue = useCallback(() => {
        setAcceptTicketWithouSelectQueueOpen(true);
    }, []);

    const handleCloseTicket = async (id) => {
        const setting = await getSetting(
            {
                "column": "requiredTag"
            }
        );

        if (setting.requiredTag === "enabled") {
            //verificar se tem uma tag   
            try {
                const contactTags = await api.get(`/contactTags/${ticket.contact.id}`);
                if (!contactTags.data.tags) {
                    toast.warning(i18n.t("messagesList.header.buttons.requiredTag"))
                } else {
                    await api.put(`/tickets/${id}`, {
                        status: "closed",
                        userId: user?.id || null,
                    });

                    if (isMounted.current) {
                        setLoading(false);
                    }

                    history.push(`/tickets/`);
                }
            } catch (err) {
                setLoading(false);
                toastError(err);
            }
        } else {
            setLoading(true);
            try {
                await api.put(`/tickets/${id}`, {
                    status: "closed",
                    userId: user?.id || null,
                });

            } catch (err) {
                setLoading(false);
                toastError(err);
            }
            if (isMounted.current) {
                setLoading(false);
            }

            history.push(`/tickets/`);
        }
    };

    const handleCloseIgnoreTicket = async (id) => {
        setLoading(true);
        try {
            await api.put(`/tickets/${id}`, {
                status: "closed",
                userId: user?.id || null,
                sendFarewellMessage: false,
                amountUsedBotQueues: 0
            });

        } catch (err) {
            setLoading(false);
            toastError(err);
        }
        if (isMounted.current) {
            setLoading(false);
        }

        history.push(`/tickets/`);
    };

    const truncate = (str, len) => {
        if (!isNil(str)) {
            if (str.length > len) {
                return str.substring(0, len) + "...";
            }
            return str;
        }
    };

    const handleCloseTransferTicketModal = useCallback(() => {
        if (isMounted.current) {
            setTransferTicketModalOpen(false);
        }
    }, []);

    const handleOpenTransferModal = () => {
        setLoading(true)
        setTransferTicketModalOpen(true);
        if (isMounted.current) {
            setLoading(false);
        }
        handleSelectTicket(ticket);
        history.push(`/tickets/${ticket.uuid}`);
    }

    const handleAcepptTicket = async (id) => {
        setLoading(true);
        try {
            const otherTicket = await api.put(`/tickets/${id}`, ({
                status: ticket.isGroup && ticket.channel === 'whatsapp' ? "group" : "open",
                userId: user?.id,
            }));

            if (otherTicket.data.id !== ticket.id) {
                if (otherTicket.data.userId !== user?.id) {
                    setOpenAlert(true);
                    setUserTicketOpen(otherTicket.data.user.name);
                    setQueueTicketOpen(otherTicket.data.queue.name);
                } else {
                    setLoading(false);
                    setTabOpen(ticket.isGroup ? "group" : "open");
                    handleSelectTicket(otherTicket.data);
                    history.push(`/tickets/${otherTicket.uuid}`);
                }
            } else {
                let setting;

                try {
                    setting = await getSetting({
                        "column": "sendGreetingAccepted"
                    });
                } catch (err) {
                    toastError(err);
                }

                if (setting.sendGreetingAccepted === "enabled" && (!ticket.isGroup || ticket.whatsapp?.groupAsTicket === "enabled")) {
                    handleSendMessage(ticket.id);
                }
                if (isMounted.current) {
                    setLoading(false);
                }

                setTabOpen(ticket.isGroup ? "group" : "open");
                handleSelectTicket(ticket);
                history.push(`/tickets/${ticket.uuid}`);
            }
        } catch (err) {
            setLoading(false);
            toastError(err);
        }
    };

    const handleSendMessage = async (id) => {
        let setting;

        try {
            setting = await getSetting({
                "column": "greetingAcceptedMessage"
            })
        } catch (err) {
            toastError(err);
        }

        const msg = String(setting?.greetingAcceptedMessage || "").trim();
        if (!msg) {
            return;
        }
        const message = {
            read: 1,
            fromMe: true,
            mediaUrl: "",
            body: msg,
        };
        try {
            await api.post(`/messages/${id}`, message);
        } catch (err) {
            toastError(err);
        }
    };

    const handleCloseAlert = useCallback(() => {
        setOpenAlert(false);
        setLoading(false);
    }, []);

    const handleDeleteTicket = async (e, ticketData) => {
        e.stopPropagation();

        const confirmed = window.confirm(
            `${i18n.t("ticketOptionsMenu.confirmationModal.title")} ${ticketData.contact?.name}?\n\n${i18n.t("ticketOptionsMenu.confirmationModal.message")}`
        );

        if (!confirmed) return;

        setLoading(true);
        try {
            await api.delete(`/tickets/${ticketData.id}`);
            if (ticketId && ticketId === ticketData.uuid) {
                setCurrentTicket({ id: null, code: null });
                history.push("/tickets");
            }
        } catch (err) {
            toastError(err);
        } finally {
            if (isMounted.current) {
                setLoading(false);
            }
        }
    };

    const handleSelectTicket = (ticket) => {
        const code = uuidv4();
        const { id, uuid } = ticket;
        setCurrentTicket({ id, uuid, code });
    };

    // Function to fetch messages for the ticket
    const fetchTicketMessages = async (ticketId) => {
        if (!ticketId) return;
        
        setLoadingMessages(true);
        try {
            const { data } = await api.get(`/messages/${ticketId}`, {
                params: { readOnly: "true" }
            });
            if (isMounted.current) {
                // O backend já retorna as mensagens em ordem cronológica
                // (mais antiga primeiro, mais recente por último).
                setTicketMessages(data.messages);
            }
        } catch (err) {
            toastError(err);
        } finally {
            setLoadingMessages(false);
        }
    };

    useEffect(() => {
        if (!loadingMessages && ticketMessages.length > 0 && messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    }, [loadingMessages, ticketMessages]);

    // Handle opening the message dialog
    const handleOpenMessageDialog = (e) => {
        e.stopPropagation();
        setOpenTicketMessageDialog(true);
        fetchTicketMessages(ticket.id);
    };

    const formattedUpdateLabel = ticket.lastMessage
        ? (isSameDay(parseISO(ticket.updatedAt), new Date())
            ? format(parseISO(ticket.updatedAt), "HH:mm")
            : format(parseISO(ticket.updatedAt), "dd/MM/yyyy"))
        : "";
    const connectionBadgeColor = getConnectionColor(ticket?.whatsapp);
    const contactTags = (Array.isArray(ticket?.contact?.tags) ? ticket.contact.tags : [])
        .map((tag) => ({ ...tag, badgeType: "tag" }));
    const ticketTags = (Array.isArray(ticket?.tags) ? ticket.tags : [])
        .map((tag) => ({ ...tag, badgeType: "kanban" }));

    const contactPreviewTags = [...contactTags, ...ticketTags]
        .filter(Boolean)
        .filter((tag, index, allTags) => {
            const tagKey = tag?.id ?? `${String(tag?.name || "").toLowerCase()}|${String(tag?.color || "").toLowerCase()}`;
            return index === allTags.findIndex((candidate) => {
                const candidateKey = candidate?.id ?? `${String(candidate?.name || "").toLowerCase()}|${String(candidate?.color || "").toLowerCase()}`;
                return candidateKey === tagKey;
            });
        })
        .slice(0, 3);

    const renderLastMessageLabel = () => {
        if (ticket.isTyping) return "Digitando...";
        if (!ticket.lastMessage) return "Sem mensagens";
        if (ticket.lastMessage.includes("fb.me")) return "Clique de anúncio";
        if (ticket.lastMessage.toLowerCase().includes("maps.google")) return "Localização";
        if (ticket.lastMessage.includes("data:image/png;base64") && ticket.lastMessage.split("|").length >= 4) return "Anúncio";
        if (ticket.lastMessage.includes("data:image/png;base64")) return "Localização";
        if (ticket.lastMessage.includes("BEGIN:VCARD")) return "Contato";
        return truncate(ticket.lastMessage, 56);
    };

    return (
        <React.Fragment key={ticket.id}>
            {openAlert && (
                <ShowTicketOpen
                    isOpen={openAlert}
                    handleClose={handleCloseAlert}
                    user={userTicketOpen}
                    queue={queueTicketOpen}
                />
            )}
            {acceptTicketWithouSelectQueueOpen && (
                <AcceptTicketWithouSelectQueue
                    modalOpen={acceptTicketWithouSelectQueueOpen}
                    onClose={(e) => setAcceptTicketWithouSelectQueueOpen(false)}
                    ticketId={ticket.id}
                    ticket={ticket}
                />
            )}
            {transferTicketModalOpen && (
                <TransferTicketModalCustom
                    modalOpen={transferTicketModalOpen}
                    onClose={handleCloseTransferTicketModal}
                    ticketid={ticket.id}
                    ticket={ticket}
                />
            )}
            
            {/* Improved Message Dialog */}
            <Dialog 
                open={openTicketMessageDialog} 
                onClose={() => setOpenTicketMessageDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle disableTypography className={classes.dialogTitle}>
                    <Typography style={{ fontSize: "0.95rem", fontWeight: 700 }}>
                        Espiando a conversa
                    </Typography>
                    <IconButton
                        aria-label="close"
                        size="small"
                        className={classes.closeButton}
                        onClick={() => setOpenTicketMessageDialog(false)}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </DialogTitle>

                <div className={classes.messagesHeader}>
                    <Avatar
                        src={ticket?.contact?.urlPicture}
                        className={classes.messageAvatar}
                        imgProps={{ onError: handleAvatarError }}
                    />
                    <div style={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" noWrap>
                            {ticket.contact?.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary" noWrap component="div">
                            {ticket.whatsapp?.name || ticket.channel}
                        </Typography>
                    </div>
                </div>
                
                <DialogContent className={classes.messagesContainer} ref={messagesContainerRef}>
                    {loadingMessages ? (
                        <div className={classes.loadingMessages}>
                            <Typography>Carregando mensagens...</Typography>
                        </div>
                    ) : ticketMessages.length === 0 ? (
                        <div className={classes.emptyMessages}>
                            <MessageIcon className={classes.messageIcon} style={{ fontSize: 40 }} />
                            <Typography variant="body1">
                                {i18n.t("ticketsList.noMessages")}
                            </Typography>
                        </div>
                    ) : (
                        ticketMessages.map((message) => (
                            <Paper 
                                key={message.id} 
                                className={clsx(
                                    classes.messageItem, 
                                    message.fromMe ? classes.fromMe : classes.fromThem
                                )}
                                elevation={0}
                            >
                                <Typography className={classes.messageText}>
                                    {message.mediaType === 'adMetaPreview' ? (
                                        <MarkdownWrapper>Anúncio</MarkdownWrapper>
                                    ) : message.body.includes('data:image/png;base64') ? (
                                        <MarkdownWrapper>Localização</MarkdownWrapper>
                                    ) : message.body.includes('BEGIN:VCARD') ? (
                                        <MarkdownWrapper>Contato</MarkdownWrapper>
                                    ) : (
                                        <MarkdownWrapper>{message.body}</MarkdownWrapper>
                                    )}
                                </Typography>
                                <Typography variant="caption" className={classes.messageTime}>
                                    {format(parseISO(message.createdAt), "HH:mm")}
                                </Typography>
                            </Paper>
                        ))
                    )}
                </DialogContent>
            </Dialog>

            <CloseTicketFarewellDialog
                open={closeFarewellDialogOpen}
                onClose={() => setCloseFarewellDialogOpen(false)}
                loading={loading}
                onConfirmWithoutFarewell={() => { setCloseFarewellDialogOpen(false); handleCloseIgnoreTicket(ticket.id); }}
                onConfirmWithFarewell={() => { setCloseFarewellDialogOpen(false); handleCloseTicket(ticket.id); }}
            />

            <ListItem
                button
                dense
                onClick={(e) => {
                    const isCheckboxClicked = (e.target.tagName.toLowerCase() === "input" && e.target.type === "checkbox")
                        || (e.target.tagName.toLowerCase() === "svg" && e.target.type === undefined)
                        || (e.target.tagName.toLowerCase() === "path" && e.target.type === undefined);

                    if (isCheckboxClicked) return;

                    handleSelectTicket(ticket);
                }}
                selected={ticketId && ticketId === ticket.uuid}
                className={clsx(classes.ticket, {
                    [classes.pendingTicket]: ticket.status === "pending",
                    [classes.unreadTicket]: Number(ticket.unreadMessages) > 0,
                    [classes.readTicket]: Number(ticket.unreadMessages) === 0,
                })}
            >
                <ListItemAvatar className={classes.avatarWrap}>
                    <Avatar
                        className={classes.ticketAvatar}
                        src={`${ticket?.contact?.urlPicture}`}
                        imgProps={{ onError: handleAvatarError }}
                    />
                </ListItemAvatar>

                <ListItemText
                    disableTypography
                    className={classes.contentRoot}
                    primary={
                        <div className={classes.primaryRow}>
                            <div className={classes.nameLine}>
                                {ticket.isGroup && ticket.channel === "whatsapp" && (
                                    <GroupIcon fontSize="small" style={{ color: grey[700] }} />
                                )}
                                {ticket.channel && (
                                    <ConnectionIcon
                                        width="24"
                                        height="24"
                                        className={classes.connectionIcon}
                                        connectionType={ticket.channel}
                                        channel={ticket.whatsapp?.channel || ticket.channel}
                                        provider={ticket.whatsapp?.provider}
                                        connection={ticket.whatsapp}
                                    />
                                )}
                                <Typography noWrap component="span" className={classes.contactName}>
                                    {truncate(ticket.contact?.name, 42)}
                                </Typography>
                            </div>

                            <div className={classes.rightTop}>
                                {Number(ticket.unreadMessages) > 0 && (
                                    <span className={classes.unreadCounter}>
                                        {ticket.unreadMessages}
                                    </span>
                                )}
                                {ticket.lastMessage && (
                                    <Typography
                                        component="span"
                                        className={Number(ticket.unreadMessages) > 0 ? classes.lastMessageTimeUnread : classes.lastMessageTime}
                                    >
                                        {formattedUpdateLabel}
                                    </Typography>
                                )}
                                <Tooltip title="Espiar conversa">
                                    <VisibilityIcon onClick={handleOpenMessageDialog} className={classes.viewIcon} />
                                </Tooltip>
                            </div>
                        </div>
                    }
                    secondary={
                        <div className={classes.secondaryContent}>
                            <Typography
                                noWrap
                                component="span"
                                className={clsx(classes.messagePreview, {
                                    [classes.messagePreviewUnread]: Number(ticket.unreadMessages) > 0,
                                    [classes.messagePreviewTyping]: ticket.isTyping,
                                })}
                            >
                                {renderLastMessageLabel()}
                            </Typography>

                            <div className={classes.metaRow}>
                                {ticket?.whatsapp && (
                                    <span
                                        className={classes.metaPill}
                                        style={{ backgroundColor: connectionBadgeColor }}
                                    >
                                        {ticket.whatsapp?.name.toUpperCase()}
                                    </span>
                                )}
                                <span
                                    className={classes.metaPill}
                                    style={{ backgroundColor: ticket.queue?.color || "#7c7c7c" }}
                                >
                                    {ticket.queueId
                                        ? ticket.queue?.name.toUpperCase()
                                        : ticket.status === "lgpd"
                                            ? "LGPD"
                                            : "SEM FILA"}
                                </span>
                                {ticket?.user && (
                                    <span className={`${classes.metaPill} ${classes.metaPillUser}`}>
                                        {ticket.user?.name.toUpperCase()}
                                    </span>
                                )}
                                {contactPreviewTags.map((tag) => (
                                    <span
                                        key={`ticket-contact-meta-tag-${ticket.id}-${tag.id}`}
                                        className={classes.metaTagPill}
                                        style={{ backgroundColor: tag.color || "#6b7280" }}
                                        title={tag.name}
                                    >
                                        {tag.badgeType === "kanban" ? (
                                            <ViewKanban style={{ fontSize: 10 }} />
                                        ) : (
                                            <LocalOfferOutlinedIcon style={{ fontSize: 10 }} />
                                        )}
                                        {String(tag.name || "").toUpperCase()}
                                    </span>
                                ))}
                            </div>
                        </div>
                    }
                />

                <ListItemSecondaryAction className={classes.actionsColumn}>
                    <div className={classes.actionButtonsRow}>
                        {ticket.status === "pending" && (ticket.queueId === null || ticket.queueId === undefined) && (
                            <ButtonWithSpinner
                                variant="contained"
                                className={clsx(classes.actionButton, classes.actionButtonAccept)}
                                size="small"
                                loading={loading}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenAcceptTicketWithouSelectQueue();
                                }}
                            >
                                <Tooltip title={i18n.t("ticketsList.buttons.accept")}>
                                    <Done className={classes.actionIcon} />
                                </Tooltip>
                            </ButtonWithSpinner>
                        )}

                        {ticket.status === "pending" && ticket.queueId !== null && (
                            <ButtonWithSpinner
                                variant="contained"
                                className={clsx(classes.actionButton, classes.actionButtonAccept)}
                                size="small"
                                loading={loading}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAcepptTicket(ticket.id);
                                }}
                            >
                                <Tooltip title={i18n.t("ticketsList.buttons.accept")}>
                                    <Done className={classes.actionIcon} />
                                </Tooltip>
                            </ButtonWithSpinner>
                        )}

                        {(ticket.status === "pending" || ticket.status === "open" || ticket.status === "group") && (
                            <ButtonWithSpinner
                                variant="contained"
                                className={clsx(classes.actionButton, classes.actionButtonTransfer)}
                                size="small"
                                loading={loading}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenTransferModal();
                                }}
                            >
                                <Tooltip title={i18n.t("ticketsList.buttons.transfer")}>
                                    <SwapHoriz className={classes.actionIcon} />
                                </Tooltip>
                            </ButtonWithSpinner>
                        )}

                        {(ticket.status === "open" || ticket.status === "group") && (
                            <ButtonWithSpinner
                                variant="contained"
                                className={clsx(classes.actionButton, classes.actionButtonDanger)}
                                size="small"
                                loading={loading}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const hasFarewellMessage = Boolean(user?.farewellMessage) || Boolean(ticket?.whatsapp?.complationMessage);
                                    if (hasFarewellMessage) {
                                        setCloseFarewellDialogOpen(true);
                                    } else {
                                        handleCloseTicket(ticket.id);
                                    }
                                }}
                            >
                                <Tooltip title={i18n.t("ticketsList.buttons.closed")}>
                                    <HighlightOff className={classes.actionIcon} />
                                </Tooltip>
                            </ButtonWithSpinner>
                        )}

                        {(ticket.status === "pending" || ticket.status === "lgpd") && (user.userClosePendingTicket === "enabled" || user.profile === "admin") && (
                            <ButtonWithSpinner
                                variant="contained"
                                className={clsx(classes.actionButton, classes.actionButtonDanger)}
                                size="small"
                                loading={loading}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCloseIgnoreTicket(ticket.id);
                                }}
                            >
                                <Tooltip title={i18n.t("ticketsList.buttons.ignore")}>
                                    <HighlightOff className={classes.actionIcon} />
                                </Tooltip>
                            </ButtonWithSpinner>
                        )}

                        {ticket.status === "closed" && (ticket.queueId === null || ticket.queueId === undefined) && (
                            <ButtonWithSpinner
                                variant="contained"
                                className={clsx(classes.actionButton, classes.actionButtonNeutral)}
                                size="small"
                                loading={loading}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenAcceptTicketWithouSelectQueue();
                                }}
                            >
                                <Tooltip title={i18n.t("ticketsList.buttons.reopen")}>
                                    <Replay className={classes.actionIcon} />
                                </Tooltip>
                            </ButtonWithSpinner>
                        )}

                        {ticket.status === "closed" && ticket.queueId !== null && (
                            <ButtonWithSpinner
                                variant="contained"
                                className={clsx(classes.actionButton, classes.actionButtonNeutral)}
                                size="small"
                                loading={loading}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAcepptTicket(ticket.id);
                                }}
                            >
                                <Tooltip title={i18n.t("ticketsList.buttons.reopen")}>
                                    <Replay className={classes.actionIcon} />
                                </Tooltip>
                            </ButtonWithSpinner>
                        )}

                        {ticket.status === "closed" && canDeleteTickets && (
                            <ButtonWithSpinner
                                variant="contained"
                                className={clsx(classes.actionButton, classes.actionButtonDelete)}
                                size="small"
                                loading={loading}
                                onClick={(e) => handleDeleteTicket(e, ticket)}
                            >
                                <Tooltip title={i18n.t("ticketOptionsMenu.delete")}>
                                    <DeleteForever className={classes.actionIcon} />
                                </Tooltip>
                            </ButtonWithSpinner>
                        )}
                    </div>
                </ListItemSecondaryAction>

                {ticket.useIntegration && (
                    <Tooltip title="IA respondendo">
                        <div className={classes.aiBadge}>
                            <SmartToyIcon style={{ fontSize: 14 }} />
                        </div>
                    </Tooltip>
                )}
            </ListItem>
            {/* <Divider variant="inset" component="li" /> */}
        </React.Fragment>
    );
};

export default React.memo(TicketListItemCustom);
