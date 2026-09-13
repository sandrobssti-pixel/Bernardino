import React, { useContext, useState, useEffect, useRef } from "react";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import { IconButton, Menu, useMediaQuery } from "@material-ui/core";
import { CheckCircleOutline, DeviceHubOutlined, History, MoreVert, PictureAsPdf, Replay, SwapHorizOutlined } from "@material-ui/icons";
import { v4 as uuidv4 } from "uuid";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
// import TicketOptionsMenu from "../TicketOptionsMenu";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import usePlans from "../../hooks/usePlans";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import Tooltip from '@material-ui/core/Tooltip';
import ConfirmationModal from "../ConfirmationModal";
import TransferTicketModalCustom from "../TransferTicketModalCustom";
import AcceptTicketWithouSelectQueue from "../AcceptTicketWithoutQueueModal";
import CloseTicketFarewellDialog from "../CloseTicketFarewellDialog";

//icones
import HighlightOffIcon from "@material-ui/icons/HighlightOff";
import UndoIcon from '@material-ui/icons/Undo';
import SearchIcon from "@material-ui/icons/Search";
import CloseIcon from "@material-ui/icons/Close";

import ScheduleModal from "../ScheduleModal";
import MenuItem from "@material-ui/core/MenuItem";
import ShowTicketOpen from "../ShowTicketOpenModal";
import { toast } from "react-toastify";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import ShowTicketLogModal from "../ShowTicketLogModal";
import TicketMessagesDialog from "../TicketMessagesDialog";
import { useTheme } from "@material-ui/styles";

