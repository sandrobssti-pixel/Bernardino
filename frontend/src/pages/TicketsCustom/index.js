import React, { useState, useCallback, useContext, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import Paper from "@material-ui/core/Paper";
import Hidden from "@material-ui/core/Hidden";
import { makeStyles } from "@material-ui/core/styles";
import TicketsManager from "../../components/TicketsManagerTabs";
import Ticket from "../../components/Ticket";

import { QueueSelectedProvider } from "../../context/QueuesSelected/QueuesSelectedContext";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";

const defaultTicketsManagerWidth = 550;
const minTicketsManagerWidth = 404;
const maxTicketsManagerWidth = 700;

const useStyles = makeStyles((theme) => ({
	chatContainer: {
		flex: 1,
		padding: theme.spacing(1.2),
		height: `calc(100% - 54px)`,
		overflowY: "hidden",
		background:
			theme.mode === "light"
				? "linear-gradient(155deg, #f5f9ff 0%, #eef4ff 48%, #f7fbff 100%)"
				: "linear-gradient(155deg, #0f172a 0%, #111827 50%, #1f2937 100%)",
	},
	chatPapper: {
		display: "flex",
		height: "100%",
	},
	contactsWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
		overflow: "hidden",
		position: "relative",
		flex: "0 0 auto",
		borderRadius: 18,
		backgroundColor:
			theme.mode === "light" ? "rgba(255,255,255,0.94)" : "rgba(17,24,39,0.92)",
		backdropFilter: "blur(8px)",
		boxShadow:
			theme.mode === "light"
				? "0 16px 35px rgba(15, 23, 42, 0.11)"
				: "0 16px 35px rgba(0, 0, 0, 0.42)",
	},
	messagesWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
		flexGrow: 1,
		borderRadius: 18,
		overflow: "hidden",
		backgroundColor:
			theme.mode === "light" ? "rgba(255,255,255,0.86)" : "rgba(15,23,42,0.92)",
		boxShadow:
			theme.mode === "light"
				? "0 16px 35px rgba(15, 23, 42, 0.11)"
				: "0 16px 35px rgba(0, 0, 0, 0.42)",
	},
	welcomeMsg: {
		background:
			theme.mode === "light"
				? "linear-gradient(145deg, #f8fafc 0%, #f1f5f9 50%, #f8fafc 100%)"
				: "linear-gradient(145deg, rgba(15,23,42,0.98) 0%, rgba(17,24,39,0.95) 50%, rgba(15,23,42,0.98) 100%)",
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
		height: "100%",
		textAlign: "center",
		borderRadius: 14,
		border: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.12)"}`,
		margin: theme.spacing(1),
		boxShadow:
			theme.mode === "light"
				? "0 8px 24px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255,255,255,0.8)"
				: "0 8px 24px rgba(0, 0, 0, 0.3)",
		color: theme.palette.text.primary,
	},
	welcomeInner: {
		maxWidth: 380,
		padding: theme.spacing(4),
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		gap: theme.spacing(1.5),
	},
	welcomeLogoWrap: {
		display: "flex",
		justifyContent: "center",
		marginBottom: theme.spacing(0.5),
	},
	welcomeTitle: {
		fontSize: "1.05rem",
		fontWeight: 700,
		letterSpacing: "-0.01em",
		color: theme.mode === "light" ? "#0f172a" : "#f1f5f9",
	},
	welcomeText: {
		fontSize: "0.83rem",
		lineHeight: 1.55,
		color: theme.mode === "light" ? "#64748b" : "#94a3b8",
		maxWidth: 280,
	},
	dragger: {
		flex: "0 0 auto",
		width: theme.spacing(1.5),
		height: "100%",
		cursor: "ew-resize",
		zIndex: 100,
		position: "relative",
		userSelect: "none", // Evita a seleção de texto no elemento de redimensionamento
		"&::after": {
			content: '""',
			position: "absolute",
			top: "50%",
			left: "50%",
			transform: "translate(-50%, -50%)",
			width: 3,
			height: "36px",
			borderRadius: 3,
			background:
				theme.mode === "light"
					? "rgba(148,163,184,0.55)"
					: "rgba(148,163,184,0.35)",
			transition: "background-color 0.15s ease, height 0.15s ease",
		},
		"&:hover::after": {
			background:
				theme.mode === "light"
					? "rgba(100,116,139,0.75)"
					: "rgba(148,163,184,0.6)",
			height: "56px",
		},
	},
	logo: {
		logo: theme.logo,
		content: "url(" + (theme.mode === "light" ? theme.calculatedLogoLight() : theme.calculatedLogoDark()) + ")",
		opacity: 0.92,
		filter: theme.mode === "light" ? "none" : "brightness(1.12)",
		maxWidth: 300,
	},
}));

