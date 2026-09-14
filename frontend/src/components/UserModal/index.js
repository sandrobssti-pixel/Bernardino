import React, { useState, useEffect, useContext, useRef } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles, withStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import Select from "@material-ui/core/Select";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import Switch from "@material-ui/core/Switch";
import Typography from "@material-ui/core/Typography";
import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import QueueSelect from "../QueueSelect";
import { AuthContext } from "../../context/Auth/AuthContext";
import useWhatsApps from "../../hooks/useWhatsApps";

import { Can } from "../Can";
import { Grid, Paper, Tab, Tabs } from "@material-ui/core";
import TabPanel from "../TabPanel";
import AvatarUploader from "../AvatarUpload";
import AccessTimeIcon from "@material-ui/icons/AccessTime";

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		flexWrap: "wrap",
	},
	multFieldLine: {
		display: "flex",
		"& > *:not(:last-child)": {
			marginRight: theme.spacing(1),
		},
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
	formControl: {
		margin: theme.spacing(1),
		minWidth: 120,
	},
	textField: {
		marginRight: theme.spacing(1),
		flex: 1,
	},
	workTimeIcon: {
		color: theme.palette.primary.main,
		fontSize: 18,
	},
	timeField: {
		"& input[type='time']::-webkit-calendar-picker-indicator": {
			opacity: 0,
			display: "none",
			WebkitAppearance: "none",
		},
		"& input[type='time']::-webkit-clear-button": {
			display: "none",
		},
		"& input[type='time']::-webkit-inner-spin-button": {
			display: "none",
		},
	},
	container: {
		display: 'flex',
		flexWrap: 'wrap',
	},
	avatar: {
		width: theme.spacing(12),
		height: theme.spacing(12),
		margin: theme.spacing(2),
		cursor: 'pointer',
		borderRadius: '50%',
		border: '2px solid #ccc',
	},
	updateDiv: {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
	},
	updateInput: {
		display: 'none',
	},
	updateLabel: {
		padding: theme.spacing(1),
		margin: theme.spacing(1),
		textTransform: 'uppercase',
		textAlign: 'center',
		cursor: 'pointer',
		border: '2px solid #ccc',
		borderRadius: '5px',
		minWidth: 160,
		fontWeight: 'bold',
		color: '#555',
	},
	errorUpdate: {
		border: '2px solid red',
	},
	errorText: {
		color: 'red',
		fontSize: '0.8rem',
		fontWeight: 'bold',
	},
	securityToggleRow: {
		border: `1px solid ${theme.palette.divider}`,
		borderRadius: 10,
		padding: theme.spacing(1.1, 1.25),
		backgroundColor: theme.palette.background.paper,
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing(1),
	},
	securityToggleLabel: {
		fontWeight: 600,
		fontSize: "0.86rem",
		color: theme.palette.text.primary,
	},
	securityToggleState: {
		fontSize: "0.74rem",
		color: theme.palette.text.secondary,
	},
	permissionField: {
		border: `1px solid ${theme.palette.divider}`,
		borderRadius: 10,
		padding: theme.spacing(1.1, 1.25),
		backgroundColor: theme.palette.background.paper,
		height: "100%",
		display: "flex",
		flexDirection: "column",
		alignItems: "stretch",
		justifyContent: "space-between",
		gap: theme.spacing(1),
	},
	permissionFieldDanger: {
		borderColor: "rgba(239,68,68,0.35)",
	},
	permissionLabel: {
		fontWeight: 600,
		fontSize: "0.85rem",
		color: theme.palette.text.primary,
		lineHeight: 1.25,
		textAlign: "left",
	},
	permissionDescription: {
		fontSize: "0.74rem",
		color: theme.palette.text.secondary,
		lineHeight: 1.3,
		textAlign: "left",
		marginTop: 2,
	},
	segmentedToggle: {
		position: "relative",
		display: "flex",
		alignItems: "center",
		backgroundColor: theme.mode === "light" ? "#f3f4f6" : "#374151",
		padding: 4,
		borderRadius: 8,
		height: 40,
		cursor: "pointer",
		userSelect: "none",
		boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.08)",
		transition: "transform 0.12s ease",
		"&:active": {
			transform: "scale(0.985)",
		},
		"&:hover": {
			filter: "brightness(0.985)",
		}
	},
	segmentedSlider: {
		position: "absolute",
		top: 4,
		left: 4,
		width: "calc(50% - 4px)",
		height: "calc(100% - 8px)",
		borderRadius: 6,
		transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease",
		zIndex: 1,
		boxShadow: "0 2px 4px rgba(0, 0, 0, 0.12)",
	},
	segmentedSliderEnabled: {
		transform: "translateX(0)",
		backgroundColor: "#22c55e",
	},
	segmentedSliderDisabled: {
		transform: "translateX(100%)",
		backgroundColor: "#9ca3af",
	},
	segmentedOption: {
		flex: 1,
		textAlign: "center",
		fontSize: "0.8rem",
		fontWeight: 700,
		zIndex: 2,
		transition: "color 0.25s ease",
	},
	segmentedOptionInactive: {
		color: theme.mode === "light" ? "#6b7280" : "#d1d5db",
	},
	segmentedOptionActive: {
		color: "#ffffff",
	},
	segmentedOptionEnabled: {
		paddingLeft: 2
	},
	segmentedOptionDisabled: {
		paddingRight: 2
	},
}));

