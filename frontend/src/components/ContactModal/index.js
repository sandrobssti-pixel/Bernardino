import React, { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import * as Yup from "yup";
import { Formik, FieldArray, Form, Field } from "formik";
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
import IconButton from "@material-ui/core/IconButton";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import CircularProgress from "@material-ui/core/CircularProgress";
import Switch from "@material-ui/core/Switch";
import MenuItem from "@material-ui/core/MenuItem";
import Alert from "@material-ui/lab/Alert";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { TagsContainer } from "../TagsContainer";
// import AsyncSelect from "../AsyncSelect";

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		flexWrap: "wrap",
	},
	dialogPaper: {
		borderRadius: 16,
		border: `1px solid ${theme.palette.divider}`,
		boxShadow: "0 20px 45px rgba(15, 23, 42, 0.22)",
		overflow: "hidden",
		display: "flex",
		flexDirection: "column",
		[theme.breakpoints.down("xs")]: {
			margin: theme.spacing(2),
			width: "calc(100% - 32px)",
			maxHeight: "92vh",
			borderRadius: 10,
		},
	},
	formRoot: {
		display: "flex",
		flexDirection: "column",
		flex: "1 1 auto",
		minHeight: 0,
	},
	dialogTitle: {
		padding: theme.spacing(2, 2.5),
		fontWeight: 700,
		fontSize: "1.05rem",
		color: theme.palette.text.primary,
		background: theme.mode === "light"
			? "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)"
			: theme.palette.background.paper,
		borderBottom: `1px solid ${theme.palette.divider}`,
		[theme.breakpoints.down("xs")]: {
			fontSize: "0.95rem",
			padding: theme.spacing(1.25, 1.5),
		},
	},
	dialogContent: {
		padding: theme.spacing(2.25, 2.5),
		backgroundColor: theme.palette.background.paper,
		flex: "1 1 auto",
		minHeight: 0,
		overflowY: "auto",
		[theme.breakpoints.down("xs")]: {
			padding: theme.spacing(1.25, 1.5),
			WebkitOverflowScrolling: "touch",
		},
	},
	dialogActions: {
		padding: theme.spacing(1.5, 2.5, 2.25),
		borderTop: `1px solid ${theme.palette.divider}`,
		background: theme.mode === "light" ? "#fbfdff" : theme.palette.background.paper,
		flexShrink: 0,
		[theme.breakpoints.down("xs")]: {
			padding: theme.spacing(1, 1.5, 1.5),
			flexDirection: "column",
			alignItems: "stretch",
			"& > *": {
				marginLeft: "0 !important",
				width: "100%",
			},
			"& > *:not(:first-child)": {
				marginTop: theme.spacing(1),
			},
		},
	},
	sectionTitle: {
		fontWeight: 700,
		fontSize: "0.86rem",
		textTransform: "uppercase",
		letterSpacing: 0.4,
		color: theme.palette.text.secondary,
		marginBottom: theme.spacing(1.25),
	},
	fieldRow: {
		display: "flex",
		gap: theme.spacing(1.5),
		[theme.breakpoints.down("sm")]: {
			flexDirection: "column",
			gap: theme.spacing(1),
		},
	},
	fieldHalf: {
		flex: 1,
	},
	textField: {
		width: "100%",
		"& .MuiOutlinedInput-root": {
			borderRadius: 12,
			backgroundColor: theme.mode === "light" ? "#f8fafc" : theme.palette.background.default,
			transition: "all 0.2s ease",
			"& fieldset": {
				borderColor: theme.mode === "light" ? "#dbe5f0" : theme.palette.divider,
			},
			"&:hover fieldset": {
				borderColor: theme.mode === "light" ? "#c5d3e3" : theme.palette.primary.main,
			},
			"&.Mui-focused fieldset": {
				borderColor: theme.palette.primary.main,
			},
		},
		"& .MuiInputBase-input": {
			paddingTop: 12,
			paddingBottom: 12,
			fontSize: "0.92rem",
		},
		"& .MuiInputLabel-outlined": {
			fontSize: "0.88rem",
		},
	},

	extraAttr: {
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
		gap: theme.spacing(1),
		[theme.breakpoints.down("xs")]: {
			flexDirection: "column",
			alignItems: "stretch",
		},
	},
	switchRow: {
		display: "flex",
		alignItems: "center",
		border: `1px solid ${theme.palette.divider}`,
		borderRadius: 12,
		padding: theme.spacing(0.75, 1),
		marginTop: theme.spacing(1.5),
		marginBottom: theme.spacing(1.5),
		backgroundColor: theme.mode === "light" ? "#f8fafc" : theme.palette.background.default,
	},
	switchLabel: {
		fontSize: "0.88rem",
		fontWeight: 600,
		color: theme.palette.text.primary,
	},
	iosSwitch: {
		width: 44,
		height: 26,
		padding: 0,
		marginRight: theme.spacing(1),
	},
	iosSwitchBase: {
		padding: 2,
		transitionDuration: "200ms",
		"&$iosChecked": {
			transform: "translateX(18px)",
			color: "#fff",
			"& + $iosTrack": {
				backgroundColor: "#34c759",
				opacity: 1,
				border: "none",
			},
		},
		"&$iosFocusVisible $iosThumb": {
			border: "6px solid #fff",
		},
	},
	iosThumb: {
		width: 22,
		height: 22,
		boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
	},
	iosTrack: {
		borderRadius: 13,
		backgroundColor: theme.mode === "light" ? "#d1d1d6" : "#4b5563",
		opacity: 1,
		transition: theme.transitions.create(["background-color", "border"]),
	},
	iosChecked: {},
	iosFocusVisible: {},
	metaText: {
		marginBottom: theme.spacing(1),
		fontSize: "0.86rem",
		color: theme.palette.text.secondary,
	},
	secondaryButton: {
		borderRadius: 10,
		textTransform: "none",
		fontWeight: 600,
		fontSize: "0.85rem",
		[theme.breakpoints.down("xs")]: {
			fontSize: "0.82rem",
			minHeight: 38,
		},
	},
	primaryButton: {
		borderRadius: 10,
		textTransform: "none",
		fontWeight: 700,
		fontSize: "0.85rem",
		paddingLeft: theme.spacing(2),
		paddingRight: theme.spacing(2),
		boxShadow: "0 8px 18px rgba(37, 99, 235, 0.25)",
		[theme.breakpoints.down("xs")]: {
			fontSize: "0.82rem",
			minHeight: 38,
		},
	},
	addExtraButton: {
		flex: 1,
		marginTop: 8,
		borderRadius: 10,
		textTransform: "none",
		fontWeight: 600,
	},
	removeInfoButton: {
		borderRadius: 8,
		border: `1px solid ${theme.palette.divider}`,
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
}));

