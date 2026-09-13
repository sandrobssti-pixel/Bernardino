import React, { useEffect, useMemo, useState } from "react";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import InputLabel from "@material-ui/core/InputLabel";
import { makeStyles } from "@material-ui/core/styles";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
	alertBox: {
		marginTop: theme.spacing(2),
		padding: theme.spacing(1.5, 2),
		borderRadius: 10,
		backgroundColor: "#fde8e8",
		border: "1px solid #f5b5b5",
	},
	alertTitle: {
		fontWeight: 700,
		color: "#991b1b",
		marginBottom: theme.spacing(0.5),
	},
	alertText: {
		color: "#7f1d1d",
		lineHeight: 1.45,
	},
}));

const ConfirmationModal = ({
	title,
	children,
	open,
	onClose,
	onConfirm,
	isCellPhone = false,
	onSave,
	alert,
}) => {
	const classes = useStyles();
	const [whatsapps, setWhatsapps] = useState([]);
	const [selectedWhatsappId, setSelectedWhatsappId] = useState("");

	useEffect(() => {
		const loadWhatsapps = async () => {
			if (!open || !isCellPhone) return;
			try {
				const { data } = await api.get("/whatsapp/?session=0");
				const items = Array.isArray(data)
					? data.filter((w) => w.channel === "whatsapp")
					: [];
				setWhatsapps(items);

				const defaultConnected = items.find((w) => w.status === "CONNECTED");
				setSelectedWhatsappId(
					defaultConnected ? String(defaultConnected.id) : items[0] ? String(items[0].id) : ""
				);
			} catch (_) {
				setWhatsapps([]);
				setSelectedWhatsappId("");
			}
		};

		loadWhatsapps();
	}, [open, isCellPhone]);

	const confirmDisabled = useMemo(() => {
		if (!isCellPhone) return false;
		return !selectedWhatsappId;
	}, [isCellPhone, selectedWhatsappId]);

	return (
		<Dialog
			open={open}
			onClose={() => onClose(false)}
			aria-labelledby="confirm-dialog"
		>
			<DialogTitle id="confirm-dialog">{title}</DialogTitle>
			<DialogContent dividers>
				<Typography>{children}</Typography>
				{alert && (
					<Box className={classes.alertBox}>
						{alert.title && (
							<Typography variant="subtitle2" className={classes.alertTitle}>
								{alert.title}
							</Typography>
						)}
						<Typography variant="body2" className={classes.alertText}>
							{alert.message}
						</Typography>
					</Box>
				)}
				{isCellPhone && (
					<FormControl fullWidth margin="dense" variant="outlined">
						<InputLabel id="whatsapp-import-label">Conexão</InputLabel>
						<Select
							labelId="whatsapp-import-label"
							value={selectedWhatsappId}
							onChange={(e) => setSelectedWhatsappId(e.target.value)}
							label="Conexão"
						>
							{whatsapps.map((w) => (
								<MenuItem key={w.id} value={String(w.id)}>
									{w.name} ({w.status})
								</MenuItem>
							))}
						</Select>
					</FormControl>
				)}
			</DialogContent>
			<DialogActions>
				<Button
					variant="contained"
					onClick={() => onClose(false)}
					color="default"
				>
					{i18n.t("confirmationModal.buttons.cancel")}
				</Button>
				<Button
					variant="contained"
					disabled={confirmDisabled}
					onClick={() => {
						const selectedId = isCellPhone ? Number(selectedWhatsappId) : undefined;
						if (isCellPhone && onSave) onSave(selectedId);
						onClose(false);
						onConfirm(selectedId);
					}}
					color="secondary"
				>
					{i18n.t("confirmationModal.buttons.confirm")}
				</Button>
			</DialogActions>
		</Dialog>
	);
};

export default ConfirmationModal;