const IOSSwitch = withStyles((theme) => ({
	root: {
		width: 42,
		height: 26,
		padding: 0,
	},
	switchBase: {
		padding: 1,
		"&$checked": {
			transform: "translateX(16px)",
			color: theme.palette.common.white,
			"& + $track": {
				backgroundColor: "#22c55e",
				opacity: 1,
				border: "none",
			},
		},
	},
	thumb: {
		width: 24,
		height: 24,
	},
	track: {
		borderRadius: 26 / 2,
		border: `1px solid ${theme.palette.divider}`,
		backgroundColor: theme.mode === "light" ? "#d1d5db" : "#4b5563",
		opacity: 1,
		transition: theme.transitions.create(["background-color", "border"]),
	},
	checked: {},
}))(Switch);

const UserSchema = Yup.object().shape({
	name: Yup.string()
		.min(2, "Too Short!")
		.max(50, "Too Long!")
		.required("Required"),
	password: Yup.string().min(5, "Too Short!").max(50, "Too Long!"),
	email: Yup.string().email("Invalid email").required("Required"),
	allHistoric: Yup.string().nullable(),
});

const UserModal = ({ open, onClose, userId }) => {
	const classes = useStyles();

	const initialState = {
		name: "",
		email: "",
		password: "",
		profile: "user",
		super: false,
		startWork: "00:00",
		endWork: "23:59",
		farewellMessage: "",
		allTicket: "enable",
		allowGroup: false,
		defaultTheme: "light",
		defaultMenu: "open",
		allHistoric: "disabled",
		allUserChat: "disabled",
		userClosePendingTicket: "enabled",
		canDeleteTickets: "disabled",
		showDashboard: "disabled",
		allowRealTime: "disabled",
		allowConnections: "disabled",
		// PERMISSÃO NOVA
		canViewAllContacts: false,
		// Acesso ao módulo Financeiro (add-on liberado pelo Master via plano) —
		// concedido usuário a usuário pelo Admin da empresa.
		financialAccess: false,
		blockMultipleLogins: true,
		birthDate: "",
	};

	const { user: loggedInUser } = useContext(AuthContext);

	const [user, setUser] = useState(initialState);
	const [selectedQueueIds, setSelectedQueueIds] = useState([]);
	const [whatsappId, setWhatsappId] = useState("");
	const { whatsApps } = useWhatsApps();
	const [tab, setTab] = useState("general");
	const [avatar, setAvatar] = useState(null);
	const startWorkRef = useRef();
	const endWorkRef = useRef();

	useEffect(() => {
		const fetchUser = async () => {

			if (!userId) return;
				try {
					const { data } = await api.get(`/users/${userId}`);

					const userData = {
						...data,
						name: data?.name ?? "",
						email: data?.email ?? "",
						password: "",
						startWork: data?.startWork ?? "00:00",
						endWork: data?.endWork ?? "23:59",
						farewellMessage: data?.farewellMessage ?? "",
						canDeleteTickets: data?.canDeleteTickets ?? "disabled",
						canViewAllContacts: !!data.canViewAllContacts,
						financialAccess: !!data.financialAccess,
						super: !!data?.super,
						blockMultipleLogins: data?.blockMultipleLogins !== false,
						birthDate: data?.birthDate ? String(data.birthDate).split("T")[0] : ""
					};

					setUser(prevState => {
						return { ...prevState, ...userData };
				});

					const userQueueIds = data.queues?.map(queue => queue.id);
				setSelectedQueueIds(userQueueIds);
				setWhatsappId(data.whatsappId ? data.whatsappId : '');
			} catch (err) {
				toastError(err);
			}
		};

		fetchUser();
	}, [userId, open]);

	const handleClose = () => {
		onClose();
		setUser(initialState);
		setWhatsappId("");
	};

	const handleTabChange = (event, newValue) => {
		setTab(newValue);
	};

	const handleSaveUser = async (values) => {
		const uploadAvatar = async (file) => {
		  try {
			const formData = new FormData();
			formData.append("userId", file.id);
			formData.append("typeArch", "user");
			formData.append("profileImage", avatar);
	  
			const { data } = await api.post(`/users/${file.id}/media-upload`, formData);
			localStorage.setItem("profileImage", data.user.profileImage);
		  } catch (err) {
			toastError(err);
		  }
		};
	  
		const userData = {
		  ...values,
		  whatsappId,
		  queueIds: selectedQueueIds,
		  birthDate: values.birthDate || null
		};
	  
		console.log("DADOS SENDO ENVIADOS PARA A API AO SALVAR:", userData); // LOG 3

		try {
		  if (userId) {
			const { data } = await api.put(`/users/${userId}`, userData);
	  
			if (avatar && (!user?.profileImage || user?.profileImage !== avatar.name)) {
			  await uploadAvatar(data);
			}
		  } else {
			const { data } = await api.post("/users", userData);
	  
			if (avatar) {
			  await uploadAvatar(data);
			}
		  }
	  
		  if (userId === loggedInUser.id) {
			handleClose();
			toast.success(i18n.t("userModal.success"));
			window.location.reload();
		  } else {
			handleClose();
			toast.success(i18n.t("userModal.success"));
		  }
		} catch (err) {
		  toastError(err);
		}
	  };

	const isPermissionEnabled = (values, fieldName) => {
		if (fieldName === "allowGroup" || fieldName === "canViewAllContacts" || fieldName === "financialAccess") {
			return !!values[fieldName];
		}
		if (fieldName === "allTicket") {
			return values[fieldName] === "enable";
		}
		return values[fieldName] === "enabled";
	};

	const togglePermission = (fieldName, checked, setFieldValue) => {
		if (fieldName === "allowGroup" || fieldName === "canViewAllContacts" || fieldName === "financialAccess") {
			setFieldValue(fieldName, checked);
			return;
		}
		if (fieldName === "allTicket") {
			setFieldValue(fieldName, checked ? "enable" : "disable");
			return;
		}
		setFieldValue(fieldName, checked ? "enabled" : "disabled");
	};

	const permissionContent = {
		canViewAllContacts: {
			label: "Ver todos os contatos",
			description: "Acessa todos os contatos da empresa.",
		},
		financialAccess: {
			label: "Módulo Financeiro",
			description: "Acessa cadastros de clientes, fornecedores e produtos (só tem efeito se o plano da empresa incluir o módulo).",
		},
		allTicket: {
			label: "Tickets sem fila",
			description: "Mostra tickets sem fila definida.",
		},
		allowGroup: {
			label: "Permitir grupos",
			description: "Permite atendimento em grupos.",
		},
		allHistoric: {
			label: "Ver conversas de outras filas",
			description: "Mostra histórico de outras filas.",
		},
		allUserChat: {
			label: "Ver conversas de outros usuários",
			description: "Mostra tickets de outros atendentes.",
		},
		canDeleteTickets: {
			label: "Excluir conversa",
			description: "Permite excluir tickets e conversas.",
		},
		userClosePendingTicket: {
			label: "Fechar ticket pendente",
			description: "Permite fechar tickets pendentes.",
		},
		allowConnections: {
			label: "Ações nas conexões",
			description: "Permite gerenciar conexões.",
		},
		showDashboard: {
			label: "Ver dashboard",
			description: "Permite acesso ao Dashboard.",
		},
		allowRealTime: {
			label: "Ver painel em tempo real",
			description: "Permite acesso ao menu Gerência > Painel.",
		},
	};

	const renderPermissionButtonField = ({
		fieldName,
		label,
		description,
		values,
		setFieldValue,
		danger = false
	}) => {
		const enabled = isPermissionEnabled(values, fieldName);
		return (
			<div
				key={fieldName}
				className={`${classes.permissionField} ${danger ? classes.permissionFieldDanger : ""}`}
			>
				<div>
					<Typography className={classes.permissionLabel}>{label}</Typography>
					<Typography className={classes.permissionDescription}>{description}</Typography>
				</div>
				<div
					className={classes.segmentedToggle}
					onClick={() => togglePermission(fieldName, !enabled, setFieldValue)}
					role="button"
					tabIndex={0}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							togglePermission(fieldName, !enabled, setFieldValue);
						}
					}}
				>
					<div
						className={`${classes.segmentedSlider} ${enabled ? classes.segmentedSliderEnabled : classes.segmentedSliderDisabled}`}
					/>
					<div
						className={`${classes.segmentedOption} ${classes.segmentedOptionEnabled} ${enabled ? classes.segmentedOptionActive : classes.segmentedOptionInactive}`}
					>
						Habilitado
					</div>
					<div
						className={`${classes.segmentedOption} ${classes.segmentedOptionDisabled} ${!enabled ? classes.segmentedOptionActive : classes.segmentedOptionInactive}`}
					>
						Desabilitado
					</div>
				</div>
			</div>
		);
	};
	  
	return (
		<div className={classes.root}>
			<Dialog
				open={open}
				onClose={handleClose}
				maxWidth="sm"
				fullWidth
				scroll="paper"
			>
				<DialogTitle id="form-dialog-title">
					{userId
						? `${i18n.t("userModal.title.edit")}`
						: `${i18n.t("userModal.title.add")}`}
				</DialogTitle>
				<Formik
					initialValues={user}
					enableReinitialize={true}
					validationSchema={UserSchema}
					onSubmit={(values, actions) => {
						setTimeout(() => {
							handleSaveUser(values);
							actions.setSubmitting(false);
						}, 400);
					}}
				>
					{({ touched, errors, isSubmitting, setFieldValue, values }) => (
						<Form>
							<Paper className={classes.mainPaper} elevation={1}>
								<Tabs
									value={tab}
									indicatorColor="primary"
									textColor="primary"
									scrollButtons="on"
									variant="scrollable"
									onChange={handleTabChange}
									className={classes.tab}
								>
									<Tab label={i18n.t("userModal.tabs.general")} value={"general"} />
									<Tab label={i18n.t("userModal.tabs.permissions")} value={"permissions"} />
								</Tabs>
							</Paper>
							<Paper className={classes.paper} elevation={0}>
								<DialogContent dividers>
									<TabPanel
										className={classes.container}
										value={tab}
										name={"general"}
									>
										<Grid
											container
											spacing={1}
											alignContent="center"
											alignItems="center"
											justifyContent="center">
											<FormControl className={classes.updateDiv}>
												<AvatarUploader
													setAvatar={setAvatar}
													avatar={user.profileImage}
													companyId={user.companyId}
												/>
												{user.profileImage &&
													<Button
														variant="outlined"
														color="secondary"
														onClick={() => {
															user.profileImage = null;
															setFieldValue("profileImage", null);
															setAvatar(null);
														}}
													>
														{i18n.t("userModal.title.removeImage")}
													</Button>
												}
											</FormControl>
										</Grid>
										<Grid container spacing={1}>
											<Grid item xs={12} md={6} xl={6}>
												<Field
													as={TextField}
													label={i18n.t("userModal.form.name")}
													autoFocus
													name="name"
													error={touched.name && Boolean(errors.name)}
													helperText={touched.name && errors.name}
													variant="outlined"
													margin="dense"
													fullWidth
												/>
											</Grid>
											<Grid item xs={12} md={6} xl={6}>
												<Field
													as={TextField}
													label={i18n.t("userModal.form.password")}
													type="password"
													name="password"
													error={touched.password && Boolean(errors.password)}
													helperText={touched.password && errors.password}
													variant="outlined"
													margin="dense"
													fullWidth
												/>
											</Grid>
										</Grid>
										<Grid container spacing={1}>
											<Grid item xs={12} md={8} xl={8}>
												<Field
													as={TextField}
													label={i18n.t("userModal.form.email")}
													name="email"
													error={touched.email && Boolean(errors.email)}
													helperText={touched.email && errors.email}
													variant="outlined"
													margin="dense"
													fullWidth
												/>
											</Grid>
											<Grid item xs={12} md={4} xl={4}>
												<FormControl
													variant="outlined"
													//className={classes.formControl}
													margin="dense"
													fullWidth
												>
													<Can
														role={loggedInUser.profile}
														perform="user-modal:editProfile"
														yes={() => (
															<>
																<InputLabel id="profile-selection-input-label">
																	{i18n.t("userModal.form.profile")}
																</InputLabel>

																<Select
																	label={i18n.t("userModal.form.profile")}
																	labelId="profile-selection-label"
																	id="profile-selection"
																	required
																	value={values.super ? "master" : (values.profile || "user")}
																	disabled={!loggedInUser.super && !!user.super}
																	onChange={(e) => {
																		const selected = e.target.value;
																		if (selected === "master") {
																			setFieldValue("profile", "admin");
																			setFieldValue("super", true);
																		} else {
																			setFieldValue("profile", selected);
																			setFieldValue("super", false);
																		}
																	}}
																>
																	<MenuItem value="master" disabled={!loggedInUser.super}>
																		Master
																	</MenuItem>
																	<MenuItem value="admin">Admin</MenuItem>
																	<MenuItem value="user">User</MenuItem>
																</Select>
															</>
														)}
													/>
												</FormControl>
											</Grid>
										</Grid>
										<Grid container spacing={1}>
													<Grid item xs={12} md={12} xl={12}>
												<div className={classes.securityToggleRow}>
													<div>
														<Typography className={classes.securityToggleLabel}>
															{i18n.t("userModal.form.blockMultipleLogins")}
														</Typography>
														<Typography className={classes.securityToggleState}>
															{values.blockMultipleLogins ? "Habilitado" : "Desabilitado"}
														</Typography>
													</div>
													<IOSSwitch
														checked={!!values.blockMultipleLogins}
														onChange={(e) =>
															setFieldValue(
																"blockMultipleLogins",
																e.target.checked
															)
														}
														name="blockMultipleLogins"
													/>
												</div>
											</Grid>
										</Grid>
										<Grid container spacing={1}>
											<Grid item xs={12} md={6} xl={6}>
												<Field
													as={TextField}
													label="Data de Nascimento"
													type="date"
													name="birthDate"
													InputLabelProps={{ shrink: true }}
													fullWidth
													variant="outlined"
													margin="dense"
													className={classes.textField}
												/>
											</Grid>
										</Grid>
										<Grid container spacing={1}>
											<Grid item xs={12} md={12} xl={12}>
												<Can
													role={loggedInUser.profile}
													perform="user-modal:editQueues"
													yes={() => (
														<QueueSelect
															selectedQueueIds={selectedQueueIds}
															onChange={values => setSelectedQueueIds(values)}
															fullWidth
														/>
													)}
												/>
											</Grid>
										</Grid>
										<Grid container spacing={1}>
											<Grid item xs={12} md={12} xl={12}>
												<Can
													role={loggedInUser.profile}
													perform="user-modal:editProfile"
													yes={() => (
														<FormControl variant="outlined" margin="dense" className={classes.maxWidth} fullWidth>
															<InputLabel>
																{i18n.t("userModal.form.whatsapp")}
															</InputLabel>
															<Field
																as={Select}
																value={whatsappId}
																onChange={(e) => setWhatsappId(e.target.value)}
																label={i18n.t("userModal.form.whatsapp")}

															>
																<MenuItem value={''}>&nbsp;</MenuItem>
																{whatsApps.map((whatsapp) => (
																	<MenuItem key={whatsapp.id} value={whatsapp.id}>{whatsapp.name}</MenuItem>
																))}
															</Field>
														</FormControl>
													)}
												/>
											</Grid>
										</Grid>
										<Can
											role={loggedInUser.profile}
											perform="user-modal:editProfile"
											yes={() => (
												<Grid container spacing={1}>
													<Grid item xs={12} md={6} xl={6}>
														<Field
															as={TextField}
															label={i18n.t("userModal.form.startWork")}
															type="time"
															ampm={"false"}
															inputRef={startWorkRef}
															InputLabelProps={{
																shrink: true,
															}}
															inputProps={{
																step: 600, // 5 min
															}}
															InputProps={{
																endAdornment: (
																	<InputAdornment position="end">
																		<AccessTimeIcon className={classes.workTimeIcon} />
																	</InputAdornment>
																),
															}}
															fullWidth
															name="startWork"
															error={
																touched.startWork && Boolean(errors.startWork)
															}
															helperText={
																touched.startWork && errors.startWork
															}
															variant="outlined"
															margin="dense"
															className={`${classes.textField} ${classes.timeField}`}
														/>
													</Grid>
													<Grid item xs={12} md={6} xl={6}>
														<Field
															as={TextField}
															label={i18n.t("userModal.form.endWork")}
															type="time"
															ampm={"false"}
															inputRef={endWorkRef}
															InputLabelProps={{
																shrink: true,
															}}
															inputProps={{
																step: 600, // 5 min
															}}
															InputProps={{
																endAdornment: (
																	<InputAdornment position="end">
																		<AccessTimeIcon className={classes.workTimeIcon} />
																	</InputAdornment>
																),
															}}
															fullWidth
															name="endWork"
															error={
																touched.endWork && Boolean(errors.endWork)
															}
															helperText={
																touched.endWork && errors.endWork
															}
															variant="outlined"
															margin="dense"
															className={`${classes.textField} ${classes.timeField}`}
														/>
													</Grid>
												</Grid>
											)}
										/>

										<Field
											as={TextField}
											label={i18n.t("userModal.form.farewellMessage")}
											type="farewellMessage"
											multiline
											minRows={4}
											fullWidth
											name="farewellMessage"
											error={touched.farewellMessage && Boolean(errors.farewellMessage)}
											helperText={touched.farewellMessage && errors.farewellMessage}
											variant="outlined"
											margin="dense"
										/>

														<Grid container spacing={1}>
															<Grid item xs={12} md={6} xl={6}>
																<FormControl
																	variant="outlined"
																	className={classes.maxWidth}
													margin="dense"
													fullWidth
												>
													<>
														<InputLabel >
															{i18n.t("userModal.form.defaultTheme")}
														</InputLabel>

														<Field
															as={Select}
															label={i18n.t("userModal.form.defaultTheme")}
															name="defaultTheme"
															type="defaultTheme"
															required
														>
															<MenuItem value="light">{i18n.t("userModal.form.defaultThemeLight")}</MenuItem>
															<MenuItem value="dark">{i18n.t("userModal.form.defaultThemeDark")}</MenuItem>
														</Field>
													</>
												</FormControl>
											</Grid>
											<Grid item xs={12} md={6} xl={6}>

												<FormControl
													variant="outlined"
													className={classes.maxWidth}
													margin="dense"
													fullWidth
												>
													<>
														<InputLabel >
															{i18n.t("userModal.form.defaultMenu")}
														</InputLabel>

														<Field
															as={Select}
															label={i18n.t("userModal.form.defaultMenu")}
															name="defaultMenu"
															type="defaultMenu"
															required
														>
															<MenuItem value={"open"}>{i18n.t("userModal.form.defaultMenuOpen")}</MenuItem>
															<MenuItem value={"closed"}>{i18n.t("userModal.form.defaultMenuClosed")}</MenuItem>
														</Field>
													</>
												</FormControl>
											</Grid>
										</Grid>
									</TabPanel>
									<TabPanel
										className={classes.container}
										value={tab}
										name={"permissions"}
									>
										<Can
											role={loggedInUser.profile}
											perform="user-modal:editProfile"
											yes={() => (
												<Grid container spacing={1}>
													<Grid item xs={12} md={6}>
														{renderPermissionButtonField({
															fieldName: "canViewAllContacts",
															label: permissionContent.canViewAllContacts.label,
															description: permissionContent.canViewAllContacts.description,
															values,
															setFieldValue
														})}
													</Grid>
													<Grid item xs={12} md={6}>
														{renderPermissionButtonField({
															fieldName: "financialAccess",
															label: permissionContent.financialAccess.label,
															description: permissionContent.financialAccess.description,
															values,
															setFieldValue
														})}
													</Grid>
													<Grid item xs={12} md={6}>
														{renderPermissionButtonField({
															fieldName: "allTicket",
															label: permissionContent.allTicket.label,
															description: permissionContent.allTicket.description,
															values,
															setFieldValue
														})}
													</Grid>
													<Grid item xs={12} md={6}>
														{renderPermissionButtonField({
															fieldName: "allowGroup",
															label: permissionContent.allowGroup.label,
															description: permissionContent.allowGroup.description,
															values,
															setFieldValue
														})}
													</Grid>
													<Grid item xs={12} md={6}>
														{renderPermissionButtonField({
															fieldName: "allHistoric",
															label: permissionContent.allHistoric.label,
															description: permissionContent.allHistoric.description,
															values,
															setFieldValue
														})}
													</Grid>
													<Grid item xs={12} md={6}>
														{renderPermissionButtonField({
															fieldName: "allUserChat",
															label: permissionContent.allUserChat.label,
															description: permissionContent.allUserChat.description,
															values,
															setFieldValue
														})}
													</Grid>
													<Grid item xs={12} md={6}>
														{renderPermissionButtonField({
															fieldName: "canDeleteTickets",
															label: permissionContent.canDeleteTickets.label,
															description: permissionContent.canDeleteTickets.description,
															values,
															setFieldValue,
															danger: true
														})}
													</Grid>
													<Grid item xs={12} md={6}>
														{renderPermissionButtonField({
															fieldName: "userClosePendingTicket",
															label: permissionContent.userClosePendingTicket.label,
															description: permissionContent.userClosePendingTicket.description,
															values,
															setFieldValue
														})}
													</Grid>
													<Grid item xs={12} md={6}>
														{renderPermissionButtonField({
															fieldName: "allowConnections",
															label: permissionContent.allowConnections.label,
															description: permissionContent.allowConnections.description,
															values,
															setFieldValue
														})}
													</Grid>
													<Grid item xs={12} md={6}>
														{renderPermissionButtonField({
															fieldName: "showDashboard",
															label: permissionContent.showDashboard.label,
															description: permissionContent.showDashboard.description,
															values,
															setFieldValue
														})}
													</Grid>
													<Grid item xs={12} md={6}>
														{renderPermissionButtonField({
															fieldName: "allowRealTime",
															label: permissionContent.allowRealTime.label,
															description: permissionContent.allowRealTime.description,
															values,
															setFieldValue
														})}
													</Grid>
												</Grid>
											)}
										/>
									</TabPanel>
								</DialogContent>
							</Paper>
							<DialogActions>
								<Button
									onClick={handleClose}
									color="secondary"
									disabled={isSubmitting}
									variant="outlined"
								>
									{i18n.t("userModal.buttons.cancel")}
								</Button>
								<Button
									type="submit"
									color="primary"
									disabled={isSubmitting}
									variant="contained"
									className={classes.btnWrapper}
								>
									{userId
										? `${i18n.t("userModal.buttons.okEdit")}`
										: `${i18n.t("userModal.buttons.okAdd")}`}
									{isSubmitting && (
										<CircularProgress
											size={24}
											className={classes.buttonProgress}
										/>
									)}
								</Button>
							</DialogActions>
						</Form>
					)}
				</Formik>
			</Dialog>
		</div >
	);
};

export default UserModal;