const useStyles = makeStyles(theme => ({
    actionButtons: {
        marginRight: 8,
        maxWidth: "100%",
        flex: "none",
        alignSelf: "center",
        marginLeft: "auto",
        display: "flex",
        alignItems: "center",
        gap: 6,
        "& > *": {
            margin: 0,
        },
    },
    buttonGroup: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 5px",
    },
    buttonDivider: {
        width: 1,
        height: 18,
        background: theme.mode === "light" ? "rgba(148,163,184,0.35)" : "rgba(148,163,184,0.2)",
        margin: "0 3px",
        flexShrink: 0,
    },
    iconButton: {
        width: 34,
        height: 34,
        borderRadius: 8,
        border: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.3)" : "rgba(148,163,184,0.22)"}`,
        color: theme.mode === "light" ? "#64748b" : "#94a3b8",
        background: "transparent",
        transition: "all 0.15s ease",
        "&:hover": {
            background: theme.palette.chat.listHover,
            borderColor: theme.mode === "light" ? "rgba(100,116,139,0.45)" : "rgba(148,163,184,0.4)",
        },
    },
    iconButtonResolve: {
        width: 34,
        height: 34,
        borderRadius: 8,
        border: `1px solid ${theme.mode === "light" ? "rgba(239,68,68,0.3)" : "rgba(248,113,113,0.28)"}`,
        color: theme.mode === "light" ? "#ef4444" : "#f87171",
        background: "transparent",
        transition: "all 0.15s ease",
        "&:hover": {
            background: theme.palette.chat.listHover,
            borderColor: theme.mode === "light" ? "rgba(239,68,68,0.5)" : "rgba(248,113,113,0.5)",
        },
    },
    iconButtonReturn: {
        width: 34,
        height: 34,
        borderRadius: 8,
        border: `1px solid ${theme.mode === "light" ? "rgba(217,119,6,0.3)" : "rgba(251,191,36,0.28)"}`,
        color: theme.mode === "light" ? "#d97706" : "#fbbf24",
        background: "transparent",
        transition: "all 0.15s ease",
        "&:hover": {
            background: theme.palette.chat.listHover,
            borderColor: theme.mode === "light" ? "rgba(217,119,6,0.5)" : "rgba(251,191,36,0.5)",
        },
    },
    iconButtonTransfer: {
        width: 34,
        height: 34,
        borderRadius: 8,
        border: `1px solid ${theme.mode === "light" ? "rgba(37,99,235,0.3)" : "rgba(96,165,250,0.28)"}`,
        color: theme.mode === "light" ? "#2563eb" : "#60a5fa",
        background: "transparent",
        transition: "all 0.15s ease",
        "&:hover": {
            background: theme.palette.chat.listHover,
            borderColor: theme.mode === "light" ? "rgba(37,99,235,0.5)" : "rgba(96,165,250,0.5)",
        },
    },
    iconButtonSearch: {
        width: 34,
        height: 34,
        borderRadius: 8,
        border: `1px solid ${theme.mode === "light" ? "rgba(5,150,105,0.3)" : "rgba(52,211,153,0.28)"}`,
        color: theme.mode === "light" ? "#059669" : "#34d399",
        background: "transparent",
        transition: "all 0.15s ease",
        "&:hover": {
            background: theme.palette.chat.listHover,
            borderColor: theme.mode === "light" ? "rgba(5,150,105,0.5)" : "rgba(52,211,153,0.5)",
        },
    },
    iosToggleContainer: {
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
    },
    iosSwitch: {
        position: "relative",
        display: "inline-block",
        width: 44,
        height: 24,
        "& input": {
            opacity: 0,
            width: 0,
            height: 0,
        },
    },
    iosSlider: {
        position: "absolute",
        cursor: "pointer",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.mode === "light" ? "#cbd5e1" : "#475569",
        transition: "0.3s",
        borderRadius: 24,
        "&:before": {
            position: "absolute",
            content: '""',
            height: 18,
            width: 18,
            left: 3,
            bottom: 3,
            backgroundColor: "white",
            transition: "0.3s",
            borderRadius: "50%",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        },
    },
    iosSliderChecked: {
        backgroundColor: "#22c55e !important",
        "&:before": {
            transform: "translateX(20px)",
        },
    },
    bottomButtonVisibilityIcon: {
        padding: 1,
        color: theme.mode === "light" ? '#0872b9' : '#FFF',
    },
    botoes: {
        display: "flex",
        padding: "15px",
        justifyContent: "flex-end",
        maxWidth: "100%",
    },
    acceptButton: {
        borderRadius: 8,
        fontSize: "0.7rem",
        fontWeight: 700,
        textTransform: "none",
        letterSpacing: "0.01em",
        padding: "3px 12px",
        minHeight: 28,
        background: theme.mode === "light" ? "#bbf7d0" : "rgba(34,197,94,0.3)",
        color: theme.mode === "light" ? "#15803d" : "#4ade80",
        boxShadow: "none",
        transition: "background-color 0.15s ease",
        "&:hover": {
            background: theme.mode === "light" ? "#86efac" : "rgba(34,197,94,0.4)",
        },
    }
}));

