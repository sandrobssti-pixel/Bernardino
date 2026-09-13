import React, { useState, useRef, useEffect, useContext, useMemo } from "react";
import { useTheme } from "@material-ui/core/styles";

import { useHistory } from "react-router-dom";
import { format } from "date-fns";
// import { SocketContext } from "../../context/Socket/SocketContext";

import Popover from "@material-ui/core/Popover";
import IconButton from "@material-ui/core/IconButton";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import { makeStyles } from "@material-ui/core/styles";
import Badge from "@material-ui/core/Badge";
import Tooltip from "@material-ui/core/Tooltip";
import ChatIcon from "@material-ui/icons/Chat";
import NotificationsIcon from "@material-ui/icons/Notifications";

import TicketListItem from "../TicketListItem";
import useTickets from "../../hooks/useTickets";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import api from "../../services/api";
import Favicon from "react-favicon";
import { getBackendUrl } from "../../config";
import defaultLogoFavicon from "../../assets/favicon.ico";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import { SOUND_MAP } from "../../utils/notificationSounds";

const useStyles = makeStyles(theme => ({
	tabContainer: {
		overflowY: "auto",
		maxHeight: 380,
		...theme.scrollbarStyles,
	},
	popoverPaper: {
		width: "100%",
		maxWidth: 360,
		marginLeft: theme.spacing(2),
		marginRight: theme.spacing(1),
		borderRadius: 12,
		overflow: "hidden",
		border:
			theme.mode === "light"
				? "1px solid rgba(0, 0, 0, 0.08)"
				: "1px solid rgba(148, 163, 184, 0.1)",
		boxShadow:
			theme.mode === "light"
				? "0 4px 6px -2px rgba(0,0,0,0.04), 0 16px 40px -6px rgba(0,0,0,0.12)"
				: "0 4px 8px -2px rgba(0,0,0,0.35), 0 16px 40px -6px rgba(0,0,0,0.55)",
		background:
			theme.mode === "light"
				? "#ffffff"
				: "#1a2234",
		[theme.breakpoints.down("sm")]: {
			maxWidth: 290,
		},
	},
	emptyItem: {
		padding: "20px 16px",
		color:
			theme.mode === "light"
				? "rgba(0,0,0,0.45)"
				: "rgba(226,232,240,0.4)",
		fontSize: 13,
		textAlign: "center",
	},
	noShadow: {
		boxShadow: "none !important",
	},
}));

const getNotificationApi = () => {
	if (typeof window === "undefined") return undefined;
	return window.Notification;
};

const getNotificationPermission = () => {
	const NotificationApi = getNotificationApi();
	return NotificationApi?.permission || "unsupported";
};

