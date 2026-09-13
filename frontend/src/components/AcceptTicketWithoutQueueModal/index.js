import React, { useState, useContext, useEffect, useRef } from "react";
import { useHistory } from "react-router-dom";

import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    makeStyles,
    MenuItem,
    Select,
    Typography
 } from "@material-ui/core";

import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import ButtonWithSpinner from "../ButtonWithSpinner";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import ShowTicketOpen from "../ShowTicketOpenModal";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import { TicketsContext } from "../../context/Tickets/TicketsContext";

// const filter = createFilterOptions({
// 	trim: true,
// });

const useStyles = makeStyles((theme) => ({
	autoComplete: { 
		width: 300,
		// marginBottom: 20 
	},
	maxWidth: {
		width: "100%",
	},
	buttonColorError: {
		color: theme.palette.error.main,
		borderColor: theme.palette.error.main,
	},
	alertText: {
		marginTop: theme.spacing(1.25),
		color: theme.palette.error.main,
		fontWeight: 600,
	},
}));

const AcceptTicketWithouSelectQueue = ({ modalOpen, onClose, ticketId, ticket }) => {
	const history = useHistory();
	const classes = useStyles();
	const [selectedQueue, setSelectedQueue] = useState('');
	const [loading, setLoading] = useState(false);
	const { user } = useContext(AuthContext);
	const [ openAlert, setOpenAlert ] = useState(false);
	const [ userTicketOpen, setUserTicketOpen] = useState("");
	const [ queueTicketOpen, setQueueTicketOpen] = useState("");
	const { setTabOpen } = useContext(TicketsContext);
	const isMountedRef = useRef(true);

	const {get:getSetting} = useCompanySettings();

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		try {
			if (user.queues.length === 1 && isMountedRef.current) {
	        	setSelectedQueue(user.queues[0].id);
	      	}
		} catch (err) {
			if (isMountedRef.current) setLoading(false);
			toastError(err);
		}
	}, [user.queues]);

const handleClose = () => {
		if (isMountedRef.current) setSelectedQueue("");
		onClose();
};

	const handleCloseAlert = () => {
		if (isMountedRef.current) {
			setOpenAlert(false);
			setLoading(false);
		}
	};

const handleSendMessage = async (id) => {

	let isGreetingMessage = false;

	try {
		const  setting  = await getSetting({
			"column":"sendGreetingAccepted"
		});
		if (setting.sendGreetingAccepted === "enabled") isGreetingMessage = true;
	} catch (err) {
		toastError(err);
	}
	
	let settingMessage
	try {
		settingMessage = await getSetting({
			"column": "greetingAcceptedMessage"
		})
	} catch (err) {
		toastError(err);
	}
	
	// console.log(ticket)
	if (isGreetingMessage && (!ticket.isGroup || ticket.whatsapp?.groupAsTicket === "enabled") && ticket.status === "pending") {
		const msg = String(settingMessage?.greetingAcceptedMessage || "").trim();
		if (!msg) {
			return;
		}
		// const msg = `{{ms}} *{{name}}*, ${i18n.t("mainDrawer.appBar.user.myName")} *${user?.name}* ${i18n.t("mainDrawer.appBar.user.continuity")}.`;
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
	}
};

const handleUpdateTicketStatus = async (queueId) => {
		if (isMountedRef.current) setLoading(true);
		try {
			const otherTicket = await api.put(`/tickets/${ticketId}`, {
				status: ticket.isGroup && ticket.channel === 'whatsapp' ? "group" : "open",
				userId: user?.id || null,
				queueId: queueId
			});

			if (otherTicket.data.id !== ticket.id) {
				if (otherTicket.data.userId !== user?.id) {
					if (isMountedRef.current) {
						setOpenAlert(true);
						setUserTicketOpen(otherTicket.data.user.name);
						setQueueTicketOpen(otherTicket.data.queue.name);
					}
				} else {
					if (isMountedRef.current) setLoading(false);
					setTabOpen(otherTicket.isGroup ? "group" : "open");
					history.push(`/tickets/${otherTicket.data.uuid}`);
				}
			} else {
				handleSendMessage(ticket.id)
				if (isMountedRef.current) setLoading(false);
				setTabOpen(ticket.isGroup ? "group" : "open");
				history.push(`/tickets/${ticket.uuid}`);
				handleClose();
			}
		} catch (err) {
			if (isMountedRef.current) setLoading(false);
			toastError(err);
		}
	};

return (
	<>
		<Dialog open={modalOpen} onClose={handleClose}>
			<DialogTitle id="form-dialog-title">
				{i18n.t("ticketsList.acceptModal.title")}
			</DialogTitle>
			<DialogContent dividers>
				<FormControl variant="outlined" className={classes.maxWidth}>
					<InputLabel>{i18n.t("ticketsList.acceptModal.queue")}</InputLabel>
					<Select
						value={selectedQueue}
						className={classes.autoComplete}
						onChange={(e) => setSelectedQueue(e.target.value)}
						label={i18n.t("ticketsList.acceptModal.queue")}
					>
						<MenuItem value={''}>&nbsp;</MenuItem>
						{user.queues.map((queue) => (
							<MenuItem key={queue.id} value={queue.id}>{queue.name}</MenuItem>
						))}
					</Select>
				</FormControl>
				{user.queues?.length === 0 && (
					<Typography variant="body2" className={classes.alertText}>
						Para aceitar tickets, seu usuário precisa estar vinculado a pelo menos uma fila/setor.
					</Typography>
				)}
			</DialogContent>
			<DialogActions>
				<Button
					onClick={handleClose}
					className={classes.buttonColorError}
					disabled={loading}
					variant="outlined"
				>
					{i18n.t("ticketsList.buttons.cancel")}
				</Button>
				<ButtonWithSpinner
					variant="contained"
					type="button"
					disabled={(selectedQueue === "")}
					onClick={() => handleUpdateTicketStatus(selectedQueue)}
					color="primary"
					loading={loading}
				>
					{i18n.t("ticketsList.buttons.start")}
				</ButtonWithSpinner>
			</DialogActions>
			<ShowTicketOpen
				isOpen={openAlert}
				handleClose={handleCloseAlert}
				user={userTicketOpen}
				queue={queueTicketOpen}
			/>
		</Dialog>
	</>
);
};

export default AcceptTicketWithouSelectQueue;
