import React, { useState, useEffect, useReducer, useContext, useMemo, useRef } from "react";

import { makeStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import Paper from "@material-ui/core/Paper";

import TicketListItem from "../TicketListItemCustom";
import TicketsListSkeleton from "../TicketsListSkeleton";

import useTickets from "../../hooks/useTickets";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
    ticketsListWrapper: {
        position: "relative",
        display: "flex",
        height: "100%",
        flexDirection: "column",
        overflow: "hidden",
        boxSizing: "border-box",
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
        backgroundColor: "transparent",
    },

    ticketsList: {
        flex: 1,
        maxHeight: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(1),
        scrollbarGutter: "stable",
        ...theme.scrollbarStyles,
        borderTop: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.15)" : "rgba(148,163,184,0.08)"}`,
    },

    ticketsInnerList: {
        paddingTop: 0,
        paddingLeft: 0,
        paddingRight: 0,
        boxSizing: "border-box",
    },

    noTicketsDiv: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: theme.spacing(5, 3),
        gap: theme.spacing(1),
        textAlign: "center",
    },

    noTicketsTitle: {
        fontSize: "0.9rem",
        fontWeight: 700,
        color: theme.mode === "light" ? "#374151" : "#e2e8f0",
        margin: 0,
        letterSpacing: "-0.01em",
    },

    noTicketsText: {
        fontSize: "0.78rem",
        color: theme.mode === "light" ? "#94a3b8" : "#64748b",
        lineHeight: 1.5,
        margin: 0,
        maxWidth: 200,
    },
}));

const ticketSortAsc = (a, b) => {
    
    if (a.updatedAt < b.updatedAt) {
        return -1;
    }
    if (a.updatedAt > b.updatedAt) {
        return 1;
    }
    return 0;
}

const ticketSortDesc = (a, b) => {
   
    if (a.updatedAt > b.updatedAt) {
        return -1;
    }
    if (a.updatedAt < b.updatedAt) {
        return 1;
    }
    return 0;
}

const reducer = (state, action) => {
    //console.log("action", action, state)
    const sortDir = action.sortDir;
    const maxItems = Number(action.maxItems) > 0 ? Number(action.maxItems) : null;

    const trimToMaxItems = () => {
        if (maxItems && state.length > maxItems) {
            state = state.slice(0, maxItems);
        }
    };
    
    if (action.type === "LOAD_TICKETS") {
        const newTickets = action.payload;

        newTickets.forEach((ticket) => {
            const ticketIndex = state.findIndex((t) => t.id === ticket.id);
            if (ticketIndex !== -1) {
                state[ticketIndex] = ticket;
                if (ticket.unreadMessages > 0) {
                    state.unshift(state.splice(ticketIndex, 1)[0]);
                }
            } else {
                state.push(ticket);
            }
        });
        if (sortDir && ['ASC', 'DESC'].includes(sortDir)) {
            sortDir === 'ASC' ? state.sort(ticketSortAsc) : state.sort(ticketSortDesc);
        }

        trimToMaxItems();
        return [...state];
    }

    if (action.type === "RESET_UNREAD") {
        const ticketId = action.payload;

        const ticketIndex = state.findIndex((t) => t.id === ticketId);
        if (ticketIndex !== -1) {
            state[ticketIndex].unreadMessages = 0;
        }

        if (sortDir && ['ASC', 'DESC'].includes(sortDir)) {
            sortDir === 'ASC' ? state.sort(ticketSortAsc) : state.sort(ticketSortDesc);
        }

        trimToMaxItems();
        return [...state];
    }

    if (action.type === "UPDATE_TICKET") {
        const ticket = action.payload;

        const ticketIndex = state.findIndex((t) => t.id === ticket.id);
        if (ticketIndex !== -1) {
            state[ticketIndex] = ticket;
        } else {
            state.unshift(ticket);
        }
        if (action.forceTop) {
            trimToMaxItems();
            return [...state];
        }

        if (sortDir && ['ASC', 'DESC'].includes(sortDir)) {
            sortDir === 'ASC' ? state.sort(ticketSortAsc) : state.sort(ticketSortDesc);
        }

        trimToMaxItems();
        return [...state];
    }

    if (action.type === "UPDATE_TICKET_UNREAD_MESSAGES") {
        const ticket = action.payload;

        const ticketIndex = state.findIndex((t) => t.id === ticket.id);
        if (ticketIndex !== -1) {
            state[ticketIndex] = ticket;
            state.unshift(state.splice(ticketIndex, 1)[0]);
        } else {
            if (action.status === action.payload.status) {
                state.unshift(ticket);
            }
        }
        if (action.forceTop) {
            trimToMaxItems();
            return [...state];
        }

        if (sortDir && ['ASC', 'DESC'].includes(sortDir)) {
            sortDir === 'ASC' ? state.sort(ticketSortAsc) : state.sort(ticketSortDesc);
        }

        trimToMaxItems();
        return [...state];
    }

    if (action.type === "SET_TICKET_TYPING") {
        const { ticketId, isTyping } = action.payload || {};
        const ticketIndex = state.findIndex((t) => String(t.id) === String(ticketId));
        if (ticketIndex !== -1) {
            state[ticketIndex] = {
                ...state[ticketIndex],
                isTyping: Boolean(isTyping)
            };
        }
        return [...state];
    }

    if (action.type === "UPDATE_TICKET_CONTACT") {
        const contact = action.payload;
        const ticketIndex = state.findIndex((t) => t.contactId === contact.id);
        if (ticketIndex !== -1) {
            state[ticketIndex].contact = contact;
        }
        return [...state];
    }

    if (action.type === "DELETE_TICKET") {
        const ticketId = action.payload;
        const ticketIndex = state.findIndex((t) => t.id === ticketId);
        if (ticketIndex !== -1) {
            state.splice(ticketIndex, 1);
        }

        if (sortDir && ['ASC', 'DESC'].includes(sortDir)) {
            sortDir === 'ASC' ? state.sort(ticketSortAsc) : state.sort(ticketSortDesc);
        }

        trimToMaxItems();
        return [...state];
    }

    if (action.type === "RESET") {
        return [];
    }
};

