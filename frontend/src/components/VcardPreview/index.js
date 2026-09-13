import React, { useEffect, useState, useContext } from 'react';
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";
import api from "../../services/api";

import Avatar from "@material-ui/core/Avatar";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";

import { AuthContext } from "../../context/Auth/AuthContext";

import { Button, CircularProgress, Divider } from "@material-ui/core";
import { isNil } from 'lodash';
import PersonOutlineIcon from "@material-ui/icons/PersonOutline";
import PhoneOutlinedIcon from "@material-ui/icons/PhoneOutlined";
import ChatOutlinedIcon from "@material-ui/icons/ChatOutlined";
import ShowTicketOpen from '../ShowTicketOpenModal';

const useStyles = makeStyles((theme) => ({
    card: {
        minWidth: 240,
        maxWidth: 300,
        borderRadius: 16,
        overflow: "hidden",
        border: theme.mode === "light"
            ? "1px solid rgba(15, 23, 42, 0.08)"
            : "1px solid rgba(148, 163, 184, 0.16)",
        background: theme.mode === "light"
            ? "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)"
            : "linear-gradient(180deg, #0f172a 0%, #111827 100%)",
        boxShadow: theme.mode === "light"
            ? "0 12px 28px rgba(15, 23, 42, 0.08)"
            : "0 12px 28px rgba(0, 0, 0, 0.28)",
    },
    hero: {
        padding: "12px 12px 10px",
        background: theme.mode === "light"
            ? "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)"
            : "linear-gradient(135deg, #0f766e 0%, #115e59 100%)",
        color: "#fff",
    },
    heroRow: {
        display: "flex",
        alignItems: "center",
        gap: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        border: "2px solid rgba(255, 255, 255, 0.35)",
        background: "rgba(255, 255, 255, 0.18)",
    },
    heroLabel: {
        fontSize: "0.74rem",
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        opacity: 0.84,
    },
    heroTitle: {
        fontWeight: 700,
        lineHeight: 1.2,
        wordBreak: "break-word",
    },
    body: {
        padding: 12,
    },
    infoRow: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 8,
    },
    infoIcon: {
        color: theme.mode === "light" ? "#0f766e" : "#5eead4",
        fontSize: 20,
    },
    infoText: {
        color: theme.mode === "light" ? "#0f172a" : "#e5e7eb",
        fontWeight: 500,
        wordBreak: "break-word",
    },
    helperText: {
        marginTop: 2,
        color: theme.mode === "light" ? "#475569" : "#94a3b8",
        fontSize: "0.76rem",
        lineHeight: 1.45,
    },
    footer: {
        padding: 10,
    },
    actionButton: {
        borderRadius: 10,
        minHeight: 38,
        textTransform: "none",
        fontWeight: 700,
        boxShadow: "none",
    },
    actionIcon: {
        marginRight: 8,
        fontSize: 18,
    },
    disabledButton: {
        background: theme.mode === "light" ? "#e2e8f0 !important" : "#334155 !important",
        color: theme.mode === "light" ? "#64748b !important" : "#94a3b8 !important",
    },
    divider: {
        opacity: 0.7,
    }
}));

const normalizeNumber = (value) => String(value || "").replace(/\D/g, "");

const formatPhoneNumber = (value) => {
    const digits = normalizeNumber(value);

    if (!digits) return "";

    if (digits.length === 13) {
        return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }

    if (digits.length === 12) {
        return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
    }

    if (digits.length === 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }

    if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return value;
};