const TicketActionButtonsCustom = ({ ticket, onToggleSearch, isSearching
    // , showSelectMessageCheckbox,
    // selectedMessages,
    // forwardMessageModalOpen,
    // setForwardMessageModalOpen
}) => {
    const classes = useStyles();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const history = useHistory();
    const [isMounted, setIsMounted] = useState(true);
    const [loading, setLoading] = useState(false);
    const { user } = useContext(AuthContext);
    const { setCurrentTicket, setTabOpen } = useContext(TicketsContext);
    const [open, setOpen] = React.useState(false);
    const [confirmationOpen, setConfirmationOpen] = useState(false);
    const [transferTicketModalOpen, setTransferTicketModalOpen] = useState(false);
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
    const [contactId, setContactId] = useState(null);
    const [acceptTicketWithouSelectQueueOpen, setAcceptTicketWithouSelectQueueOpen] = useState(false);
    const [showTicketLogOpen, setShowTicketLogOpen] = useState(false);
    const [openTicketMessageDialog, setOpenTicketMessageDialog] = useState(false);
    const [disableBot, setDisableBot] = useState(Boolean(ticket?.contact?.disableBot));

    const [showSchedules, setShowSchedules] = useState(false);
    const [enableIntegration, setEnableIntegration] = useState(ticket.useIntegration);

    const [openAlert, setOpenAlert] = useState(false);
    const [userTicketOpen, setUserTicketOpen] = useState("");
    const [queueTicketOpen, setQueueTicketOpen] = useState("");
    const [logTicket, setLogTicket] = useState([]);

    const { get: getSetting } = useCompanySettings()
    const { getPlanCompany } = usePlans();


    const [anchorEl, setAnchorEl] = useState(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const canDeleteTickets = user.profile === "admin" || user.canDeleteTickets === "enabled";

    useEffect(() => {
        fetchData();

        // Cleanup function to set isMounted to false when the component unmounts
        return () => {
            setIsMounted(false);
        };
    }, []);


    const fetchData = async () => {
        const companyId = user.companyId;
        const planConfigs = await getPlanCompany(undefined, companyId);
        setShowSchedules(planConfigs.plan.useSchedules);
        setOpenTicketMessageDialog(false);
        setDisableBot(Boolean(ticket?.contact?.disableBot))

        setShowTicketLogOpen(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }

    const handleClickOpen = async (e) => {
        const setting = await getSetting({
            "column": "requiredTag"
        });

        const hasFarewellMessage = Boolean(user?.farewellMessage) || Boolean(ticket?.whatsapp?.complationMessage);

        if (setting?.requiredTag === "enabled") {
            //verificar se tem uma tag
            try {
                if (!ticket?.contact?.id) {
                    return;
                }
                const contactTags = await api.get(`/contactTags/${ticket.contact.id}`);
                if (!contactTags.data.tags) {
                    toast.warning(i18n.t("messagesList.header.buttons.requiredTag"))
                } else if (hasFarewellMessage) {
                    setOpen(true);
                } else {
                    handleUpdateTicketStatus(e, "closed", user?.id);
                }
            } catch (err) {
                toastError(err);
            }
        } else if (hasFarewellMessage) {
            setOpen(true);
        } else {
            handleUpdateTicketStatus(e, "closed", user?.id);
        }
    };

    const handleClose = () => {
        setOpen(false);
    };

    const handleCloseAlert = () => {
        setOpenAlert(false);
        setLoading(false);
    };
    const handleOpenAcceptTicketWithouSelectQueue = async () => {

        setAcceptTicketWithouSelectQueueOpen(true);

    };

    const handleMenu = event => {
        setAnchorEl(event.currentTarget);
        setMenuOpen(true);
    };

    const handleCloseMenu = () => {
        setAnchorEl(null);
        setMenuOpen(false);
    };

    const handleOpenTransferModal = (e) => {
        setTransferTicketModalOpen(true);
        if (typeof handleClose == "function") handleClose();
    };

    const handleOpenConfirmationModal = (e) => {
        setConfirmationOpen(true);
        handleCloseMenu();
    };


    const handleCloseTicketWithoutFarewellMsg = async () => {
        setLoading(true);
        try {
            await api.put(`/tickets/${ticket.id}`, {
                status: "closed",
                userId: user?.id || null,
                sendFarewellMessage: false,
                amountUsedBotQueues: 0
            });

            setLoading(false);
            history.push("/tickets");
        } catch (err) {
            setLoading(false);
            toastError(err);
        }
    };

    const handleExportPDF = async () => {
        setOpenTicketMessageDialog(true);
        handleCloseMenu();
    }

    const handleEnableIntegration = async () => {
        setLoading(true);
        try {
            await api.put(`/tickets/${ticket.id}`, {
                useIntegration: !enableIntegration
            });
            setEnableIntegration(!enableIntegration)

            setLoading(false);
        } catch (err) {
            setLoading(false);
            toastError(err);
        }
    };

    const handleShowLogTicket = async () => {
        setShowTicketLogOpen(true);
    };

    const handleContactToggleDisableBot = async () => {

        const id = ticket?.contact?.id;
        if (!id) {
            return;
        }


        try {
            const { data } = await api.put(`/contacts/toggleDisableBot/${id}`);
            if (ticket?.contact) {
                ticket.contact.disableBot = data.disableBot;
            }
            setDisableBot(data.disableBot)

        } catch (err) {
            toastError(err);
        }
    };

    const handleCloseTransferTicketModal = () => {
        setTransferTicketModalOpen(false);
    };

    const handleDeleteTicket = async () => {
        try {
            await api.delete(`/tickets/${ticket.id}`);
            history.push("/tickets")
        } catch (err) {
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
        const msg = String(setting?.greetingAcceptedMessage || "").trim(); //`{{ms}} *{{name}}*, ${i18n.t("mainDrawer.appBar.user.myName")} *${user?.name}* ${i18n.t("mainDrawer.appBar.user.continuity")}.`;
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


    const handleUpdateTicketStatus = async (e, status, userId) => {
        setLoading(true);
        try {
            await api.put(`/tickets/${ticket.id}`, {
                status: status,
                userId: userId || null,
            });

            let setting;

            try {
                setting = await getSetting({
                    "column": "sendGreetingAccepted"
                })
            } catch (err) {
                toastError(err);
            }

            if (setting?.sendGreetingAccepted === "enabled" && (!ticket.isGroup || ticket.whatsapp?.groupAsTicket === "enabled") && ticket.status === "pending") {
                handleSendMessage(ticket.id);
            }


            // if (isMounted.current) {
            setLoading(false);
            // }
            if (status === "open" || status === "group") {
                setCurrentTicket({ ...ticket, code: "#" + status });
                // handleSelectTicket(ticket);
                setTimeout(() => {
                    history.push('/tickets');
                }, 0);

                setTimeout(() => {
                    history.push(`/tickets/${ticket.uuid}`);
                    setTabOpen(status)
                }, 10);


            } else {
                setCurrentTicket({ id: null, code: null })
                history.push("/tickets");

            }
        } catch (err) {
            setLoading(false);
            toastError(err);
        }
    };

    const handleAcepptTicket = async (id) => {
        setLoading(true);
        try {
            const otherTicket = await api.put(`/tickets/${id}`, {
                status: ticket.isGroup ? "group" : "open",
                userId: user?.id,
            });
            if (otherTicket.data.id !== ticket.id) {
                if (otherTicket.data.userId !== user?.id) {
                    setOpenAlert(true)
                    setUserTicketOpen(otherTicket?.data?.user?.name || "Atendente")
                    setQueueTicketOpen(otherTicket?.data?.queue?.name || "Sem fila")
                    setTabOpen(otherTicket.isGroup ? "group" : "open")
                } else {
                    setLoading(false);
                    // handleSelectTicket(otherTicket.data);
                    setTabOpen(otherTicket.isGroup ? "group" : "open")

                    history.push(`/tickets/${otherTicket.data.uuid}`);
                }
            } else {
                // if (isMounted.current) {
                setLoading(false);
                // }

                // handleSelectTicket(ticket);
                history.push('/tickets');
                setTimeout(() => {
                    history.push(`/tickets/${ticket.uuid}`);
                    setTabOpen(ticket.isGroup ? "group" : "open")
                }, 1000)
            }
        } catch (err) {
            setLoading(false);
            toastError(err);
        }
    };

    return (
        <>
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
            {showTicketLogOpen && (
                <ShowTicketLogModal
                    isOpen={showTicketLogOpen}
                    handleClose={(e) => setShowTicketLogOpen(false)}
                    ticketId={ticket.id}
                />
            )}
            {openTicketMessageDialog && (
                <TicketMessagesDialog
                    open={openTicketMessageDialog}
                    handleClose={() => setOpenTicketMessageDialog(false)}
                    ticketId={ticket.id}
                />
            )}
            {confirmationOpen && (
                <ConfirmationModal
                    title={`${i18n.t("ticketOptionsMenu.confirmationModal.title")} #${ticket.id}?`}
                    open={confirmationOpen}
                    onClose={setConfirmationOpen}
                    onConfirm={handleDeleteTicket}
                >
                    {i18n.t("ticketOptionsMenu.confirmationModal.message")}
                </ConfirmationModal>
            )}
            {transferTicketModalOpen && (
                <TransferTicketModalCustom
                    modalOpen={transferTicketModalOpen}
                    onClose={handleCloseTransferTicketModal}
                    ticketid={ticket.id}
                    ticket={ticket}
                />
            )}
            <div className={classes.actionButtons}>
                {ticket.status === "closed" && (ticket.queueId === null || ticket.queueId === undefined) && (
                    <ButtonWithSpinner
                        loading={loading}
                        startIcon={<Replay />}
                        size="small"
                        onClick={e => handleOpenAcceptTicketWithouSelectQueue()}
                    >
                        {i18n.t("messagesList.header.buttons.reopen")}
                    </ButtonWithSpinner>
                )}
                {(ticket.status === "closed" && ticket.queueId !== null) && (
                    <ButtonWithSpinner
                        startIcon={<Replay />}
                        loading={loading}
                        onClick={e => handleAcepptTicket(ticket.id)}
                    >
                        {i18n.t("messagesList.header.buttons.reopen")}
                    </ButtonWithSpinner>
                )}
                {/* <IconButton
                    className={classes.bottomButtonVisibilityIcon}
                    onClick={handleShowLogTicket}
                >
                    <Tooltip title={i18n.t("messagesList.header.buttons.logTicket")}>
                        <History />

                    </Tooltip>
                </IconButton> */}
                {(ticket.status === "open" || ticket.status === "group") && (
                    <>
                        {/* No mobile os botões ficam no menu MoreVert para manter o header compacto */}
                        {!isMobile && (
                            <>
                                <div className={classes.buttonGroup}>
                                    <Tooltip title={i18n.t("messagesList.header.buttons.resolve")}>
                                        <IconButton
                                            className={classes.iconButtonResolve}
                                            onClick={handleClickOpen}
                                            size="small"
                                        >
                                            <CheckCircleOutline fontSize="small" />
                                        </IconButton>
                                    </Tooltip>

                                    <Tooltip title={i18n.t("tickets.buttons.returnQueue")}>
                                        <IconButton
                                            className={classes.iconButtonReturn}
                                            onClick={(e) => handleUpdateTicketStatus(e, "pending", null)}
                                            size="small"
                                        >
                                            <UndoIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>

                                    <div className={classes.buttonDivider} />

                                    <Tooltip title="Transferir Ticket">
                                        <IconButton
                                            className={classes.iconButtonTransfer}
                                            onClick={handleOpenTransferModal}
                                            size="small"
                                        >
                                            <SwapHorizOutlined fontSize="small" />
                                        </IconButton>
                                    </Tooltip>

                                    <Tooltip title={isSearching ? "Fechar busca" : "Buscar na conversa"}>
                                        <IconButton
                                            className={classes.iconButtonSearch}
                                            onClick={onToggleSearch}
                                            size="small"
                                        >
                                            {isSearching ? <CloseIcon fontSize="small" /> : <SearchIcon fontSize="small" />}
                                        </IconButton>
                                    </Tooltip>
                                </div>

                                <Tooltip title={i18n.t("tickets.buttons.disableFlow")}>
                                    <div className={classes.iosToggleContainer}>
                                        <label className={classes.iosSwitch}>
                                            <input
                                                type="checkbox"
                                                checked={disableBot}
                                                onChange={() => handleContactToggleDisableBot()}
                                            />
                                            <span className={`${classes.iosSlider} ${disableBot ? classes.iosSliderChecked : ''}`} />
                                        </label>
                                    </div>
                                </Tooltip>
                            </>
                        )}
                    </>
                )}
                {ticket.status === "pending" && (ticket.queueId === null || ticket.queueId === undefined) && (
                    <ButtonWithSpinner
                        loading={loading}
                        size="small"
                        variant="contained"
                        className={classes.acceptButton}
                        onClick={e => handleOpenAcceptTicketWithouSelectQueue()}
                    >
                        {i18n.t("messagesList.header.buttons.accept")}
                    </ButtonWithSpinner>
                )}
                {ticket.status === "pending" && ticket.queueId !== null && (
                    <ButtonWithSpinner
                        loading={loading}
                        size="small"
                        variant="contained"
                        className={classes.acceptButton}
                        onClick={e => handleUpdateTicketStatus(e, "open", user?.id)}
                    >
                        {i18n.t("messagesList.header.buttons.accept")}
                    </ButtonWithSpinner>
                )}
                <IconButton
                    aria-label="account of current user"
                    aria-controls="menu-appbar"
                    aria-haspopup="true"
                    onClick={handleMenu}
                    className={classes.iconButton}
                    size="small"
                >
                    <MoreVert fontSize="small" />
                </IconButton>
                <Menu
                    id="menu-appbar"
                    anchorEl={anchorEl}
                    getContentAnchorEl={null}
                    anchorOrigin={{
                        vertical: "bottom",
                        horizontal: "right",
                    }}
                    keepMounted
                    transformOrigin={{
                        vertical: "top",
                        horizontal: "right",
                    }}
                    open={menuOpen}
                    onClose={handleCloseMenu}
                >
                    {/* Ações de atendimento — apenas no mobile (no desktop ficam como botões no header) */}
                    {isMobile && (ticket.status === "open" || ticket.status === "group") && [
                        <MenuItem key="resolve" onClick={() => { handleCloseMenu(); handleClickOpen(); }}>
                            {i18n.t("messagesList.header.buttons.resolve")}
                        </MenuItem>,
                        <MenuItem key="return" onClick={(e) => { handleCloseMenu(); handleUpdateTicketStatus(e, "pending", null); }}>
                            {i18n.t("tickets.buttons.returnQueue")}
                        </MenuItem>,
                        <MenuItem key="transfer" onClick={() => { handleCloseMenu(); handleOpenTransferModal(); }}>
                            Transferir Ticket
                        </MenuItem>,
                        <MenuItem key="search" onClick={() => { handleCloseMenu(); onToggleSearch(); }}>
                            {isSearching ? "Fechar busca" : "Buscar na conversa"}
                        </MenuItem>,
                        <MenuItem key="bot" onClick={() => { handleCloseMenu(); handleContactToggleDisableBot(); }}>
                            {disableBot ? "Habilitar bot" : "Desabilitar bot"}
                        </MenuItem>,
                    ]}
                    {canDeleteTickets && (
                        <MenuItem onClick={handleOpenConfirmationModal}>
                            {i18n.t("tickets.buttons.deleteTicket")}
                        </MenuItem>
                    )}
                    <MenuItem onClick={handleEnableIntegration}>
                        {enableIntegration === true ? i18n.t("messagesList.header.buttons.disableIntegration") : i18n.t("messagesList.header.buttons.enableIntegration")}
                    </MenuItem>
                    <MenuItem onClick={handleShowLogTicket}>
                        {i18n.t("messagesList.header.buttons.logTicket")}
                    </MenuItem>
                    <MenuItem onClick={handleExportPDF}>
                        {i18n.t("ticketsList.buttons.exportAsPDF")}
                    </MenuItem>
                </Menu>
            </div>
            <CloseTicketFarewellDialog
                open={open}
                onClose={handleClose}
                loading={loading}
                onConfirmWithoutFarewell={() => handleCloseTicketWithoutFarewellMsg()}
                onConfirmWithFarewell={e => handleUpdateTicketStatus(e, "closed", user?.id, ticket?.queue?.id)}
            />
        </>
    );
};

export default TicketActionButtonsCustom;
