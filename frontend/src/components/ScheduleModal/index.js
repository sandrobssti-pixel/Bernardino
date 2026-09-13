import React, { useState, useEffect, useContext, useRef } from "react";

import * as Yup from "yup";
import { Formik, Form, Field, FieldArray } from "formik";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles, withStyles, useTheme } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import Box from "@material-ui/core/Box";
import Divider from "@material-ui/core/Divider";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { Chip, FormControl, FormControlLabel, Grid, IconButton, InputLabel, MenuItem, Select, Switch, Typography } from "@material-ui/core";
import Autocomplete, { createFilterOptions } from "@material-ui/lab/Autocomplete";
import moment from "moment"
import { AuthContext } from "../../context/Auth/AuthContext";
import { isArray, capitalize } from "lodash";
import DeleteOutline from "@material-ui/icons/DeleteOutline";
import AttachFile from "@material-ui/icons/AttachFile";
import { head } from "lodash";
import ConfirmationModal from "../ConfirmationModal";
import MessageVariablesPicker from "../MessageVariablesPicker";
import useQueues from "../../hooks/useQueues";
import UserStatusIcon from "../UserModal/statusIcon";
import { Facebook, Instagram, WhatsApp, EventAvailable as EventAvailableIcon } from "@material-ui/icons";

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		flexWrap: "wrap",
	},
	dialogPaper: {
		width: "100%",
		maxWidth: 900,
		maxHeight: "calc(100dvh - 32px)",
		margin: theme.spacing(2),
		[theme.breakpoints.down("xs")]: {
			margin: theme.spacing(1),
			maxHeight: "calc(100dvh - 16px)",
			borderRadius: 12,
		},
	},
	dialogTitle: {
		padding: theme.spacing(1.5, 2),
		"& .MuiTypography-root": {
			fontSize: "1rem",
			fontWeight: 600,
			lineHeight: 1.3,
		},
		[theme.breakpoints.down("xs")]: {
			padding: theme.spacing(1.25, 1.5),
			"& .MuiTypography-root": {
				fontSize: "0.95rem",
			},
		},
	},
	dialogContent: {
		padding: theme.spacing(1.5, 2),
		overflowY: "auto",
		overflowX: "hidden",
		[theme.breakpoints.down("xs")]: {
			padding: theme.spacing(1.25, 1.5),
		},
	},
	dialogActions: {
		padding: theme.spacing(1.25, 2),
		[theme.breakpoints.down("xs")]: {
			padding: theme.spacing(1.25, 1.5),
		},
	},
	sectionDescription: {
		margin: 0,
		fontSize: "0.82rem",
		lineHeight: 1.45,
		color: theme.palette.text.secondary,
	},
	switchLabel: {
		marginTop: theme.spacing(0.25),
		marginLeft: 0,
		"& .MuiFormControlLabel-label": {
			fontSize: "0.88rem",
		},
	},
	formSection: {
		padding: theme.spacing(1.5),
		borderRadius: 12,
		border: `1px solid ${theme.palette.divider}`,
		backgroundColor:
			theme.mode === "light" ? "rgba(248,250,252,0.85)" : "rgba(15,23,42,0.3)",
		marginBottom: theme.spacing(1.5),
	},
	formSectionLabel: {
		display: "flex",
		alignItems: "center",
		gap: 6,
		fontSize: "0.68rem",
		fontWeight: 800,
		letterSpacing: 0.9,
		textTransform: "uppercase",
		color: theme.palette.text.secondary,
		marginBottom: theme.spacing(1.25),
	},
	formSectionLabelDot: {
		width: 7,
		height: 7,
		borderRadius: "50%",
		backgroundColor: "#f63d68",
		flexShrink: 0,
	},
	btnWrapper: {
		position: "relative",
	},

	buttonProgress: {
		color: green[500],
		position: "absolute",
		top: "50%",
		left: "50%",
		marginTop: -12,
		marginLeft: -12,
	},

	sectionDivider: {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1),
		margin: theme.spacing(2, 0, 0.75),
		color: theme.palette.text.secondary,
	},

	sectionDividerLabel: {
		fontSize: "0.72rem",
		fontWeight: 700,
		letterSpacing: 0.8,
		textTransform: "uppercase",
		whiteSpace: "nowrap",
		color: theme.palette.text.secondary,
	},

	actionRow: {
		display: "flex",
		alignItems: "center",
		width: "100%",
		gap: theme.spacing(1),
		[theme.breakpoints.down("xs")]: {
			flexWrap: "wrap",
			"& > *": {
				flex: "1 1 auto",
			},
			"& .actions-spacer": {
				display: "none",
			},
		},
	},

	dialogTitleIcon: {
		fontSize: 20,
		color: "#f63d68",
		flexShrink: 0,
	},

	statusChipERRO: {
		fontSize: "0.7rem",
		fontWeight: 700,
		height: 22,
		backgroundColor: "rgba(239,68,68,0.1)",
		color: "#ef4444",
		border: "1px solid rgba(239,68,68,0.2)",
	},

	statusChipOther: {
		fontSize: "0.7rem",
		fontWeight: 700,
		height: 22,
		backgroundColor: "rgba(16,185,129,0.1)",
		color: "#10b981",
		border: "1px solid rgba(16,185,129,0.2)",
	},
}));

