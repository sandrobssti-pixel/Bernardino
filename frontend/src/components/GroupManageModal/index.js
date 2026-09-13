import React, { useState, useEffect, useRef } from "react";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import Avatar from "@material-ui/core/Avatar";
import CircularProgress from "@material-ui/core/CircularProgress";
import Tooltip from "@material-ui/core/Tooltip";
import IconButton from "@material-ui/core/IconButton";
import ArrowUpwardIcon from "@material-ui/icons/ArrowUpward";
import ArrowDownwardIcon from "@material-ui/icons/ArrowDownward";
import CloseIcon from "@material-ui/icons/Close";
import AddIcon from "@material-ui/icons/Add";
import FileCopyOutlinedIcon from "@material-ui/icons/FileCopyOutlined";
import AutorenewIcon from "@material-ui/icons/Autorenew";
import VisibilityOutlinedIcon from "@material-ui/icons/VisibilityOutlined";
import GroupOutlinedIcon from "@material-ui/icons/GroupOutlined";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import formatSerializedId from "../../utils/formatSerializedId";

const useStyles = makeStyles(theme => ({
	dialogPaper: {
		borderRadius: 12,
		border: `1px solid ${theme.palette.divider}`,
		boxShadow:
			theme.palette.type === "dark"
				? "0 1px 3px rgba(0,0,0,0.4)"
				: "0 1px 3px rgba(15,23,42,0.08)",
	},
	dialogTitle: {
		padding: theme.spacing(2, 2.5),
		borderBottom: `1px solid ${theme.palette.divider}`,
	},
	dialogTitleText: {
		fontWeight: 700,
		fontSize: "1.05rem",
		letterSpacing: "-0.2px",
		color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
	},
	dialogContent: {
		padding: theme.spacing(2.5),
	},
	sectionTitle: {
		fontWeight: 600,
		fontSize: "0.72rem",
		letterSpacing: "0.06em",
		textTransform: "uppercase",
		color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
		marginBottom: theme.spacing(1.25),
	},
	section: {
		marginBottom: theme.spacing(2.5),
	},
	textField: {
		width: "100%",
		marginBottom: theme.spacing(1.25),
	},
	btnGhost: {
		borderRadius: 8,
		fontWeight: 500,
		fontSize: "0.78rem",
		padding: theme.spacing(0.6, 1.4),
		border: `1px solid ${theme.palette.divider}`,
		color: theme.palette.text.secondary,
		textTransform: "none",
		"&:hover": {
			backgroundColor:
				theme.palette.type === "dark"
					? "rgba(255,255,255,0.06)"
					: "rgba(15,23,42,0.04)",
		},
	},
	btnPrimary: {
		borderRadius: 8,
		fontWeight: 600,
		fontSize: "0.78rem",
		padding: theme.spacing(0.7, 1.6),
		textTransform: "none",
		boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
		"&:hover": {
			boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
		},
	},
	btnWrapper: {
		position: "relative",
		display: "inline-flex",
	},
	buttonProgress: {
		color: green[500],
		position: "absolute",
		top: "50%",
		left: "50%",
		marginTop: -9,
		marginLeft: -9,
	},
	participantsList: {
		borderRadius: 10,
		border: `1px solid ${theme.palette.divider}`,
		overflow: "hidden",
	},
	participantRow: {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1.25),
		padding: theme.spacing(1, 1.25),
		borderBottom: `1px solid ${theme.palette.divider}`,
		"&:last-child": { borderBottom: "none" },
	},
	participantAvatar: {
		width: 30,
		height: 30,
		fontSize: "0.78rem",
		fontWeight: 600,
		backgroundColor:
			theme.palette.type === "dark"
				? "rgba(255,255,255,0.08)"
				: "rgba(15,23,42,0.06)",
		color: theme.palette.type === "dark" ? "#cbd5e1" : "#334155",
	},
	participantInfo: {
		flex: 1,
		minWidth: 0,
	},
	participantNumber: {
		fontSize: "0.82rem",
		fontWeight: 500,
		color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	participantSecondaryNumber: {
		fontSize: "0.72rem",
		color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	adminBadge: {
		display: "inline-flex",
		alignItems: "center",
		padding: "1px 8px",
		borderRadius: 12,
		fontSize: "0.65rem",
		fontWeight: 600,
		marginTop: 2,
		backgroundColor:
			theme.palette.type === "dark"
				? "rgba(34,197,94,0.15)"
				: "rgba(34,197,94,0.1)",
		color: "#16a34a",
		border: "1px solid rgba(34,197,94,0.2)",
	},
	participantActions: {
		display: "flex",
		gap: 2,
		flexShrink: 0,
	},
	actionIconBtn: {
		width: 28,
		height: 28,
		borderRadius: 6,
		border: `1px solid ${theme.palette.divider}`,
		color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
		"&:hover": {
			backgroundColor:
				theme.palette.type === "dark"
					? "rgba(255,255,255,0.08)"
					: "rgba(15,23,42,0.06)",
			color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
		},
	},
	actionIconBtnDanger: {
		"&:hover": {
			backgroundColor: "rgba(239,68,68,0.08)",
			borderColor: "rgba(239,68,68,0.4)",
			color: "#ef4444",
		},
	},
	emptyState: {
		padding: theme.spacing(3),
		textAlign: "center",
		fontSize: "0.82rem",
		color: theme.palette.type === "dark" ? "#64748b" : "#94a3b8",
	},
	addParticipantRow: {
		display: "flex",
		gap: theme.spacing(1),
		marginTop: theme.spacing(1.25),
		alignItems: "center",
	},
	inviteLinkBox: {
		borderRadius: 10,
		border: `1px solid ${theme.palette.divider}`,
		padding: theme.spacing(1.25),
		marginBottom: theme.spacing(1.25),
		fontSize: "0.8rem",
		wordBreak: "break-all",
		color: theme.palette.type === "dark" ? "#cbd5e1" : "#334155",
		backgroundColor:
			theme.palette.type === "dark"
				? "rgba(255,255,255,0.03)"
				: "rgba(15,23,42,0.02)",
	},
	inviteLinkBoxEmpty: {
		color: theme.palette.type === "dark" ? "#64748b" : "#94a3b8",
	},
	inviteActionsRow: {
		display: "flex",
		gap: theme.spacing(1),
	},
	dialogActions: {
		padding: theme.spacing(1.5, 2.5, 2),
		borderTop: `1px solid ${theme.palette.divider}`,
	},
	noticeBox: {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1),
		borderRadius: 10,
		border: "1px solid rgba(245,158,11,0.3)",
		backgroundColor:
			theme.palette.type === "dark" ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.08)",
		color: theme.palette.type === "dark" ? "#fbbf24" : "#b45309",
		padding: theme.spacing(1, 1.5),
		fontSize: "0.8rem",
		marginBottom: theme.spacing(2),
	},
}));

