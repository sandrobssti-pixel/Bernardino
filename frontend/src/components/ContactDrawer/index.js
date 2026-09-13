import React, { useEffect, useState, useContext } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import Drawer from "@material-ui/core/Drawer";
import Link from "@material-ui/core/Link";
import InputLabel from "@material-ui/core/InputLabel";
// import Avatar from "@material-ui/core/Avatar";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import CreateIcon from '@material-ui/icons/Create';
import GroupOutlinedIcon from '@material-ui/icons/GroupOutlined';
import formatSerializedId from '../../utils/formatSerializedId';
import { i18n } from "../../translate/i18n";
import ModalImageCors from "../ModalImageCors"
import ContactDrawerSkeleton from "../ContactDrawerSkeleton";
import MarkdownWrapper from "../MarkdownWrapper";
import { CardHeader } from "@material-ui/core";
import { ContactForm } from "../ContactForm";
import ContactModal from "../ContactModal";
import GroupManageModal from "../GroupManageModal";
import { ContactNotes } from "../ContactNotes";

import { AuthContext } from "../../context/Auth/AuthContext";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { toast } from "react-toastify";
import { TagsKanbanContainer } from "../TagsKanbanContainer";


const drawerWidth = 320;

const truncateContactNumber = (value) => {
	const str = String(value || "");
	// Identificadores sintéticos do webchat ("webchat-<uuid>") são bem mais
	// longos que qualquer telefone formatado, então usam um limite curto;
	// números de telefone reais (ex.: "🇧🇷 (13) 91234-4321", ~20 chars)
	// ficam abaixo do limite geral e nunca são cortados.
	if (str.startsWith("webchat-")) {
		return str.length > 16 ? str.substring(0, 16) + "..." : str;
	}
	return str.length > 26 ? str.substring(0, 26) + "..." : str;
};