const IOSSwitch = withStyles(theme => ({
	root: {
		width: 42,
		height: 26,
		padding: 0,
		margin: theme.spacing(0, 1, 0, 0),
	},
	switchBase: {
		padding: 1,
		"&$checked": {
			transform: "translateX(16px)",
			color: theme.palette.common.white,
			"& + $track": {
				backgroundColor: "#34C759",
				opacity: 1,
				border: "none",
			},
		},
		"&$disabled + $track": {
			opacity: 0.5,
		},
	},
	thumb: {
		width: 24,
		height: 24,
	},
	track: {
		borderRadius: 26 / 2,
		border: "1px solid #d9d9d9",
		backgroundColor: "#e8e8e8",
		opacity: 1,
		transition: theme.transitions.create(["background-color", "border"]),
	},
	checked: {},
	disabled: {},
}))(Switch);

const ScheduleSchema = Yup.object().shape({
	body: Yup.string()
		.min(5, "Mensagem muito curta")
		.required("Obrigatório"),
	contactId: Yup.number().required("Obrigatório"),
	sendAt: Yup.string().required("Obrigatório")
});

const ScheduleModal = ({ open, onClose, scheduleId, contactId, cleanContact, reload }) => {
	const classes = useStyles();
	const history = useHistory();
	const theme = useTheme();
	const { user } = useContext(AuthContext);
	const isMounted = useRef(true);
	const { companyId } = user;

	const initialState = {
		body: "",
		contactId: "",
		sendAt: moment().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
		sentAt: "",
		openTicket: "enabled",
		ticketUserId: "",
		queueId: "",
		statusTicket: "closed",
		intervalo: 1,
		valorIntervalo: 0,
		enviarQuantasVezes: 1,
		tipoDias: 4,
		assinar: false
	};

	const initialContact = {
		id: "",
		name: "",
		channel: ""
	}

	const [schedule, setSchedule] = useState(initialState);
	const [currentContact, setCurrentContact] = useState(initialContact);
	const [contacts, setContacts] = useState([initialContact]);
	const [intervalo, setIntervalo] = useState(1);
	// const [valorIntervalo, setValorIntervalo] = useState(initialContact);
	// const [enviarQuantasVezes, setEnviarQuantasVezes] = useState(initialContact);
	const [tipoDias, setTipoDias] = useState(4);
	const [attachment, setAttachment] = useState(null);
	const attachmentFile = useRef(null);
	const [confirmationOpen, setConfirmationOpen] = useState(false);
	const messageInputRef = useRef();
	const [channelFilter, setChannelFilter] = useState("whatsapp");
	const [whatsapps, setWhatsapps] = useState([]);
	const [selectedWhatsapps, setSelectedWhatsapps] = useState("");
	const [loading, setLoading] = useState(false);
	const [queues, setQueues] = useState([]);
	const [allQueues, setAllQueues] = useState([]);
	const [selectedUser, setSelectedUser] = useState(null);
	const [selectedQueue, setSelectedQueue] = useState(null);
	const { findAll: findAllQueues } = useQueues();
	const [options, setOptions] = useState([]);
	const [searchParam, setSearchParam] = useState("");

	useEffect(() => {
		return () => {
			isMounted.current = false;
		};
	}, []);

	useEffect(() => {
		if (isMounted.current) {
			const loadQueues = async () => {
				const list = await findAllQueues();
				setAllQueues(list);
				setQueues(list);
			};
			loadQueues();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (searchParam.length < 3) {
			setLoading(false);
			setSelectedQueue("");
			return;
		}
		const delayDebounceFn = setTimeout(() => {
			setLoading(true);
			const fetchUsers = async () => {
				try {
					const { data } = await api.get("/users/");
					setOptions(data.users);
					setLoading(false);
				} catch (err) {
					setLoading(false);
					toastError(err);
				}
			};

			fetchUsers();
		}, 500);
		return () => clearTimeout(delayDebounceFn);
	}, [searchParam]);

	useEffect(() => {
		const channels = channelFilter === "whatsapp"
			? ["whatsapp", "whatsapp_oficial"]
			: [channelFilter];

		Promise.all(
			channels.map(channel =>
				api.get(`/whatsapp/filter`, { params: { session: 0, channel } })
			)
		)
			.then(responses => {
				const data = responses.reduce(
					(items, response) => items.concat(response.data),
					[]
				);
				// Mapear os dados recebidos da API para adicionar a propriedade 'selected'
				const mappedWhatsapps = data.map((whatsapp) => ({
					...whatsapp,
					selected: false,
				}));

				setWhatsapps(mappedWhatsapps);
				if (mappedWhatsapps.length && mappedWhatsapps?.length === 1){
					setSelectedWhatsapps(mappedWhatsapps[0].id)
				}
			});
	}, [currentContact, channelFilter])

	useEffect(() => {
		if (contactId && contacts.length) {
			const contact = contacts.find(c => c.id === contactId);
			if (contact) {
				setCurrentContact(contact);
			}
		}
	}, [contactId, contacts]);

	useEffect(() => {
		const { companyId } = user;
		if (open) {
			try {
				(async () => {
					const { data: contactList } = await api.get('/contacts/list', { params: { companyId: companyId } });
					let customList = contactList.map((c) => ({ id: c.id, name: c.name, channel: c.channel }));
					if (isArray(customList)) {
						setContacts([{ id: "", name: "", channel: "" }, ...customList]);
					}
					if (contactId) {
						setSchedule(prevState => {
							return { ...prevState, contactId }
						});
					}

					if (!scheduleId) return;

					const { data } = await api.get(`/schedules/${scheduleId}`);
					setSchedule(prevState => {
						return { ...prevState, ...data, sendAt: moment(data.sendAt).format('YYYY-MM-DDTHH:mm') };
					});
					console.log(data)
					if (data.whatsapp) {
						setSelectedWhatsapps(data.whatsapp.id);
					}

					if (data.ticketUser) {
						setSelectedUser(data.ticketUser);
					}
					if (data.queueId) {
						setSelectedQueue(data.queueId);
					}

					if (data.intervalo) {
						setIntervalo(data.intervalo);
					}

					if (data.tipoDias) {
						setTipoDias(data.tipoDias);
					}

					setCurrentContact(data.contact);
				})()
			} catch (err) {
				toastError(err);
			}
		}
	}, [scheduleId, contactId, open, user]);

	const filterOptions = createFilterOptions({
		trim: true,
	});

	const handleClose = () => {
		onClose();
		setAttachment(null);
		setSchedule(initialState);
		setSelectedWhatsapps("");
	};

	const handleAttachmentFile = (e) => {
		const file = head(e.target.files);
		if (file) {
			setAttachment(file);
		}
	};

	const IconChannel = (channel) => {
		switch (channel) {
			case "facebook":
				return <Facebook style={{ color: "#3b5998", verticalAlign: "middle" }} />;
			case "instagram":
				return <Instagram style={{ color: "#e1306c", verticalAlign: "middle" }} />;
			case "whatsapp":
				return <WhatsApp style={{ color: "#25d366", verticalAlign: "middle" }} />
			default:
				return "error";
		}
	};

	const renderOption = option => {
		if (option.name) {
			return <>
				{IconChannel(option.channel)}
				<Typography component="span" style={{ fontSize: 14, marginLeft: "10px", display: "inline-flex", alignItems: "center", lineHeight: "2" }}>
					{option.name}
				</Typography>
			</>
		} else {
			return `${i18n.t("newTicketModal.add")} ${option.name}`;
		}
	};
	const handleSaveSchedule = async values => {
		const scheduleData = {
			...values, userId: user.id, whatsappId: selectedWhatsapps, ticketUserId: selectedUser?.id || null,
			queueId: selectedQueue || null, intervalo: intervalo || 1, tipoDias: tipoDias || 4
		};

		try {
			if (scheduleId) {
				await api.put(`/schedules/${scheduleId}`, scheduleData);
				if (attachment != null) {
					const formData = new FormData();
					formData.append("file", attachment);
					await api.post(
						`/schedules/${scheduleId}/media-upload`,
						formData
					);
				}
			} else {
				const { data } = await api.post("/schedules", scheduleData);
				if (attachment != null) {
					const formData = new FormData();
					formData.append("file", attachment);
					await api.post(`/schedules/${data.id}/media-upload`, formData);
				}
			}
			toast.success(i18n.t("scheduleModal.success"));
			if (typeof reload == 'function') {
				reload();
			}
			if (contactId) {
				if (typeof cleanContact === 'function') {
					cleanContact();
					history.push('/schedules');
				}
			}
		} catch (err) {
			toastError(err);
		}
		setCurrentContact(initialContact);
		setSchedule(initialState);
		setSelectedWhatsapps("");
		handleClose();
	};
	const handleClickMsgVar = async (msgVar, setValueFunc) => {
		const el = messageInputRef.current;
		const firstHalfText = el.value.substring(0, el.selectionStart);
		const secondHalfText = el.value.substring(el.selectionEnd);
		const newCursorPos = el.selectionStart + msgVar.length;

		setValueFunc("body", `${firstHalfText}${msgVar}${secondHalfText}`);

		await new Promise(r => setTimeout(r, 100));
		messageInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
	};

	const deleteMedia = async () => {
		if (attachment) {
			setAttachment(null);
			attachmentFile.current.value = null;
		}

		if (schedule.mediaPath) {
			await api.delete(`/schedules/${schedule.id}/media-upload`);
			setSchedule((prev) => ({
				...prev,
				mediaPath: null,
			}));
			toast.success(i18n.t("scheduleModal.toasts.deleted"));
			if (typeof reload == "function") {
				console.log(reload);
				console.log("1");
				reload();
			}
		}
	};

	return (
		<div className={classes.root}>
			<ConfirmationModal
				title={i18n.t("scheduleModal.confirmationModal.deleteTitle")}
				open={confirmationOpen}
				onClose={() => setConfirmationOpen(false)}
				onConfirm={deleteMedia}
			>
				{i18n.t("scheduleModal.confirmationModal.deleteMessage")}
			</ConfirmationModal>
			<Dialog
				open={open}
				onClose={handleClose}
				maxWidth="md"
				fullWidth
				scroll="paper"
				PaperProps={{ className: classes.dialogPaper }}
			>
				<DialogTitle id="form-dialog-title" className={classes.dialogTitle}>
					<Box display="flex" alignItems="center" justifyContent="space-between">
						<Box display="flex" alignItems="center" style={{ gap: 8 }}>
							<EventAvailableIcon className={classes.dialogTitleIcon} />
							<span>{scheduleId ? "Editar Agendamento" : "Novo Agendamento"}</span>
						</Box>
						{schedule.status ? (
							<Chip
								label={schedule.status === "ERRO" ? "Erro de Envio" : capitalize(schedule.status)}
								size="small"
								className={schedule.status === "ERRO" ? classes.statusChipERRO : classes.statusChipOther}
							/>
						) : null}
					</Box>
				</DialogTitle>
				<div style={{ display: "none" }}>
					<input
						type="file"
						accept=".png,.jpg,.jpeg"
						ref={attachmentFile}
						onChange={(e) => handleAttachmentFile(e)}
					/>
				</div>
				<Formik
					initialValues={schedule}
					enableReinitialize={true}
					validationSchema={ScheduleSchema}
					onSubmit={(values, actions) => {
						setTimeout(() => {
							handleSaveSchedule(values);
							actions.setSubmitting(false);
						}, 400);
					}}
				>
					{({ touched, errors, isSubmitting, values, setFieldValue }) => (
						<Form>
							<DialogContent dividers className={classes.dialogContent}>

								{/* ── Seção 1: Contato & Mensagem ── */}
								<Box className={classes.formSection}>
									<div className={classes.formSectionLabel}>
										<span className={classes.formSectionLabelDot} />
										Contato &amp; Mensagem
									</div>
									<FormControl variant="outlined" fullWidth>
										<Autocomplete
											fullWidth
											value={currentContact}
											options={contacts}
											onChange={(e, contact) => {
												const contactId = contact ? contact.id : '';
												setSchedule({ ...schedule, contactId });
												setCurrentContact(contact ? contact : initialContact);
												setChannelFilter(contact ? contact.channel : "whatsapp");
											}}
											getOptionLabel={(option) => option.name}
											renderOption={renderOption}
											getOptionSelected={(option, value) => value.id === option.id}
											renderInput={(params) => (
												<TextField {...params} variant="outlined" label="Contato" />
											)}
										/>
									</FormControl>
									<Field
										as={TextField}
										minRows={7}
										multiline={true}
										label={i18n.t("scheduleModal.form.body")}
										name="body"
										inputRef={messageInputRef}
										error={touched.body && Boolean(errors.body)}
										helperText={touched.body && errors.body}
										variant="outlined"
										margin="dense"
										fullWidth
									/>
									<MessageVariablesPicker
										disabled={isSubmitting}
										onClick={value => handleClickMsgVar(value, setFieldValue)}
									/>
								</Box>

								{/* ── Seção 2: Configurações de Envio ── */}
								<Box className={classes.formSection}>
									<div className={classes.formSectionLabel}>
										<span className={classes.formSectionLabelDot} style={{ backgroundColor: "#6366f1" }} />
										Configurações de Envio
									</div>
									<Grid container spacing={1}>
										<Grid item xs={12} md={6}>
											<FormControl variant="outlined" margin="dense" fullWidth>
												<InputLabel id="whatsapp-selection-label">
													{i18n.t("campaigns.dialog.form.whatsapp")}
												</InputLabel>
												<Field
													as={Select}
													label={i18n.t("campaigns.dialog.form.whatsapp")}
													labelId="whatsapp-selection-label"
													id="whatsappIds"
													name="whatsappIds"
													required
													error={touched.whatsappId && Boolean(errors.whatsappId)}
													value={selectedWhatsapps || ""}
													onChange={(event) => setSelectedWhatsapps(event.target.value)}
												>
													<MenuItem value="">Nenhuma</MenuItem>
													{whatsapps && whatsapps.map((whatsapp) => (
														<MenuItem key={whatsapp.id} value={whatsapp.id}>
															{whatsapp.name}
														</MenuItem>
													))}
												</Field>
											</FormControl>
										</Grid>
										<Grid item xs={12} md={6}>
											<FormControl variant="outlined" margin="dense" fullWidth>
												<InputLabel id="openTicket-selection-label">
													{i18n.t("campaigns.dialog.form.openTicket")}
												</InputLabel>
												<Field
													as={Select}
													label={i18n.t("campaigns.dialog.form.openTicket")}
													labelId="openTicket-selection-label"
													id="openTicket"
													name="openTicket"
													error={touched.openTicket && Boolean(errors.openTicket)}
												>
													<MenuItem value={"enabled"}>{i18n.t("campaigns.dialog.form.enabledOpenTicket")}</MenuItem>
													<MenuItem value={"disabled"}>{i18n.t("campaigns.dialog.form.disabledOpenTicket")}</MenuItem>
												</Field>
											</FormControl>
										</Grid>
										<Grid item xs={12} md={6}>
											<Autocomplete
												style={{ marginTop: 4 }}
												variant="outlined"
												margin="dense"
												getOptionLabel={(option) => `${option.name}`}
												value={selectedUser}
												size="small"
												onChange={(e, newValue) => {
													setSelectedUser(newValue);
													if (newValue != null && Array.isArray(newValue.queues)) {
														if (newValue.queues.length === 1) {
															setSelectedQueue(newValue.queues[0].id);
														}
														setQueues(newValue.queues);
													} else {
														setQueues(allQueues);
														setSelectedQueue("");
													}
												}}
												options={options}
												filterOptions={filterOptions}
												freeSolo
												fullWidth
												disabled={values.openTicket === "disabled"}
												autoHighlight
												noOptionsText={i18n.t("transferTicketModal.noOptions")}
												loading={loading}
												renderOption={option => (<span><UserStatusIcon user={option} /> {option.name}</span>)}
												renderInput={(params) => (
													<TextField
														{...params}
														label={i18n.t("transferTicketModal.fieldLabel")}
														variant="outlined"
														onChange={(e) => setSearchParam(e.target.value)}
														InputProps={{
															...params.InputProps,
															endAdornment: (
																<React.Fragment>
																	{loading ? <CircularProgress color="inherit" size={20} /> : null}
																	{params.InputProps.endAdornment}
																</React.Fragment>
															),
														}}
													/>
												)}
											/>
										</Grid>
										<Grid item xs={12} md={6}>
											<FormControl variant="outlined" margin="dense" fullWidth>
												<InputLabel>{i18n.t("transferTicketModal.fieldQueueLabel")}</InputLabel>
												<Select
													value={selectedQueue}
													onChange={(e) => setSelectedQueue(e.target.value)}
													label={i18n.t("transferTicketModal.fieldQueuePlaceholder")}
													disabled={values.openTicket === "disabled"}
												>
													{queues.map((queue) => (
														<MenuItem key={queue.id} value={queue.id}>{queue.name}</MenuItem>
													))}
												</Select>
											</FormControl>
										</Grid>
										<Grid item xs={12} md={6}>
											<FormControl variant="outlined" margin="dense" fullWidth>
												<InputLabel id="statusTicket-selection-label">
													{i18n.t("campaigns.dialog.form.statusTicket")}
												</InputLabel>
												<Field
													as={Select}
													disabled={values.openTicket === "disabled"}
													label={i18n.t("campaigns.dialog.form.statusTicket")}
													labelId="statusTicket-selection-label"
													id="statusTicket"
													name="statusTicket"
													error={touched.statusTicket && Boolean(errors.statusTicket)}
												>
													<MenuItem value={"closed"}>{i18n.t("campaigns.dialog.form.closedTicketStatus")}</MenuItem>
													<MenuItem value={"open"}>{i18n.t("campaigns.dialog.form.openTicketStatus")}</MenuItem>
												</Field>
											</FormControl>
										</Grid>
										<Grid item xs={12} md={6}>
											<Field
												as={TextField}
												label={i18n.t("scheduleModal.form.sendAt")}
												type="datetime-local"
												name="sendAt"
												error={touched.sendAt && Boolean(errors.sendAt)}
												helperText={touched.sendAt && errors.sendAt}
												variant="outlined"
												fullWidth
												size="small"
												style={{ marginTop: 8 }}
											/>
										</Grid>
										<Grid item xs={12}>
											<FormControlLabel
												className={classes.switchLabel}
												control={
													<Field
														as={IOSSwitch}
														name="assinar"
														checked={values.assinar}
														disabled={values.openTicket === "disabled"}
													/>
												}
												label={i18n.t("scheduleModal.form.assinar")}
											/>
										</Grid>
									</Grid>
								</Box>

								{/* ── Seção 3: Recorrência ── */}
								<Box className={classes.formSection} style={{ marginBottom: 0 }}>
									<div className={classes.formSectionLabel}>
										<span className={classes.formSectionLabelDot} style={{ backgroundColor: "#f79009" }} />
										Recorrência
									</div>
									<Typography component="p" className={classes.sectionDescription} style={{ marginBottom: 12 }}>
										Envio recorrente com intervalo configurável. Para envio único, mantenha os valores padrão.
									</Typography>
									<Grid container spacing={1}>
										<Grid item xs={12} md={4}>
											<FormControl size="small" fullWidth variant="outlined">
												<InputLabel>Intervalo</InputLabel>
												<Select
													value={intervalo}
													onChange={(e) => setIntervalo(e.target.value || 1)}
													label="Intervalo"
												>
													<MenuItem value={1}>Dias</MenuItem>
													<MenuItem value={2}>Semanas</MenuItem>
													<MenuItem value={3}>Meses</MenuItem>
													<MenuItem value={4}>Minutos</MenuItem>
												</Select>
											</FormControl>
										</Grid>
										<Grid item xs={12} md={4}>
											<Field
												as={TextField}
												label="Valor do Intervalo"
												name="valorIntervalo"
												size="small"
												error={touched.valorIntervalo && Boolean(errors.valorIntervalo)}
												InputLabelProps={{ shrink: true }}
												variant="outlined"
												fullWidth
											/>
										</Grid>
										<Grid item xs={12} md={4}>
											<Field
												as={TextField}
												label="Enviar quantas vezes"
												name="enviarQuantasVezes"
												size="small"
												error={touched.enviarQuantasVezes && Boolean(errors.enviarQuantasVezes)}
												variant="outlined"
												fullWidth
											/>
										</Grid>
										<Grid item xs={12}>
											<FormControl size="small" fullWidth variant="outlined">
												<InputLabel>Dias não úteis</InputLabel>
												<Select
													value={tipoDias}
													onChange={(e) => setTipoDias(e.target.value || 4)}
													label="Dias não úteis"
												>
													<MenuItem value={4}>Enviar normalmente em dias não úteis</MenuItem>
													<MenuItem value={5}>Enviar um dia útil antes</MenuItem>
													<MenuItem value={6}>Enviar um dia útil depois</MenuItem>
												</Select>
											</FormControl>
										</Grid>
									</Grid>
								</Box>

								{(schedule.mediaPath || attachment) && (
									<Box style={{ marginTop: 12 }}>
										<Button startIcon={<AttachFile />}>
											{attachment ? attachment.name : schedule.mediaName}
										</Button>
										<IconButton onClick={() => setConfirmationOpen(true)} color="secondary">
											<DeleteOutline color="secondary" />
										</IconButton>
									</Box>
								)}
							</DialogContent>
							<DialogActions className={classes.dialogActions}>
								<Box className={classes.actionRow}>
									{!attachment && !schedule.mediaPath && (
										<Button
											color="primary"
											onClick={() => attachmentFile.current.click()}
											disabled={isSubmitting}
											variant="outlined"
											size="small"
										>
											{i18n.t("quickMessages.buttons.attach")}
										</Button>
									)}
									<div className="actions-spacer" style={{ flex: 1 }} />
									<Button
										onClick={handleClose}
										color="secondary"
										disabled={isSubmitting}
										variant="outlined"
									>
										{i18n.t("scheduleModal.buttons.cancel")}
									</Button>
									{(schedule.sentAt === null || schedule.sentAt === "") && (
										<div className={classes.btnWrapper}>
											<Button
												type="submit"
												color="primary"
												disabled={isSubmitting}
												variant="contained"
											>
												{scheduleId
													? `${i18n.t("scheduleModal.buttons.okEdit")}`
													: `${i18n.t("scheduleModal.buttons.okAdd")}`}
												{isSubmitting && (
													<CircularProgress
														size={24}
														className={classes.buttonProgress}
													/>
												)}
											</Button>
										</div>
									)}
								</Box>
							</DialogActions>
						</Form>
					)}
				</Formik>
			</Dialog>
		</div>
	);
};

export default ScheduleModal;