const TicketsCustom = () => {
	const { user } = useContext(AuthContext);
	const initialTicketsManagerWidth = user?.defaultTicketsManagerWidth || defaultTicketsManagerWidth;

	const classes = useStyles({ ticketsManagerWidth: initialTicketsManagerWidth });

	const { ticketId } = useParams();

	const [ticketsManagerWidth, setTicketsManagerWidth] = useState(initialTicketsManagerWidth);
	const ticketsManagerWidthRef = useRef(ticketsManagerWidth);
	const contactsWrapperRef = useRef(null);
	const isDraggingRef = useRef(false);
	const dragStartXRef = useRef(0);
	const dragStartWidthRef = useRef(initialTicketsManagerWidth);
	const pendingWidthRef = useRef(initialTicketsManagerWidth);
	const savedWidthRef = useRef(initialTicketsManagerWidth);
	const rafIdRef = useRef(null);

	useEffect(() => {
		const nextWidth = user?.defaultTicketsManagerWidth || defaultTicketsManagerWidth;
		if (!isDraggingRef.current) {
			setTicketsManagerWidth(nextWidth);
			ticketsManagerWidthRef.current = nextWidth;
			dragStartWidthRef.current = nextWidth;
			pendingWidthRef.current = nextWidth;
			savedWidthRef.current = nextWidth;
		}
	}, [user?.defaultTicketsManagerWidth]);

	// useEffect(() => {
	// 	if (ticketId && currentTicket.uuid === undefined) {
	// 		history.push("/tickets");
	// 	}
	// }, [ticketId, currentTicket.uuid, history]);

	const clampWidth = useCallback((value) => {
		return Math.min(maxTicketsManagerWidth, Math.max(minTicketsManagerWidth, value));
	}, []);

	const applyWidth = useCallback((value) => {
		const nextWidth = clampWidth(value);
		pendingWidthRef.current = nextWidth;
		if (rafIdRef.current !== null) return;

		rafIdRef.current = window.requestAnimationFrame(() => {
			rafIdRef.current = null;
			const width = pendingWidthRef.current;
			ticketsManagerWidthRef.current = width;
			setTicketsManagerWidth((currentWidth) => (currentWidth === width ? currentWidth : width));
		});
	}, [clampWidth]);

	const handleSaveContact = useCallback(async (value) => {
		if (!user?.id) return;
		const safeValue = clampWidth(value);
		await api.put(`/users/toggleChangeWidht/${user.id}`, { defaultTicketsManagerWidth: safeValue });
		savedWidthRef.current = safeValue;
	}, [clampWidth, user?.id]);

	const handleMouseMove = useCallback(
		(e) => {
			if (!isDraggingRef.current) return;
			const delta = e.clientX - dragStartXRef.current;
			const newWidth = dragStartWidthRef.current + delta;
			applyWidth(newWidth);
		},
		[applyWidth]
	);

	const handleMouseUp = useCallback(async () => {
		if (!isDraggingRef.current) return;
		isDraggingRef.current = false;
		document.removeEventListener("mouseup", handleMouseUp, true);
		document.removeEventListener("mousemove", handleMouseMove, true);
		document.body.style.userSelect = "";
		document.body.style.cursor = "";

		if (rafIdRef.current !== null) {
			window.cancelAnimationFrame(rafIdRef.current);
			rafIdRef.current = null;
		}
		ticketsManagerWidthRef.current = pendingWidthRef.current;
		setTicketsManagerWidth(pendingWidthRef.current);

		const newWidth = ticketsManagerWidthRef.current;
		if (newWidth !== savedWidthRef.current) {
			await handleSaveContact(newWidth);
		}
	}, [handleMouseMove, handleSaveContact]);

	const stopDragging = useCallback(() => {
		if (!isDraggingRef.current) return;
		isDraggingRef.current = false;
		document.removeEventListener("mouseup", handleMouseUp, true);
		document.removeEventListener("mousemove", handleMouseMove, true);
		document.body.style.userSelect = "";
		document.body.style.cursor = "";

		if (rafIdRef.current !== null) {
			window.cancelAnimationFrame(rafIdRef.current);
			rafIdRef.current = null;
		}
		ticketsManagerWidthRef.current = pendingWidthRef.current;
		setTicketsManagerWidth(pendingWidthRef.current);
	}, [handleMouseMove, handleMouseUp]);

	useEffect(() => {
		return () => {
			stopDragging();
		};
	}, [stopDragging]);

	const handleMouseDown = (e) => {
		e.preventDefault();
		if (!contactsWrapperRef.current) return;

		isDraggingRef.current = true;
		dragStartXRef.current = e.clientX;
		dragStartWidthRef.current = ticketsManagerWidthRef.current || initialTicketsManagerWidth;
		pendingWidthRef.current = dragStartWidthRef.current;
		document.body.style.userSelect = "none";
		document.body.style.cursor = "col-resize";
		document.addEventListener("mouseup", handleMouseUp, true);
		document.addEventListener("mousemove", handleMouseMove, true);
	};

	return (
		<QueueSelectedProvider>
			<div className={classes.chatContainer}>
				<div className={classes.chatPapper}>
					<div
						className={classes.contactsWrapper}
						ref={contactsWrapperRef}
						style={{ width: ticketsManagerWidth }}
					>
						<TicketsManager />
					</div>
					<div onMouseDown={handleMouseDown} className={classes.dragger} role="separator" aria-orientation="vertical" />
					<div className={classes.messagesWrapper}>
						{ticketId ? (
							<>
								{/* <Suspense fallback={<CircularProgress />}> */}
								<Ticket />
								{/* </Suspense> */}
							</>
						) : (
							<Hidden only={["sm", "xs"]}>
								<Paper variant="outlined" className={classes.welcomeMsg}>
									<div className={classes.welcomeInner}>
										<div className={classes.welcomeLogoWrap}>
											<img className={classes.logo} width="90%" alt="" />
										</div>
										<div className={classes.welcomeTitle}>Central de Atendimentos</div>
										<div className={classes.welcomeText}>{i18n.t("chat.noTicketMessage")}</div>
									</div>
								</Paper>
							</Hidden>
						)}
					</div>
				</div>
			</div>
		</QueueSelectedProvider>
	);
};

export default TicketsCustom;