const useStyles = makeStyles(theme => ({
	drawer: {
		width: "min(100%, " + drawerWidth + "px)",
		flexShrink: 0,
	},
	drawerPaper: {
		width: "min(100%, " + drawerWidth + "px)",
		maxWidth: "100%",
		display: "flex",
		borderLeft: `1px solid ${theme.mode === "light" ? "rgba(15,23,42,0.08)" : "rgba(148,163,184,0.12)"}`,
		backgroundColor: theme.palette.background.paper,
		boxShadow: "none",
	},
	header: {
		display: "flex",
		borderBottom: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.2)" : "rgba(148,163,184,0.15)"}`,
		backgroundColor: theme.mode === "light" ? "#ffffff" : "rgba(30,41,59,0.8)",
		alignItems: "center",
		padding: theme.spacing(0, 1),
		minHeight: "56px",
		justifyContent: "flex-start",
	},
	headerTitle: {
		fontSize: "0.95rem",
		fontWeight: 600,
		color: theme.mode === "light" ? "#0f172a" : "#f1f5f9",
		marginLeft: 8,
	},
	closeButton: {
		width: 36,
		height: 36,
		borderRadius: "50%",
		color: theme.mode === "light" ? "#64748b" : "#94a3b8",
		transition: "background-color 0.15s ease",
		"&:hover": {
			background: theme.palette.chat.listHover,
		},
	},
	audioToggle: {
		display: "flex",
		alignItems: "center",
		padding: "8px 16px",
		backgroundColor: theme.mode === "light" ? "rgba(255,255,255,0.6)" : "rgba(30,41,59,0.6)",
		borderBottom: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.15)" : "rgba(148,163,184,0.1)"}`,
	},
	audioToggleText: {
		fontSize: "0.8rem",
		color: theme.mode === "light" ? "#475569" : "#94a3b8",
		marginLeft: 8,
	},
	iosSwitch: {
		position: "relative",
		display: "inline-block",
		width: 40,
		height: 22,
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
		borderRadius: 22,
		"&:before": {
			position: "absolute",
			content: '""',
			height: 16,
			width: 16,
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
			transform: "translateX(18px)",
		},
	},
	content: {
		display: "flex",
		backgroundColor: theme.mode === "light" ? "#f8fafc" : "rgba(15,23,42,0.95)",
		flexDirection: "column",
		padding: "12px",
		height: "100%",
		justifyContent: "flex-start",
		overflowY: "scroll",
		gap: 12,
		...theme.scrollbarStyles,
	},
	contactAvatar: {
		margin: "8px auto",
		width: 100,
		height: 100,
		objectFit: "cover",
		borderRadius: "50%",
		border: `3px solid ${theme.mode === "light" ? "#ffffff" : "rgba(30,41,59,0.8)"}`,
		boxShadow: theme.mode === "light"
			? "0 2px 8px rgba(0,0,0,0.1)"
			: "0 2px 8px rgba(0,0,0,0.3)",
	},
	contactHeader: {
		display: "flex",
		padding: 16,
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "transparent",
		borderBottom: `1px solid ${theme.mode === "light" ? "rgba(15,23,42,0.08)" : "rgba(148,163,184,0.12)"}`,
		"& > *": {
			margin: 4,
		},
	},
	contactName: {
		fontSize: "1rem",
		fontWeight: 600,
		color: theme.mode === "light" ? "#0f172a" : "#f1f5f9",
		display: "flex",
		alignItems: "center",
		gap: 6,
	},
	contactNameEditIcon: {
		fontSize: 14,
		color: theme.mode === "light" ? "#64748b" : "#94a3b8",
		cursor: "pointer",
		"&:hover": {
			color: theme.mode === "light" ? "#6366f1" : "#818cf8",
		},
	},
	contactInfo: {
		fontSize: "0.8rem",
		color: theme.mode === "light" ? "#64748b" : "#94a3b8",
		maxWidth: "100%",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	buttonGroup: {
		display: "flex",
		flexWrap: "wrap",
		gap: 8,
		marginTop: 8,
	},
	editButton: {
		flex: "0 1 auto",
		minWidth: 0,
		whiteSpace: "nowrap",
		borderRadius: 8,
		fontSize: "0.75rem",
		fontWeight: 600,
		textTransform: "none",
		padding: "4px 10px",
		border: "none",
		background: theme.mode === "light" ? "#e0e7ff" : "rgba(99,102,241,0.25)",
		color: theme.mode === "light" ? "#4338ca" : "#a5b4fc",
		"&:hover": {
			background: theme.mode === "light" ? "#c7d2fe" : "rgba(99,102,241,0.35)",
		},
	},
	blockButton: {
		flex: "0 1 auto",
		minWidth: 0,
		whiteSpace: "nowrap",
		borderRadius: 8,
		fontSize: "0.75rem",
		fontWeight: 600,
		textTransform: "none",
		padding: "4px 10px",
		border: "none",
		background: theme.mode === "light" ? "#fecaca" : "rgba(239,68,68,0.25)",
		color: theme.mode === "light" ? "#b91c1c" : "#f87171",
		"&:hover": {
			background: theme.mode === "light" ? "#fca5a5" : "rgba(239,68,68,0.35)",
		},
	},
	groupButton: {
		flex: "1 1 100%",
		minWidth: 0,
		borderRadius: 8,
		fontSize: "0.75rem",
		fontWeight: 600,
		textTransform: "none",
		padding: "4px 8px",
		border: "none",
		background: theme.mode === "light" ? "#bbf7d0" : "rgba(34,197,94,0.25)",
		color: theme.mode === "light" ? "#15803d" : "#4ade80",
		"&:hover": {
			background: theme.mode === "light" ? "#86efac" : "rgba(34,197,94,0.35)",
		},
	},
	contactDetails: {
		padding: 12,
		display: "flex",
		flexDirection: "column",
		backgroundColor: "transparent",
		borderBottom: `1px solid ${theme.mode === "light" ? "rgba(15,23,42,0.08)" : "rgba(148,163,184,0.12)"}`,
	},
	sectionTitle: {
		fontSize: "0.85rem",
		fontWeight: 600,
		color: theme.mode === "light" ? "#0f172a" : "#f1f5f9",
		marginBottom: 8,
	},
	contactExtraInfo: {
		marginTop: 6,
		padding: 8,
		backgroundColor: theme.mode === "light" ? "#f8fafc" : "rgba(15,23,42,0.6)",
		borderRadius: 8,
		border: `1px solid ${theme.mode === "light" ? "rgba(148,163,184,0.15)" : "rgba(148,163,184,0.1)"}`,
	},
	extraInfoLabel: {
		fontSize: "0.7rem",
		fontWeight: 600,
		color: theme.mode === "light" ? "#64748b" : "#94a3b8",
		textTransform: "uppercase",
		letterSpacing: "0.05em",
	},
	extraInfoValue: {
		fontSize: "0.85rem",
		color: theme.mode === "light" ? "#0f172a" : "#f1f5f9",
		marginTop: 2,
	},
}));