const formatParticipantNumber = id => {
	const formatted = formatSerializedId(String(id || ""));
	return formatted || String(id || "").split("@")[0];
};

const isParticipantAdmin = admin => admin === "admin" || admin === "superadmin";

const SpinnerButton = ({ loading, disabled, className, onClick, children, icon }) => (
	<span className={`GroupManageModal-btnWrapper`} style={{ position: "relative", display: "inline-flex" }}>
		<IconButton
			size="small"
			className={className}
			disabled={disabled || loading}
			onClick={onClick}
		>
			{icon}
		</IconButton>
		{loading && (
			<CircularProgress
				size={16}
				style={{ position: "absolute", top: "50%", left: "50%", marginTop: -8, marginLeft: -8, color: green[500] }}
			/>
		)}
		{children}
	</span>
);

const GroupManageModal = ({ open, onClose, contactId }) => {
	const classes = useStyles();
	const isMounted = useRef(true);

	const [groupInfo, setGroupInfo] = useState({ subject: "", description: "", participants: [] });
	const [isAdmin, setIsAdmin] = useState(null);
	const [newParticipant, setNewParticipant] = useState("");
	const [inviteLink, setInviteLink] = useState("");
	const [loadingAction, setLoadingAction] = useState(null);

	useEffect(() => {
		return () => {
			isMounted.current = false;
		};
	}, []);

	const fetchGroupInfo = async () => {
		if (!contactId) return;
		try {
			const { data } = await api.get(`/contacts/${contactId}/group`);
			if (isMounted.current) {
				setGroupInfo({
					subject: data?.subject || "",
					description: data?.description || "",
					participants: Array.isArray(data?.participants) ? data.participants : [],
				});
				setIsAdmin(Boolean(data?.isAdmin));
			}
		} catch (err) {
			toastError(err);
		}
	};

	useEffect(() => {
		if (open && contactId) {
			setIsAdmin(null);
			fetchGroupInfo();
			setInviteLink("");
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, contactId]);

	const handleClose = () => {
		onClose();
		setNewParticipant("");
		setInviteLink("");
	};

	const handleSaveInfo = async values => {
		try {
			await api.put(`/contacts/${contactId}/group`, {
				subject: values.subject,
				description: values.description,
			});
			toast.success(i18n.t("groupManageModal.success.infoUpdated"));
			fetchGroupInfo();
		} catch (err) {
			toastError(err);
		}
	};

	const handleParticipantAction = async (participant, action) => {
		setLoadingAction(`${participant}-${action}`);
		try {
			await api.post(`/contacts/${contactId}/group/participants`, {
				participants: [participant],
				action,
			});
			toast.success(i18n.t("groupManageModal.success.participantsUpdated"));
			await fetchGroupInfo();
		} catch (err) {
			toastError(err);
		} finally {
			setLoadingAction(null);
		}
	};

	const handleAddParticipant = async () => {
		if (!newParticipant.trim()) return;
		await handleParticipantAction(newParticipant.trim(), "add");
		setNewParticipant("");
	};

	const handleGetInviteLink = async () => {
		setLoadingAction("invite-get");
		try {
			const { data } = await api.get(`/contacts/${contactId}/group/invite-link`);
			setInviteLink(data?.inviteLink || "");
		} catch (err) {
			toastError(err);
		} finally {
			setLoadingAction(null);
		}
	};

	const handleRevokeInviteLink = async () => {
		setLoadingAction("invite-revoke");
		try {
			const { data } = await api.post(`/contacts/${contactId}/group/invite-link/revoke`);
			setInviteLink(data?.inviteLink || "");
			toast.success(i18n.t("groupManageModal.success.linkRevoked"));
		} catch (err) {
			toastError(err);
		} finally {
			setLoadingAction(null);
		}
	};

	const handleCopyInviteLink = () => {
		if (!inviteLink) return;
		navigator.clipboard.writeText(inviteLink);
		toast.success(i18n.t("groupManageModal.success.linkCopied"));
	};

	return (
		<Dialog
			open={open}
			onClose={handleClose}
			maxWidth="sm"
			fullWidth
			scroll="paper"
			PaperProps={{ className: classes.dialogPaper }}
		>
			<DialogTitle className={classes.dialogTitle} disableTypography>
				<Typography className={classes.dialogTitleText}>
					{i18n.t("groupManageModal.title")}
				</Typography>
			</DialogTitle>
			<Formik
				initialValues={groupInfo}
				enableReinitialize
				onSubmit={(values, actions) => {
					handleSaveInfo(values);
					actions.setSubmitting(false);
				}}
			>
				{({ isSubmitting }) => (
					<Form>
						<DialogContent className={classes.dialogContent} dividers>
							{isAdmin === false && (
								<div className={classes.noticeBox}>
									<InfoOutlinedIcon style={{ fontSize: 18 }} />
									{i18n.t("groupManageModal.notice.notAdmin")}
								</div>
							)}
							<div className={classes.section}>
								<Typography className={classes.sectionTitle}>
									{i18n.t("groupManageModal.sections.info")}
								</Typography>
								<Field
									as={TextField}
									label={i18n.t("groupManageModal.form.subject")}
									name="subject"
									variant="outlined"
									size="small"
									disabled={isAdmin === false}
									className={classes.textField}
								/>
								<Field
									as={TextField}
									label={i18n.t("groupManageModal.form.description")}
									name="description"
									variant="outlined"
									size="small"
									multiline
									minRows={2}
									disabled={isAdmin === false}
									className={classes.textField}
									style={{ marginBottom: 0 }}
								/>
								{isAdmin !== false && (
									<div style={{ marginTop: 12 }}>
										<span className={classes.btnWrapper}>
											<Button
												type="submit"
												variant="contained"
												color="primary"
												disabled={isSubmitting}
												className={classes.btnPrimary}
											>
												{i18n.t("groupManageModal.buttons.saveInfo")}
											</Button>
											{isSubmitting && (
												<CircularProgress size={18} className={classes.buttonProgress} />
											)}
										</span>
									</div>
								)}
							</div>

							<div className={classes.section}>
								<Typography className={classes.sectionTitle}>
									{i18n.t("groupManageModal.sections.participants")}
								</Typography>
								<div className={classes.participantsList}>
									{groupInfo.participants.length === 0 && (
										<div className={classes.emptyState}>
											{i18n.t("groupManageModal.empty.participants")}
										</div>
									)}
									{groupInfo.participants.map(participant => {
										const participantIsAdmin = isParticipantAdmin(participant.admin);
										const displayNumber = formatParticipantNumber(participant.id);
										const displayName = participant.name || null;
										return (
											<div className={classes.participantRow} key={participant.id}>
												<Avatar className={classes.participantAvatar}>
													<GroupOutlinedIcon fontSize="small" />
												</Avatar>
												<div className={classes.participantInfo}>
													<Typography className={classes.participantNumber}>
														{displayName || displayNumber}
													</Typography>
													{displayName && (
														<Typography className={classes.participantSecondaryNumber}>
															{displayNumber}
														</Typography>
													)}
													{participantIsAdmin && (
														<span className={classes.adminBadge}>
															{i18n.t(`groupManageModal.admin.${participant.admin}`)}
														</span>
													)}
												</div>
												{isAdmin !== false && (
													<div className={classes.participantActions}>
														<Tooltip title={i18n.t("groupManageModal.buttons.promote")}>
															<span>
																<SpinnerButton
																	className={classes.actionIconBtn}
																	disabled={participantIsAdmin}
																	loading={loadingAction === `${participant.id}-promote`}
																	onClick={() => handleParticipantAction(participant.id, "promote")}
																	icon={<ArrowUpwardIcon style={{ fontSize: 16 }} />}
																/>
															</span>
														</Tooltip>
														<Tooltip title={i18n.t("groupManageModal.buttons.demote")}>
															<span>
																<SpinnerButton
																	className={classes.actionIconBtn}
																	disabled={!participantIsAdmin}
																	loading={loadingAction === `${participant.id}-demote`}
																	onClick={() => handleParticipantAction(participant.id, "demote")}
																	icon={<ArrowDownwardIcon style={{ fontSize: 16 }} />}
																/>
															</span>
														</Tooltip>
														<Tooltip title={i18n.t("groupManageModal.buttons.remove")}>
															<span>
																<SpinnerButton
																	className={`${classes.actionIconBtn} ${classes.actionIconBtnDanger}`}
																	loading={loadingAction === `${participant.id}-remove`}
																	onClick={() => handleParticipantAction(participant.id, "remove")}
																	icon={<CloseIcon style={{ fontSize: 16 }} />}
																/>
															</span>
														</Tooltip>
													</div>
												)}
											</div>
										);
									})}
								</div>
								{isAdmin !== false && (
									<div className={classes.addParticipantRow}>
										<TextField
											label={i18n.t("groupManageModal.form.newParticipant")}
											variant="outlined"
											size="small"
											value={newParticipant}
											onChange={e => setNewParticipant(e.target.value)}
											style={{ flex: 1 }}
										/>
										<Tooltip title={i18n.t("groupManageModal.buttons.add")}>
											<span>
												<SpinnerButton
													className={classes.actionIconBtn}
													disabled={!newParticipant.trim()}
													loading={loadingAction === `${newParticipant.trim()}-add`}
													onClick={handleAddParticipant}
													icon={<AddIcon style={{ fontSize: 18 }} />}
												/>
											</span>
										</Tooltip>
									</div>
								)}
							</div>

							{isAdmin !== false && (
							<div className={classes.section} style={{ marginBottom: 0 }}>
								<Typography className={classes.sectionTitle}>
									{i18n.t("groupManageModal.sections.inviteLink")}
								</Typography>
								<div className={`${classes.inviteLinkBox} ${!inviteLink ? classes.inviteLinkBoxEmpty : ""}`}>
									{inviteLink || i18n.t("groupManageModal.form.noInviteLink")}
								</div>
								<div className={classes.inviteActionsRow}>
									<Button
										variant="outlined"
										size="small"
										className={classes.btnGhost}
										startIcon={
											loadingAction === "invite-get" ? (
												<CircularProgress size={14} />
											) : (
												<VisibilityOutlinedIcon style={{ fontSize: 16 }} />
											)
										}
										disabled={loadingAction === "invite-get"}
										onClick={handleGetInviteLink}
									>
										{i18n.t("groupManageModal.buttons.getLink")}
									</Button>
									<Button
										variant="outlined"
										size="small"
										className={classes.btnGhost}
										startIcon={<FileCopyOutlinedIcon style={{ fontSize: 16 }} />}
										onClick={handleCopyInviteLink}
										disabled={!inviteLink}
									>
										{i18n.t("groupManageModal.buttons.copyLink")}
									</Button>
									<Button
										variant="outlined"
										size="small"
										className={classes.btnGhost}
										startIcon={
											loadingAction === "invite-revoke" ? (
												<CircularProgress size={14} />
											) : (
												<AutorenewIcon style={{ fontSize: 16 }} />
											)
										}
										disabled={loadingAction === "invite-revoke"}
										onClick={handleRevokeInviteLink}
									>
										{i18n.t("groupManageModal.buttons.newLink")}
									</Button>
								</div>
							</div>
							)}
						</DialogContent>
						<DialogActions className={classes.dialogActions}>
							<Button onClick={handleClose} className={classes.btnGhost} variant="outlined">
								{i18n.t("groupManageModal.buttons.close")}
							</Button>
						</DialogActions>
					</Form>
				)}
			</Formik>
		</Dialog>
	);
};

export default GroupManageModal;