const TicketsListCustom = (props) => {
    const {
        setTabOpen,
        status,
        searchParam,
        searchOnMessages,
        tags,
        users,
        showAll,
        selectedQueueIds,
        selectedChannels,
        updateCount,
        style,
        whatsappIds,
        forceSearch,
        statusFilter,
        date,
        refreshKey,
        userFilter,
        sortTickets
    } = props;

    const classes = useStyles();
    const [pageNumber, setPageNumber] = useState(1);
    const lastScrollTopRef = useRef(0);
    const typingTimeoutsRef = useRef({});
    let [ticketsList, dispatch] = useReducer(reducer, []);
    //   const socketManager = useContext(SocketContext);
    const { user, socket } = useContext(AuthContext);

    const { profile, queues } = user;
    const showTicketWithoutQueue = user.allTicket === 'enable';
    const companyId = user.companyId;
    const maxItemsForStatus = pageNumber * 40;

    useEffect(() => {
        dispatch({ type: "RESET" });
        setPageNumber(1);
    }, [status, searchParam, dispatch, showAll, tags, users, forceSearch, selectedQueueIds, whatsappIds, statusFilter, sortTickets, searchOnMessages, date, refreshKey]);

    const { tickets, hasMore, loading } = useTickets({
        pageNumber,
        searchParam,
        status,
        showAll,
        searchOnMessages: searchOnMessages ? "true" : "false",
        tags: JSON.stringify(tags),
        users: JSON.stringify(users),
        queueIds: JSON.stringify(selectedQueueIds),
        whatsappIds: JSON.stringify(whatsappIds),
        statusFilter: JSON.stringify(statusFilter),
        date,
        userFilter,
        sortTickets
    });


    useEffect(() => {
        // const queueIds = queues.map((q) => q.id);
        // const filteredTickets = tickets.filter(
        //     (t) => queueIds.indexOf(t.queueId) > -1
        // );
        // const allticket = user.allTicket === 'enabled';
        // if (profile === "admin" || allTicket || allowGroup || allHistoric) {
        if (companyId) {
            dispatch({
                type: "LOAD_TICKETS",
                payload: tickets,
                status,
                sortDir: sortTickets,
                maxItems: maxItemsForStatus
            });
        }
        // } else {
        //  dispatch({ type: "LOAD_TICKETS", payload: filteredTickets });
        // }

    }, [tickets]);

    useEffect(() => {
        const shouldUpdateTicket = ticket => {
            return (!ticket?.userId || ticket?.userId === user?.id || showAll) &&
                ((!ticket?.queueId && showTicketWithoutQueue) || selectedQueueIds.indexOf(ticket?.queueId) > -1)
            // (!blockNonDefaultConnections || (ticket.status == 'group' && ignoreUserConnectionForGroups) || !user?.whatsappId || ticket.whatsappId == user?.whatsappId);
        }

        // A aba "ia" não é um status real do ticket: mostra tickets em qualquer
        // status (pending/open) enquanto a IA estiver conduzindo o atendimento.
        const matchesStatus = ticket =>
            status === "ia"
                ? Boolean(ticket?.useIntegration || ticket?.isBot)
                : ticket?.status === status;
        // const shouldUpdateTicketUser = (ticket) =>
        //     selectedQueueIds.indexOf(ticket?.queueId) > -1 && (ticket?.userId === user?.id || !ticket?.userId);

        const notBelongsToUserQueues = (ticket) =>
            ticket.queueId && selectedQueueIds.indexOf(ticket.queueId) === -1;

        const onCompanyTicketTicketsList = (data) => {
            // console.log("onCompanyTicketTicketsList", data)
            if (data.action === "updateUnread") {
                dispatch({
                    type: "RESET_UNREAD",
                    payload: data.ticketId,
                    status: status,
                    sortDir: sortTickets,
                    maxItems: maxItemsForStatus
                });
            }
            // console.log(shouldUpdateTicket(data.ticket))
            if (data.action === "update" &&
                shouldUpdateTicket(data.ticket) && matchesStatus(data.ticket)) {
                dispatch({
                    type: "UPDATE_TICKET",
                    payload: data.ticket,
                    status: status,
                    sortDir: sortTickets,
                    maxItems: maxItemsForStatus
                });
            }

            // else if (data.action === "update" && shouldUpdateTicketUser(data.ticket) && data.ticket.status === status) {
            //     dispatch({
            //         type: "UPDATE_TICKET",
            //         payload: data.ticket,
            //     });
            // }
            if (data.action === "update" && notBelongsToUserQueues(data.ticket)) {
                dispatch({
                    type: "DELETE_TICKET", payload: data.ticket?.id, status: status,
                    sortDir: sortTickets,
                    maxItems: maxItemsForStatus
                });
            }

            if (data.action === "delete") {
                dispatch({
                    type: "DELETE_TICKET", payload: data?.ticketId, status: status,
                    sortDir: sortTickets,
                    maxItems: maxItemsForStatus
                });

            }
        };

        const onCompanyAppMessageTicketsList = (data) => {
            if (data.action === "create" &&
                shouldUpdateTicket(data.ticket) && matchesStatus(data.ticket)) {
                dispatch({
                    type: "UPDATE_TICKET_UNREAD_MESSAGES",
                    payload: data.ticket,
                    status: status,
                    sortDir: sortTickets,
                    maxItems: maxItemsForStatus,
                    forceTop: true
                });
                dispatch({
                    type: "SET_TICKET_TYPING",
                    payload: { ticketId: data.ticket?.id, isTyping: false }
                });
            }
            // else if (data.action === "create" && shouldUpdateTicketUser(data.ticket) && data.ticket.status === status) {
            //     dispatch({
            //         type: "UPDATE_TICKET_UNREAD_MESSAGES",
            //         payload: data.ticket,
            //     });
            // }
        };

        const onCompanyTypingTicketsList = (data) => {
            const eventTicketId = data?.ticketId;
            const isTyping = Boolean(data?.isTyping);
            if (!eventTicketId) return;
            if (String(data?.userId || "") === String(user?.id || "")) return;

            const timeoutKey = String(eventTicketId);
            if (typingTimeoutsRef.current[timeoutKey]) {
                clearTimeout(typingTimeoutsRef.current[timeoutKey]);
                delete typingTimeoutsRef.current[timeoutKey];
            }

            dispatch({
                type: "SET_TICKET_TYPING",
                payload: { ticketId: eventTicketId, isTyping }
            });

            if (isTyping) {
                typingTimeoutsRef.current[timeoutKey] = setTimeout(() => {
                    dispatch({
                        type: "SET_TICKET_TYPING",
                        payload: { ticketId: eventTicketId, isTyping: false }
                    });
                    delete typingTimeoutsRef.current[timeoutKey];
                }, 6500);
            }
        };

        const onCompanyContactTicketsList = (data) => {
            if (data.action === "update" && data.contact) {
                dispatch({
                    type: "UPDATE_TICKET_CONTACT",
                    payload: data.contact,
                    status: status,
                    sortDir: sortTickets,
                    maxItems: maxItemsForStatus
                });
            }
        };

        const onConnectTicketsList = () => {
            if (status) {
                socket.emit("joinTickets", status);
            } else {
                socket.emit("joinNotification");
            }
        }

        socket.on("connect", onConnectTicketsList)
        socket.on(`company-${companyId}-ticket`, onCompanyTicketTicketsList);
        socket.on(`company-${companyId}-appMessage`, onCompanyAppMessageTicketsList);
        socket.on(`company-${companyId}-contact`, onCompanyContactTicketsList);
        socket.on(`company-${companyId}-typing`, onCompanyTypingTicketsList);
        onConnectTicketsList();

        return () => {
            if (status) {
                socket.emit("leaveTickets", status);
            } else {
                socket.emit("leaveNotification");
            }
            socket.off("connect", onConnectTicketsList);
            socket.off(`company-${companyId}-ticket`, onCompanyTicketTicketsList);
            socket.off(`company-${companyId}-appMessage`, onCompanyAppMessageTicketsList);
            socket.off(`company-${companyId}-contact`, onCompanyContactTicketsList);
            socket.off(`company-${companyId}-typing`, onCompanyTypingTicketsList);
            Object.keys(typingTimeoutsRef.current).forEach((key) => {
                clearTimeout(typingTimeoutsRef.current[key]);
                delete typingTimeoutsRef.current[key];
            });
        };

    }, [status, showAll, user, selectedQueueIds, tags, users, profile, queues, sortTickets, showTicketWithoutQueue, pageNumber]);

    useEffect(() => {
        if (typeof updateCount === "function") {
            updateCount(ticketsList.length);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ticketsList]);

    const loadMore = () => {
        setPageNumber((prevState) => prevState + 1);
    };

    const handleScroll = (e) => {
        if (!hasMore || loading) return;

        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

        // Evita auto-paginação em cascata quando a lista ainda não tem overflow real.
        if (scrollHeight <= clientHeight + 2) return;

        // Só pagina quando o usuário estiver rolando para baixo.
        if (scrollTop <= lastScrollTopRef.current) {
            lastScrollTopRef.current = scrollTop;
            return;
        }

        lastScrollTopRef.current = scrollTop;

        if (scrollHeight - (scrollTop + clientHeight) <= 100) {
            loadMore();
        }
    };

    if (status === "ia") {
        ticketsList = ticketsList.filter(ticket => ticket.useIntegration || ticket.isBot)
    } else if (status && status !== "search") {
        ticketsList = ticketsList.filter(ticket => ticket.status === status)
    }

    if (Array.isArray(selectedChannels) && selectedChannels.length > 0) {
        ticketsList = ticketsList.filter((ticket) => {
            const channel = String(ticket.channel || "").toLowerCase();
            return selectedChannels.some((selected) =>
                selected === "whatsapp" ? channel.startsWith("whatsapp") : channel === selected
            );
        });
    }

    return (
        <Paper elevation={0} className={classes.ticketsListWrapper} style={style}>
            <Paper
                elevation={0}
                className={classes.ticketsList}
                onScroll={handleScroll}
            >
                <List className={classes.ticketsInnerList}>
                    {ticketsList.length === 0 && !loading ? (
                        <div className={classes.noTicketsDiv}>
                            <span className={classes.noTicketsTitle}>
                                {i18n.t("ticketsList.noTicketsTitle")}
                            </span>
                            <p className={classes.noTicketsText}>
                                {i18n.t("ticketsList.noTicketsMessage")}
                            </p>
                        </div>
                    ) : (
                        <>
                            {ticketsList.map((ticket) => (
                                <TicketListItem
                                    ticket={ticket}
                                    key={ticket.id}
                                    setTabOpen={setTabOpen}
                                />
                            ))}
                        </>
                    )}
                    {loading && <TicketsListSkeleton />}
                </List>
            </Paper>
        </Paper>
    );
};

export default React.memo(TicketsListCustom);