const buildContactSchema = requireFullRegistration =>
	Yup.object().shape({
		name: Yup.string()
			.min(2, "Too Short!")
			.max(250, "Too Long!")
			.required("Required"),
		number: Yup.string().min(8, "Too Short!").max(50, "Too Long!"),
		email: requireFullRegistration
			? Yup.string().email("Invalid email").required("Required")
			: Yup.string().email("Invalid email"),
		document: requireFullRegistration
			? Yup.string().required("Required")
			: Yup.string(),
		address: requireFullRegistration
			? Yup.string().required("Required")
			: Yup.string(),
		contact2: requireFullRegistration
			? Yup.string().required("Required")
			: Yup.string(),
	});

const ContactModal = ({
	open,
	onClose,
	contactId,
	initialValues,
	onSave,
	ticketId,
	requireFullRegistration,
}) => {
	const classes = useStyles();
	const isMounted = useRef(true);

	const initialState = {
		name: "",
		number: "",
		email: "",
		document: "",
		address: "",
		contact2: "",
		disableBot: false,
		lgpdAcceptedAt: "",
		birthDate: ""
	};

	const [contact, setContact] = useState(initialState);
	const [disableBot, setDisableBot] = useState(false);
	const [pendingTags, setPendingTags] = useState([]);
	const [kanbanTags, setKanbanTags] = useState([]);
	const [kanbanTagId, setKanbanTagId] = useState("");
	const [kanbanError, setKanbanError] = useState(false);
	useEffect(() => {
		return () => {
			isMounted.current = false;
		};
	}, []);

	useEffect(() => {
		const fetchContact = async () => {
			if (initialValues) {
				setContact(prevState => {
					return {
						...prevState,
						...initialValues,
						birthDate: initialValues?.birthDate
							? String(initialValues.birthDate).split("T")[0]
							: ""
					};
				});
				setPendingTags(Array.isArray(initialValues.tags) ? initialValues.tags : []);
			}

			if (!contactId) return;

			try {
				const { data } = await api.get(`/contacts/${contactId}`);
				if (isMounted.current) {
					setContact({
						...data,
						birthDate: data?.birthDate ? String(data.birthDate).split("T")[0] : ""
					});
					setDisableBot(data.disableBot)
					setPendingTags(Array.isArray(data.tags) ? data.tags : []);
				}
			} catch (err) {
				toastError(err);
			}
		};

		fetchContact();
	}, [contactId, open, initialValues]);

	useEffect(() => {
		if (!open || !requireFullRegistration || !ticketId) return;
		(async () => {
			try {
				const { data } = await api.get("/tag/kanban/");
				if (isMounted.current) {
					setKanbanTags(data?.lista || data || []);
				}
			} catch (err) {
				toastError(err);
			}
		})();
	}, [open, requireFullRegistration, ticketId]);

	const handleClose = () => {
		onClose();
		setContact(initialState);
		setPendingTags([]);
		setKanbanTagId("");
		setKanbanError(false);
	};

	const handleSaveContact = async values => {
		if (requireFullRegistration && ticketId && !kanbanTagId) {
			setKanbanError(true);
			return;
		}

		try {
			let data;
			if (contactId) {
				({ data } = await api.put(`/contacts/${contactId}`, { ...values, disableBot: disableBot }));
			} else {
				({ data } = await api.post("/contacts", { ...values, disableBot: disableBot }));
				if (Array.isArray(pendingTags) && pendingTags.length > 0) {
					await api.post("/tags/sync", { contactId: data.id, tags: pendingTags });
				}
			}

			if (requireFullRegistration && ticketId && kanbanTagId) {
				try {
					await api.delete(`/ticket-tags/${ticketId}`);
				} catch (err) {
					// Sem problema se o ticket ainda não tinha nenhuma tag de kanban.
				}
				await api.put(`/ticket-tags/${ticketId}/${kanbanTagId}`);
			}

			if (onSave) {
				onSave(data);
			}
			handleClose();
			toast.success(i18n.t("contactModal.success"));
		} catch (err) {
			toastError(err);
		}
	};

	return (
		<div className={classes.root}>
			<Dialog
				open={open}
				onClose={handleClose}
				maxWidth="lg"
				scroll="paper"
				PaperProps={{ className: classes.dialogPaper }}
			>
				<DialogTitle id="form-dialog-title" className={classes.dialogTitle}>
					{contactId
						? `${i18n.t("contactModal.title.edit")}`
						: `${i18n.t("contactModal.title.add")}`}
				</DialogTitle>
				<Formik
					initialValues={contact}
					enableReinitialize={true}
					validationSchema={buildContactSchema(!!requireFullRegistration)}
					onSubmit={(values, actions) => {
						setTimeout(() => {
							handleSaveContact(values);
							actions.setSubmitting(false);
						}, 400);
					}}
				>
						{({ values, errors, touched, isSubmitting }) => (
						<Form className={classes.formRoot}>
							<DialogContent dividers className={classes.dialogContent}>
								{requireFullRegistration && (
									<Alert severity="info" style={{ marginBottom: 16 }}>
										{i18n.t("contactModal.form.fullRegistrationNotice")}
									</Alert>
								)}
								<Typography variant="subtitle1" className={classes.sectionTitle}>
									{i18n.t("contactModal.form.mainInfo")}
								</Typography>
								<div className={classes.fieldRow}>
									<div className={classes.fieldHalf}>
										<Field
											as={TextField}
											label={i18n.t("contactModal.form.name")}
											name="name"
											autoFocus
											error={touched.name && Boolean(errors.name)}
											helperText={touched.name && errors.name}
											variant="outlined"
											margin="dense"
											className={classes.textField}
										/>
									</div>
									<div className={classes.fieldHalf}>
										<Field
											as={TextField}
											label={i18n.t("contactModal.form.number")}
											name="number"
											error={touched.number && Boolean(errors.number)}
											helperText={touched.number && errors.number}
											placeholder="5513912344321"
											variant="outlined"
											margin="dense"
											className={classes.textField}
										/>
									</div>
								</div>
				<div>
									<Field
										as={TextField}
										label={i18n.t("contactModal.form.email")}
										name="email"
										error={touched.email && Boolean(errors.email)}
										helperText={touched.email && errors.email}
										placeholder="Email address"
										fullWidth
										margin="dense"
										variant="outlined"
										className={classes.textField}
									/>
								</div>
								<div className={classes.fieldRow}>
									<div className={classes.fieldHalf}>
										<Field
											as={TextField}
											label={i18n.t("contactModal.form.document")}
											name="document"
											error={touched.document && Boolean(errors.document)}
											helperText={touched.document && errors.document}
											variant="outlined"
											margin="dense"
											className={classes.textField}
										/>
									</div>
									<div className={classes.fieldHalf}>
										<Field
											as={TextField}
											label={i18n.t("contactModal.form.contact2")}
											name="contact2"
											error={touched.contact2 && Boolean(errors.contact2)}
											helperText={touched.contact2 && errors.contact2}
											variant="outlined"
											margin="dense"
											className={classes.textField}
										/>
									</div>
								</div>
								<div>
									<Field
										as={TextField}
										label={i18n.t("contactModal.form.address")}
										name="address"
										error={touched.address && Boolean(errors.address)}
										helperText={touched.address && errors.address}
										multiline
										minRows={2}
										fullWidth
										margin="dense"
										variant="outlined"
										className={classes.textField}
									/>
								</div>
								{requireFullRegistration && ticketId && (
									<div>
										<TextField
											select
											label={i18n.t("contactModal.form.kanbanColumn")}
											value={kanbanTagId}
											onChange={e => {
												setKanbanTagId(e.target.value);
												setKanbanError(false);
											}}
											error={kanbanError}
											helperText={kanbanError ? "Required" : ""}
											fullWidth
											margin="dense"
											variant="outlined"
											className={classes.textField}
										>
											{kanbanTags.map(tag => (
												<MenuItem key={tag.id} value={tag.id}>
													{tag.name}
												</MenuItem>
											))}
										</TextField>
									</div>
								)}
								<div>
									<Field
										as={TextField}
										label="Data de Nascimento"
										name="birthDate"
										type="date"
										InputLabelProps={{ shrink: true }}
										fullWidth
										margin="dense"
										variant="outlined"
										className={classes.textField}
									/>
								</div>
								<div>
									<TagsContainer
										contact={contact}
										className={classes.textField}
										onChangeTags={setPendingTags}
									/>
								</div>
								<div className={classes.switchRow}>
									<Switch
										size="small"
										checked={disableBot}
										onChange={() =>
											setDisableBot(!disableBot)
										}
										name="disableBot"
										classes={{
											root: classes.iosSwitch,
											switchBase: classes.iosSwitchBase,
											thumb: classes.iosThumb,
											track: classes.iosTrack,
											checked: classes.iosChecked,
										}}
									/>
									<Typography className={classes.switchLabel}>
										{i18n.t("contactModal.form.chatBotContact")}
									</Typography>
								</div>
								<Typography
									className={classes.metaText}
									variant="subtitle1"
								>
									{i18n.t("contactModal.form.whatsapp")} {contact?.whatsapp ? contact?.whatsapp.name : ""}
								</Typography>
								<Typography
									className={classes.metaText}
									variant="subtitle1"
								>
									{i18n.t("contactModal.form.termsLGDP")} {contact?.lgpdAcceptedAt ? format(new Date(contact?.lgpdAcceptedAt), "dd/MM/yyyy 'às' HH:mm") : ""}
								</Typography>

								{/* <Typography variant="subtitle1" gutterBottom>{i18n.t("contactModal.form.customer_portfolio")}</Typography> */}
								{/* <div style={{ marginTop: 10 }}>
									<AsyncSelect url="/users" dictKey={"users"}
										initialValue={values.user} width="100%" label={i18n.t("contactModal.form.attendant")}
										onChange={(event, value) => setFieldValue("userId", value ? value.id : null)} />
								</div>
								<div style={{ marginTop: 10 }}>
									<AsyncSelect url="/queue" dictKey={null}
										initialValue={values.queue} width="100%" label={i18n.t("contactModal.form.queue")}
										onChange={(event, value) => setFieldValue("queueId", value ? value.id : null)} />
								</div> */}
								<Typography
									className={classes.sectionTitle}
									variant="subtitle1"
								>
									{i18n.t("contactModal.form.extraInfo")}
								</Typography>

								<FieldArray name="extraInfo">
									{({ push, remove }) => (
										<>
											{values.extraInfo &&
												values.extraInfo.length > 0 &&
												values.extraInfo.map((info, index) => (
													<div
														className={classes.extraAttr}
														key={`${index}-info`}
													>
														<Field
															as={TextField}
															label={i18n.t("contactModal.form.extraName")}
															name={`extraInfo[${index}].name`}
															variant="outlined"
															margin="dense"
															className={classes.textField}
														/>
														<Field
															as={TextField}
															label={i18n.t("contactModal.form.extraValue")}
															name={`extraInfo[${index}].value`}
															variant="outlined"
															margin="dense"
															className={classes.textField}
														/>
														<IconButton
															size="small"
															className={classes.removeInfoButton}
															onClick={() => remove(index)}
														>
															<DeleteOutlineIcon />
														</IconButton>
													</div>
												))}
											<div className={classes.extraAttr}>
												<Button
													variant="outlined"
													color="primary"
													className={classes.addExtraButton}
													onClick={() => push({ name: "", value: "" })}
												>
													{`+ ${i18n.t("contactModal.buttons.addExtraInfo")}`}
												</Button>
											</div>
										</>
									)}
								</FieldArray>
							</DialogContent>
							<DialogActions className={classes.dialogActions}>
								<Button
									onClick={handleClose}
									color="secondary"
									disabled={isSubmitting}
									variant="outlined"
									className={classes.secondaryButton}
								>
									{i18n.t("contactModal.buttons.cancel")}
								</Button>
								<Button
									type="submit"
									color="primary"
									disabled={isSubmitting}
									variant="contained"
									className={`${classes.btnWrapper} ${classes.primaryButton}`}
								>
									{requireFullRegistration
										? `${i18n.t("contactModal.buttons.okEditAndClose")}`
										: contactId
										? `${i18n.t("contactModal.buttons.okEdit")}`
										: `${i18n.t("contactModal.buttons.okAdd")}`}
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
		</div>
	);
};

export default ContactModal;
