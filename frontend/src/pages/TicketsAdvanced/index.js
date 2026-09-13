import React, { useState, useEffect, useContext } from "react";
import { useParams } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import QuestionAnswerIcon from '@material-ui/icons/QuestionAnswer';
import ChatIcon from '@material-ui/icons/Chat';

import TicketsManagerTabs from "../../components/TicketsManagerTabs";
import Ticket from "../../components/Ticket";
import TicketAdvancedLayout from "../../components/TicketAdvancedLayout";

import { TicketsContext } from "../../context/Tickets/TicketsContext";

import { i18n } from "../../translate/i18n";
import { QueueSelectedProvider } from "../../context/QueuesSelected/QueuesSelectedContext";
import useKeyboardOpen from "../../hooks/useKeyboardOpen";

const useStyles = makeStyles(theme => ({
    root: {
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        backgroundColor:
            theme.mode === "light" ? "#f8fafc" : "rgba(10,14,26,0.99)",
        gridRow: "1 / -1",
    },
    header: {
        flexShrink: 0,
    },
    content: {
        flex: 1,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
    },
    bottomNav: {
        flexShrink: 0,
        display: "flex",
        borderBottom: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.2)" : "rgba(148,163,184,0.12)"}`,
        backgroundColor:
            theme.mode === "light" ? "rgba(255,255,255,0.96)" : "rgba(15,23,42,0.97)",
        backdropFilter: "blur(10px)",
        height: 56,
    },
    bottomNavAction: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        cursor: "pointer",
        color: theme.mode === "light" ? "#94a3b8" : "#64748b",
        transition: "all 0.2s ease",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
        borderBottom: "2px solid transparent",
        "&.active": {
            color: theme.mode === "light" ? theme.palette.primary.main : "#93c5fd",
            borderBottomColor: theme.mode === "light" ? theme.palette.primary.main : "#93c5fd",
        },
    },
    bottomNavIcon: {
        fontSize: 22,
    },
    bottomNavLabel: {
        fontSize: "0.65rem",
        fontWeight: 600,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
    },
    placeholderContainer: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: theme.spacing(2),
        backgroundColor:
            theme.mode === "light" ? "#f8fafc" : "rgba(10,14,26,0.99)",
        padding: theme.spacing(4),
        textAlign: "center",
    },
    placeholderIconWrap: {
        width: 72,
        height: 72,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor:
            theme.mode === "light" ? "rgba(37,99,235,0.08)" : "rgba(96,165,250,0.12)",
        marginBottom: theme.spacing(0.5),
    },
    placeholderIcon: {
        fontSize: 36,
        color: theme.mode === "light" ? theme.palette.primary.main : "#93c5fd",
    },
    placeholderTitle: {
        fontSize: "1rem",
        fontWeight: 700,
        color: theme.mode === "light" ? "#0f172a" : "#f1f5f9",
        letterSpacing: "-0.01em",
    },
    placeholderText: {
        fontSize: "0.82rem",
        color: theme.mode === "light" ? "#64748b" : "#94a3b8",
        lineHeight: 1.5,
        maxWidth: 260,
    },
    placeholderButton: {
        marginTop: theme.spacing(0.5),
        borderRadius: 10,
        fontWeight: 600,
        fontSize: "0.82rem",
        textTransform: "none",
        padding: "8px 24px",
        background: theme.mode === "light"
            ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
            : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
        color: "#ffffff",
        boxShadow: theme.mode === "light"
            ? "0 4px 12px rgba(37,99,235,0.3)"
            : "0 4px 12px rgba(59,130,246,0.35)",
        "&:hover": {
            boxShadow: theme.mode === "light"
                ? "0 6px 16px rgba(37,99,235,0.4)"
                : "0 6px 16px rgba(59,130,246,0.45)",
        },
    },
}));

const TicketAdvanced = (props) => {
    const classes = useStyles();
    const { ticketId } = useParams();
    const [option, setOption] = useState(0);
    const { currentTicket, setCurrentTicket } = useContext(TicketsContext)
    const keyboardOpen = useKeyboardOpen();
    const isViewingChat = option === 0 && !!ticketId && ticketId !== "undefined";
    const hideChromeForKeyboard = isViewingChat && keyboardOpen;

    // Com o teclado virtual aberto sobre a conversa, esconde o cabeçalho do
    // sistema (AppBar em layout/index.js) para sobrar mais espaço vertical
    // pra ver as mensagens, igual ao comportamento do WhatsApp.
    useEffect(() => {
        document.body.classList.toggle("kb-open-chat", hideChromeForKeyboard);

        // Esconder o AppBar muda a altura do conteúdo enquanto o input ainda
        // está focado. Alguns navegadores mobile reagem a essa mudança de
        // layout tentando "reajustar" o scroll pra manter o input visível,
        // reabrindo um pequeno vão entre o teclado e o input. Cancela esse
        // scroll extra assim que o layout se estabiliza (mesma técnica usada
        // no scroll-lock de Ticket/index.js).
        if (hideChromeForKeyboard) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const contentEl = document.querySelector("main");
                    if (contentEl && contentEl.scrollTop !== 0) contentEl.scrollTop = 0;
                    if (window.scrollY !== 0) window.scrollTo(0, 0);
                });
            });
        }

        return () => {
            document.body.classList.remove("kb-open-chat");
        };
    }, [hideChromeForKeyboard]);

    useEffect(() => {
        if (currentTicket.id !== null) {
            setCurrentTicket({ id: currentTicket.id, code: '#open' })
        }
        if (!ticketId) {
            setOption(1)
        }
        return () => {
            setCurrentTicket({ id: null, code: null })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (currentTicket.id !== null) {
            setOption(0)
        }
    }, [currentTicket])

    const renderPlaceholder = () => {
        return (
            <Box className={classes.placeholderContainer}>
                <div className={classes.placeholderIconWrap}>
                    <ChatIcon className={classes.placeholderIcon} />
                </div>
                <div className={classes.placeholderTitle}>Nenhuma conversa aberta</div>
                <div className={classes.placeholderText}>{i18n.t("chat.noTicketMessage")}</div>
                <Button
                    onClick={() => setOption(1)}
                    className={classes.placeholderButton}
                >
                    Selecionar Ticket
                </Button>
            </Box>
        );
    }

    const renderMessageContext = () => {
        if (ticketId && ticketId !== "undefined") {
            return <Ticket />
        }
        return renderPlaceholder()
    }

    const renderTicketsManagerTabs = () => {
        return <TicketsManagerTabs
        />
    }

    return (
        <QueueSelectedProvider>
            <TicketAdvancedLayout>
                <Box className={classes.root}>
                    {!hideChromeForKeyboard && (
                        <div className={classes.bottomNav}>
                            <div
                                className={`${classes.bottomNavAction} ${option === 0 ? "active" : ""}`}
                                onClick={() => setOption(0)}
                            >
                                <ChatIcon className={classes.bottomNavIcon} />
                                <span className={classes.bottomNavLabel}>Ticket</span>
                            </div>
                            <div
                                className={`${classes.bottomNavAction} ${option === 1 ? "active" : ""}`}
                                onClick={() => setOption(1)}
                            >
                                <QuestionAnswerIcon className={classes.bottomNavIcon} />
                                <span className={classes.bottomNavLabel}>Atendimentos</span>
                            </div>
                        </div>
                    )}
                    <Box className={classes.content}>
                        {option === 0 ? renderMessageContext() : renderTicketsManagerTabs()}
                    </Box>
                </Box>
            </TicketAdvancedLayout>
        </QueueSelectedProvider>
    );
};

export default TicketAdvanced;