const VcardPreview = ({ contact, numbers, queueId, whatsappId }) => {
    const classes = useStyles();
    const history = useHistory();
    const { user } = useContext(AuthContext);

    const companyId = user.companyId;

    const [openAlert, setOpenAlert] = useState(false);
    const [userTicketOpen, setUserTicketOpen] = useState("");
    const [queueTicketOpen, setQueueTicketOpen] = useState("");
    const [isLoadingContact, setIsLoadingContact] = useState(false);
    const [isStartingChat, setIsStartingChat] = useState(false);

    const [selectedContact, setContact] = useState({
        id: 0,
        name: "",
        number: "",
        urlPicture: "",
        profilePicUrl: ""
    });

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            const fetchContacts = async () => {
                try {
                    if (isNil(numbers)) {
                        setContact({
                            id: 0,
                            name: contact || "",
                            number: "",
                            urlPicture: "",
                            profilePicUrl: ""
                        });
                        return
                    }
                    setIsLoadingContact(true);
                    const number = normalizeNumber(numbers);

                    if (!number) {
                        setContact({
                            id: 0,
                            name: contact || "",
                            number: "",
                            urlPicture: "",
                            profilePicUrl: ""
                        });
                        return;
                    }
                    
                    const getData = await api.get(`/contacts/profile/${number}`);

                    if (getData.data.contactId && getData.data.contactId !== 0) {
                        let obj = {
                            id: getData.data.contactId,
                            name: contact,
                            number: numbers,
                            urlPicture: getData.data.urlPicture,
                            profilePicUrl: getData.data.urlPicture
                        }

                        setContact(obj)
                  
                    } else {
                        let contactObj = {
                            name: contact,
                            number: number,
                            email: "",
                            companyId: companyId
                        }

                        const { data } = await api.post("/contacts", contactObj);
                        setContact({
                            ...data,
                            name: data.name || contact,
                            number: data.number || number,
                            urlPicture: data.urlPicture || data.profilePicUrl || "",
                            profilePicUrl: data.profilePicUrl || data.urlPicture || ""
                        })
                    }
            
                } catch (err) {
                    toastError(err);
                } finally {
                    setIsLoadingContact(false);
                }
            };
            fetchContacts();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [companyId, contact, numbers]);

    const handleCloseAlert = () => {
        setOpenAlert(false);
        setUserTicketOpen("");
        setQueueTicketOpen("");
    };

    const handleNewChat = async () => {
        if (!normalizeNumber(selectedContact?.number || numbers)) {
            toast.info("Esse contato compartilhado não possui um número válido para iniciar conversa.");
            return;
        }

        if (!selectedContact?.id) {
            toast.info("Ainda não foi possível preparar esse contato. Tente novamente em instantes.");
            return;
        }

        try {
            setIsStartingChat(true);
            const { data: ticket } = await api.post("/tickets", {
                contactId: selectedContact.id,
                userId: user.id,
                status: "open",
                queueId,
                companyId: companyId,
                whatsappId
            });

            if (!ticket?.uuid) {
                toast.info("O ticket foi criado, mas não retornou identificador para abrir a conversa.");
                return;
            }

            history.push(`/tickets/${ticket.uuid}`);
        } catch (err) {
            const rawError = err?.response?.data?.error;
            let ticket = null;

            if (typeof rawError === "string") {
                try {
                    ticket = JSON.parse(rawError);
                } catch (e) {
                    ticket = null;
                }
            } else if (rawError && typeof rawError === "object") {
                ticket = rawError;
            }

            if (!ticket) {
                toastError(err);
                return;
            }

            if (ticket.userId !== user?.id) {
                setOpenAlert(true);
                setUserTicketOpen(ticket.user.name);
                setQueueTicketOpen(ticket.queue.name);
            } else {
                setOpenAlert(false);
                setUserTicketOpen("");
                setQueueTicketOpen("");
                if (!ticket?.uuid) {
                    return;
                }
                history.push(`/tickets/${ticket.uuid}`);
            }
        } finally {
            setIsStartingChat(false);
        }
    }

    const displayName = selectedContact?.name || contact || "Contato compartilhado";
    const displayNumber = formatPhoneNumber(selectedContact?.number || numbers);
    const hasValidNumber = Boolean(normalizeNumber(selectedContact?.number || numbers));
    const canStartChat = hasValidNumber && Boolean(selectedContact?.id) && !isLoadingContact && !isStartingChat;
    const avatarSrc = selectedContact?.urlPicture || selectedContact?.profilePicUrl || "";

    return (
        <>
            <div className={classes.card}>
                <ShowTicketOpen
                    isOpen={openAlert}
                    handleClose={handleCloseAlert}
                    user={userTicketOpen}
                    queue={queueTicketOpen}
                />
                <div className={classes.hero}>
                    <div className={classes.heroRow}>
                        <Avatar src={avatarSrc} className={classes.avatar}>
                            <PersonOutlineIcon />
                        </Avatar>
                        <div>
                            <Typography className={classes.heroLabel}>
                                Contato compartilhado
                            </Typography>
                            <Typography variant="subtitle1" className={classes.heroTitle}>
                                {displayName}
                            </Typography>
                        </div>
                    </div>
                </div>

                <div className={classes.body}>
                    <div className={classes.infoRow}>
                        <PhoneOutlinedIcon className={classes.infoIcon} />
                        <Typography variant="body2" className={classes.infoText}>
                            {displayNumber || "Número não disponível no contato enviado"}
                        </Typography>
                    </div>

                    <Typography className={classes.helperText}>
                        {isLoadingContact
                            ? "Preparando o contato para iniciar uma nova conversa."
                            : !canStartChat
                                ? "Não foi possível iniciar conversa com este cartão até que um número válido seja identificado."
                                : ""}
                    </Typography>
                </div>

                <Divider className={classes.divider} />

                <div className={classes.footer}>
                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        onClick={handleNewChat}
                        disabled={!canStartChat}
                        className={`${classes.actionButton} ${!canStartChat ? classes.disabledButton : ""}`}
                    >
                        {isStartingChat ? (
                            <>
                                <CircularProgress size={18} color="inherit" className={classes.actionIcon} />
                                Abrindo conversa...
                            </>
                        ) : (
                            <>
                                <ChatOutlinedIcon className={classes.actionIcon} />
                                Conversar
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </>
    );

};

export default VcardPreview;