const ContactDrawer = ({ open, handleDrawerClose, contact, ticket, loading }) => {
	const classes = useStyles();

	const [modalOpen, setModalOpen] = useState(false);
	const [openForm, setOpenForm] = useState(false);
	const [groupModalOpen, setGroupModalOpen] = useState(false);
	const [groupPhotoUrl, setGroupPhotoUrl] = useState(null);
	const { get } = useCompanySettings();
	const [hideNum, setHideNum] = useState(false);
	const { user } = useContext(AuthContext);
    const [acceptAudioMessage, setAcceptAudio] = useState(contact.acceptAudioMessage);
	const flowVariables = ticket?.dataWebhook?.variables && typeof ticket.dataWebhook.variables === "object"
		? ticket.dataWebhook.variables
		: {};
	const flowVariableEntries = Object.entries(flowVariables).filter(([key]) => !!String(key || "").trim());

	useEffect(() => {
		async function fetchData() {

			const lgpdHideNumber = await get({
				"column": "lgpdHideNumber"
			});

			if (lgpdHideNumber === "enabled") setHideNum(true);

		}
		fetchData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		setOpenForm(false);
	}, [open, contact]);

	useEffect(() => {
		setAcceptAudio(Boolean(contact?.acceptAudioMessage));
	}, [contact]);

	// Grupos: a foto padrão do contato é sempre um thumbnail em baixa
	// resolução; ao abrir o drawer, busca uma versão em alta resolução
	// para exibir no zoom (ModalImageCors) sem afetar o avatar pequeno.
	useEffect(() => {
		let active = true;
		setGroupPhotoUrl(null);

		if (open && ticket?.isGroup && ticket?.channel === "whatsapp" && contact?.id) {
			api.get(`/contacts/${contact.id}/group/photo`)
				.then(({ data }) => {
					if (active && data?.url) setGroupPhotoUrl(data.url);
				})
				.catch(() => {});
		}

		return () => {
			active = false;
		};
	}, [open, contact?.id, ticket?.isGroup, ticket?.channel]);

	

	const handleContactToggleAcceptAudio = async () => {
        try {
            const contact = await api.put(`/contacts/toggleAcceptAudio/${ticket.contact.id}`);
            setAcceptAudio(contact.data.acceptAudioMessage);
        } catch (err) {
            toastError(err);
        }
    };

	const handleBlockContact = async (contactId) => {
		try {
			await api.put(`/contacts/block/${contactId}`, { active: false });
			toast.success("Contato bloqueado");
		} catch (err) {
			toastError(err);
		}

	};

	const handleUnBlockContact = async (contactId) => {
		try {
			await api.put(`/contacts/block/${contactId}`, { active: true });
			toast.success("Contato desbloqueado");
		} catch (err) {
			toastError(err);
		}
	};

	if (loading) return null;

	return (
		<>
			<Drawer
				className={classes.drawer}
				variant="persistent"
				anchor="right"
				open={open}
				PaperProps={{ style: { position: "absolute" } }}
				BackdropProps={{ style: { position: "absolute" } }}
				ModalProps={{
					container: document.getElementById("drawer-container"),
					style: { position: "absolute" },
				}}
				classes={{
					paper: classes.drawerPaper,
				}}
			>
				<div className={classes.header}>
					<IconButton onClick={handleDrawerClose} className={classes.closeButton} size="small">
						<CloseIcon fontSize="small" />
					</IconButton>
					<Typography className={classes.headerTitle}>
						{i18n.t("contactDrawer.header")}
					</Typography>
				</div>
				{!loading && (
					<div className={classes.audioToggle}>
						<label className={classes.iosSwitch}>
							<input
								type="checkbox"
								checked={acceptAudioMessage}
								onChange={() => handleContactToggleAcceptAudio()}
							/>
							<span className={`${classes.iosSlider} ${acceptAudioMessage ? classes.iosSliderChecked : ''}`} />
						</label>
						<Typography className={classes.audioToggleText}>
							{i18n.t("ticketOptionsMenu.acceptAudioMessage")}
						</Typography>
					</div>
				)}
				{loading ? (
					<ContactDrawerSkeleton classes={classes} />
				) : (
					<div className={classes.content}>
						<div className={classes.contactHeader}>
							<ModalImageCors
								imageUrl={groupPhotoUrl || contact?.urlPicture}
								className={classes.contactAvatar}
							/>
							<CardHeader
								onClick={() => { }}
								style={{ cursor: "pointer", width: '100%' }}
								titleTypographyProps={{ noWrap: true }}
								subheaderTypographyProps={{ noWrap: true }}
								title={
									<div className={classes.contactName} onClick={() => setOpenForm(true)}>
										{contact.name}
										<CreateIcon className={classes.contactNameEditIcon} />
									</div>
								}
								subheader={
									<>
										<Typography className={classes.contactInfo}>
											{truncateContactNumber(
												hideNum && user.profile === "user"
													? formatSerializedId(contact.number).slice(0, -6) + "**-**" + contact.number.slice(-2)
													: formatSerializedId(contact.number)
											)}
										</Typography>
										{contact.email && (
											<Typography className={classes.contactInfo}>
												<Link href={`mailto:${contact.email}`}>{contact.email}</Link>
											</Typography>
										)}
									</>
								}
							/>
							<div className={classes.buttonGroup}>
								<Button
									variant="outlined"
									className={classes.editButton}
									onClick={() => setModalOpen(!openForm)}
								>
									{i18n.t("contactDrawer.buttons.edit")}
								</Button>
								<Button
									variant="outlined"
									className={classes.blockButton}
									onClick={() => contact.active
										? handleBlockContact(contact.id)
										: handleUnBlockContact(contact.id)}
									disabled={loading}
								>
									{!contact.active ? "Desbloquear" : "Bloquear"}
								</Button>
								{ticket?.isGroup && ticket?.channel === "whatsapp" && (
									<Button
										variant="outlined"
										className={classes.groupButton}
										startIcon={<GroupOutlinedIcon style={{ fontSize: 16 }} />}
										onClick={() => setGroupModalOpen(true)}
									>
										Gerenciar Grupo
									</Button>
								)}
							</div>
							{ticket?.isGroup && ticket?.channel === "whatsapp" && (
								<GroupManageModal
									open={groupModalOpen}
									onClose={() => setGroupModalOpen(false)}
									contactId={contact.id}
								/>
							)}
							{(contact.id && openForm) && <ContactForm initialContact={contact} onCancel={() => setOpenForm(false)} />}
						</div>
						<div className={classes.contactDetails}>
							<TagsKanbanContainer ticket={ticket} />
						</div>
						<div className={classes.contactDetails}>
							<Typography className={classes.sectionTitle}>
								{i18n.t("ticketOptionsMenu.appointmentsModal.title")}
							</Typography>
							<ContactNotes ticket={ticket} />
						</div>
						<div className={classes.contactDetails}>
							<ContactModal
								open={modalOpen}
								onClose={() => setModalOpen(false)}
								contactId={contact.id}
							></ContactModal>
							<Typography className={classes.sectionTitle}>
								{i18n.t("contactDrawer.extraInfo")}
							</Typography>
							{contact?.extraInfo?.map(info => (
								<div
									key={info.id}
									className={classes.contactExtraInfo}
								>
									<Typography className={classes.extraInfoLabel}>{info.name}</Typography>
									<Typography className={classes.extraInfoValue} component="div">
										<MarkdownWrapper>{info.value}</MarkdownWrapper>
									</Typography>
								</div>
							))}
						</div>
						<div className={classes.contactDetails}>
							<Typography className={classes.sectionTitle}>
								Variáveis do fluxo
							</Typography>
							{flowVariableEntries.map(([key, value]) => (
								<div
									key={key}
									className={classes.contactExtraInfo}
								>
									<Typography className={classes.extraInfoLabel}>{key}</Typography>
									<Typography className={classes.extraInfoValue} component="div">
										<MarkdownWrapper>{String(value ?? "")}</MarkdownWrapper>
									</Typography>
								</div>
							))}
						</div>
					</div>
				)}
			</Drawer>
		</>
	);
};

export default ContactDrawer;