const NotificationsPopOver = ({ volume, notificationSound, notificationMuted, notificationGroupMuted }) => {
	const classes = useStyles();
	const theme = useTheme();

	const history = useHistory();
	// const socketManager = useContext(SocketContext);
	const { user, socket } = useContext(AuthContext);
	const { profile, queues } = user;

	const ticketIdUrl = +history.location.pathname.split("/")[2];
	const ticketIdRef = useRef(ticketIdUrl);
	const anchorEl = useRef();
	const [isOpen, setIsOpen] = useState(false);
	const [notifications, setNotifications] = useState([]);
	const queueIds = useMemo(() => queues.map((q) => q.id), [queues]);
	const { get: getSetting } = useCompanySettings();
    const { setCurrentTicket, setTabOpen } = useContext(TicketsContext);

	const [showTicketWithoutQueue, setShowTicketWithoutQueue] = useState(false);
	const [showNotificationPending, setShowNotificationPending] = useState(false);
	const [showGroupNotification, setShowGroupNotification] = useState(false);

	const [, setDesktopNotifications] = useState([]);

	const canAccessTicketByQueue = (ticket) => {
		if (!ticket) return false;
		if (String(profile).toLowerCase() === "admin") return true;
		if (!ticket.queueId) return showTicketWithoutQueue === true;
		return queueIds.some((id) => String(id) === String(ticket.queueId));
	};

	const canAccessTicketByUser = (ticket) => {
		if (!ticket) return false;
		if (String(profile).toLowerCase() === "admin") return true;
		if (String(user?.allUserChat).toLowerCase() === "enabled") return true;
		return ticket.userId === user?.id || !ticket.userId;
	};

	const canAccessTicket = (ticket) =>
		canAccessTicketByQueue(ticket) && canAccessTicketByUser(ticket);

	const { tickets } = useTickets({
		withUnreadMessages: "true",
		queueIds: JSON.stringify(queueIds)
	});

	const selectedSound = SOUND_MAP[notificationSound] || SOUND_MAP.classic;
	const soundAlertRef = useRef();
	const normalizedVolume = Number.isFinite(Number(volume))
		? Math.min(1, Math.max(0, Number(volume)))
		: 1;

	const historyRef = useRef(history);
	const syncingPushRef = useRef(false);

	const requestNotificationPermissionSafe = () => {
		const NotificationApi = getNotificationApi();
		if (!NotificationApi) return Promise.resolve("default");

		return new Promise((resolve) => {
			let resolved = false;
			const finalize = (permission) => {
				if (resolved) return;
				resolved = true;
				resolve(permission || NotificationApi.permission || "default");
			};

			try {
				const maybePromise = NotificationApi.requestPermission((permission) => finalize(permission));
				if (maybePromise && typeof maybePromise.then === "function") {
					maybePromise
						.then((permission) => finalize(permission))
						.catch(() => finalize(NotificationApi.permission));
				} else {
					setTimeout(() => finalize(NotificationApi.permission), 600);
				}
			} catch (_) {
				finalize(NotificationApi.permission);
			}
		});
	};

	const urlBase64ToUint8Array = (base64String) => {
		const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
		const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
		const rawData = window.atob(base64);
		const outputArray = new Uint8Array(rawData.length);
		for (let i = 0; i < rawData.length; i += 1) {
			outputArray[i] = rawData.charCodeAt(i);
		}
		return outputArray;
	};

	const ensurePushSubscription = async () => {
		if (syncingPushRef.current) return;
		if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
		if (getNotificationPermission() !== "granted") return;

		try {
			syncingPushRef.current = true;
			const { data } = await api.get("/push/public-key");
			const publicKey = data?.publicKey;
			if (!publicKey) return;

			const registration = await navigator.serviceWorker.ready;
			let subscription = await registration.pushManager.getSubscription();

			if (!subscription) {
				subscription = await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: urlBase64ToUint8Array(publicKey),
				});
			}

			if (subscription) {
				await api.post("/push/subscriptions", {
					subscription: subscription.toJSON(),
				});
			}
		} catch (err) {
			console.warn("Falha ao sincronizar inscrição de push:", err);
		} finally {
			syncingPushRef.current = false;
		}
	};

	useEffect(() => {
		const fetchSettings = async () => {
			try {
				const setting = await getSetting(
					{
						"column": "showNotificationPending"
					}
				);



				if (setting.showNotificationPending === true) {
					setShowNotificationPending(true);
				}

				if (user.allTicket === "enable") {
					setShowTicketWithoutQueue(true);
				}
				if (user.allowGroup === true) {
					setShowGroupNotification(true);
				}
			} catch (err) {
				toastError(err);
			}
		}

		fetchSettings();
	}, [setShowTicketWithoutQueue, setShowNotificationPending]);

	useEffect(() => {
		const permission = getNotificationPermission();
		if (permission === "unsupported") {
			console.log("This browser doesn't support notifications");
		} else if (permission === "default") {
			const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || "");
			const isStandalone = window.navigator.standalone === true;
			if (!(isIOS && isStandalone)) {
				requestNotificationPermissionSafe();
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (user?.id && getNotificationPermission() === "granted") {
			ensurePushSubscription();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user?.id]);

	useEffect(() => {
		const alertAudio = new Audio(selectedSound);
		alertAudio.preload = "auto";
		alertAudio.volume = notificationMuted ? 0 : normalizedVolume;
		soundAlertRef.current = alertAudio;

		return () => {
			alertAudio.pause();
		};
	}, [selectedSound, normalizedVolume, notificationMuted]);

	useEffect(() => {
		const processNotifications = () => {
			setNotifications(tickets.filter(canAccessTicket));
		}

		processNotifications();
	}, [tickets, showTicketWithoutQueue, queueIds, profile, user?.id, user?.allUserChat]);

	useEffect(() => {
		ticketIdRef.current = ticketIdUrl;
	}, [ticketIdUrl]);

	useEffect(() => {
		const companyId = user.companyId;
		// const socket = socketManager.GetSocket();
		if (user.id) {
			const queueIds = queues.map((q) => q.id);

			const onConnectNotificationsPopover = () => {
				socket.emit("joinNotification");
			}

			if (socket.connected) {
				socket.emit("joinNotification");
			}

			const onCompanyTicketNotificationsPopover = (data) => {
				if (data.action === "updateUnread" || data.action === "delete") {
					setNotifications(prevState => {
						const ticketIndex = prevState.findIndex(t => t.id === data.ticketId);
						if (ticketIndex !== -1) {
							return prevState.filter(t => t.id !== data.ticketId);
						}
						return prevState;
					});

					setDesktopNotifications(prevState => {
						const notfiticationIndex = prevState.findIndex(
							n => n.tag === String(data.ticketId)
						);
						if (notfiticationIndex !== -1) {
							prevState[notfiticationIndex].close();
							return prevState.filter((_, i) => i !== notfiticationIndex);
						}
						return prevState;
					});
				}
			};

			const onCompanyAppMessageNotificationsPopover = (data) => {
				// if (
				// 	data.action === "create" && !data.message.fromMe &&
				// 	(
				// 		data.ticket.status !== 'pending' &&
				// 		data.ticket.status !== "lgpd" &&
				// 		data.ticket.status !== "nps"						
				// 	) &&
				// 	(!data.message.read || (data.ticket.status === "pending" && showTicketWithoutQueue && data.ticket.queueId === null) || (data.ticket.status === "pending" && !showTicketWithoutQueue && user?.queues?.some(queue => (queue.id === data.ticket.queueId)))) &&
				// 	(data.ticket.userId === user?.id || !data.ticket.userId)
				// ) {
				// 
				
					if (
						data.action === "create" && !data.message.fromMe &&
						canAccessTicket(data.ticket) &&
						(!["lgpd", "nps", "group"].includes(data.ticket?.status) ||
							(data.ticket?.status === "group" && showGroupNotification === true))
					) {
					const isGroupMuted = data.ticket.isGroup && notificationGroupMuted;

					if (!isGroupMuted) {
						setNotifications(prevState => {
							const ticketIndex = prevState.findIndex(t => t.id === data.ticket.id);
							if (ticketIndex !== -1) {
								const updated = [...prevState];
								updated[ticketIndex] = data.ticket;
								return updated;
							}
							return [data.ticket, ...prevState];
						});
					}

					const shouldNotNotificate =
						isGroupMuted ||
						(data.message.ticketId === ticketIdRef.current &&
							document.visibilityState === "visible") ||
						(data.ticket.userId && data.ticket.userId !== user?.id) ||
						(data.ticket.isGroup && data.ticket?.whatsapp?.groupAsTicket === "disabled" && showGroupNotification === false);

						const isMutedForThisMessage = data.ticket.isGroup
								? notificationGroupMuted
								: notificationMuted;

						if (!isMutedForThisMessage && soundAlertRef.current) {
							soundAlertRef.current.volume = normalizedVolume;
							soundAlertRef.current.currentTime = 0;
							soundAlertRef.current.play().catch((err) => {
								console.warn("Falha ao reproduzir som de notificação:", err);
							});
						}

						if (shouldNotNotificate === true) return;

							handleNotifications(data);
						}
					}

			socket.on("connect", onConnectNotificationsPopover);
			socket.on(`company-${companyId}-ticket`, onCompanyTicketNotificationsPopover);
			socket.on(`company-${companyId}-appMessage`, onCompanyAppMessageNotificationsPopover);
			onConnectNotificationsPopover();

			return () => {
				socket.emit("leaveNotification");
				socket.off("connect", onConnectNotificationsPopover);
				socket.off(`company-${companyId}-ticket`, onCompanyTicketNotificationsPopover);
				socket.off(`company-${companyId}-appMessage`, onCompanyAppMessageNotificationsPopover);
			};
		}
	}, [user, profile, queues, showTicketWithoutQueue, socket, showNotificationPending, showGroupNotification, notificationMuted, notificationGroupMuted, normalizedVolume]);

	const handleNotifications = data => {
		const { message, contact, ticket } = data;

		const NotificationApi = getNotificationApi();
		if (!NotificationApi || NotificationApi.permission !== "granted") {
			return;
		}

		const options = {
			body: `${message.body} - ${format(new Date(), "HH:mm")}`,
			icon: contact.urlPicture,
			tag: ticket.id,
			renotify: true,
		};
		let browserNotification;
		try {
			browserNotification = new NotificationApi(
				`${i18n.t("tickets.notification.message")} ${contact.name}`,
				options
			);
		} catch (err) {
			console.warn("Falha ao criar notificação do navegador:", err);
			return;
		}

		browserNotification.onclick = e => {
			e.preventDefault();
			window.focus();
			setTabOpen(ticket.status)
			historyRef.current.push(`/tickets/${ticket.uuid}`);
			// handleChangeTab(null, ticket.isGroup? "group" : "open");
		};

		setDesktopNotifications(prevState => {
			const notfiticationIndex = prevState.findIndex(
				n => n.tag === browserNotification.tag
			);
			if (notfiticationIndex !== -1) {
				const updated = [...prevState];
				updated[notfiticationIndex] = browserNotification;
				return updated;
			}
			return [browserNotification, ...prevState];
		});
	};

	const handleClick = () => {
		setIsOpen(prevState => !prevState);
	};

	const handleEnableNotifications = () => {
		const permission = getNotificationPermission();
		if (permission === "unsupported") {
			return;
		}

		if (permission === "default") {
			requestNotificationPermissionSafe()
				.then((permission) => {
					if (permission === "granted") {
						ensurePushSubscription();
					}
				})
				.catch(() => {});
			return;
		}

		if (permission === "granted") {
			ensurePushSubscription();
		}
	};

	const handleClickAway = () => {
		setIsOpen(false);
	};

	const NotificationTicket = ({ children }) => {
		return <div onClick={handleClickAway}>{children}</div>;
	};

	const browserNotification = () => {
		const numbers = "⓿➊➋➌➍➎➏➐➑➒➓⓫⓬⓭⓮⓯⓰⓱⓲⓳⓴";
		if (notifications.length > 0) {
			if (notifications.length < 21) {
				document.title = numbers.substring(notifications.length, notifications.length + 1) + " - " + (theme.appName || "...");
			} else {
				document.title = "(" + notifications.length + ")" + (theme.appName || "...");
			}
		} else {
			document.title = theme.appName || "...";
		}
		return (
			<>
				<Favicon
					animated={true}
					url={(theme?.appLogoFavicon) ? theme.appLogoFavicon : defaultLogoFavicon}
					alertCount={notifications.length}
					iconSize={195}
				/>
			</>
		);
	};

	return (
		<>
			{browserNotification()}

			<Tooltip
				title={
					getNotificationPermission() === "unsupported"
						? "Notificações não suportadas"
						: getNotificationPermission() === "granted"
							? "Notificações ativadas"
							: getNotificationPermission() === "denied"
								? "Notificações bloqueadas no navegador"
								: "Ativar notificações"
				}
			>
				<IconButton
					onClick={handleEnableNotifications}
					aria-label="Enable Push Notifications"
					color="inherit"
					style={{ color: "white" }}
				>
					<NotificationsIcon />
				</IconButton>
			</Tooltip>

			<Tooltip title="Mensagens e alertas">
				<IconButton
					onClick={handleClick}
					ref={anchorEl}
					aria-label="Open Notifications"
					color="inherit"
					style={{ color: "white" }}
				>
					<Badge overlap="rectangular" badgeContent={notifications.length} color="secondary">
						<ChatIcon />
					</Badge>
				</IconButton>
			</Tooltip>
			<Popover
				disableScrollLock
				open={isOpen}
				anchorEl={anchorEl.current}
				anchorOrigin={{
					vertical: "bottom",
					horizontal: "right",
				}}
				transformOrigin={{
					vertical: "top",
					horizontal: "right",
				}}
				classes={{ paper: classes.popoverPaper }}
				onClose={handleClickAway}
			>
				<List dense className={classes.tabContainer}>
					{notifications.length === 0 ? (
						<ListItem className={classes.emptyItem}>
							<ListItemText>{i18n.t("notifications.noTickets")}</ListItemText>
						</ListItem>
					) : (
						notifications.map(ticket => (
							<NotificationTicket key={ticket.id}>
								<TicketListItem ticket={ticket} />
							</NotificationTicket>
						))
					)}
				</List>
			</Popover>
		</>
	);
};

export default NotificationsPopOver;
