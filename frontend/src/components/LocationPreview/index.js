import React, { useMemo, useState } from 'react';
import toastError from "../../errors/toastError";

import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Typography } from "@material-ui/core";
import RoomIcon from "@material-ui/icons/Room";

const toEmbedLink = (url = "") => {
	const value = String(url || "").trim();
	if (!value) return "";
	if (value.includes("output=embed")) return value;
	return value.includes("?") ? `${value}&output=embed` : `${value}?output=embed`;
};

const LocationPreview = ({ image, link, description, title, address }) => {
	const [open, setOpen] = useState(false);
	const hasLink = Boolean(String(link || "").trim());
	const embedLink = useMemo(() => toEmbedLink(link), [link]);

	const subtitle = [String(title || "").trim(), String(address || "").trim(), String(description || "").trim()]
		.filter(Boolean)
		.join("\n");

	const handleLocation = async () => {
		try {
			if (!hasLink) return;
			window.open(link, "_blank");
		} catch (err) {
			toastError(err);
		}
	};

	return (
		<>
			<div style={{ minWidth: "250px" }}>
				<div>
					{image ? (
						<div style={{ float: "left" }}>
							<img src={image} alt="loc" onClick={() => setOpen(true)} style={{ width: "100px", cursor: "pointer" }} />
						</div>
					) : (
						<div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
							<RoomIcon color="primary" fontSize="small" />
							<Typography variant="subtitle2" color="primary">Localização</Typography>
						</div>
					)}
					{subtitle && (
						<div style={{ display: "flex", flexWrap: "wrap" }}>
							<Typography style={{ marginTop: "12px", marginLeft: image ? "15px" : "0px", marginRight: "15px", float: "left", whiteSpace: "pre-line" }} variant="subtitle1" color="primary" gutterBottom>
								{subtitle}
							</Typography>
						</div>
					)}
					<div style={{ display: "block", content: "", clear: "both" }}></div>
					<div>
						<Divider />
						<Button
							fullWidth
							color="primary"
							onClick={() => setOpen(true)}
							disabled={!link}
						>Visualizar</Button>
					</div>
				</div>
			</div>
			<Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
				<DialogTitle>Localização</DialogTitle>
				<DialogContent dividers>
					{embedLink ? (
						<iframe
							title="location-preview"
							src={embedLink}
							style={{ width: "100%", height: "360px", border: 0, borderRadius: "8px" }}
							loading="lazy"
						/>
					) : (
						<Typography variant="body2" color="textSecondary">
							Não foi possível gerar a prévia do mapa.
						</Typography>
					)}
					{subtitle ? (
						<Typography style={{ marginTop: 12, whiteSpace: "pre-line" }} variant="body2" color="textSecondary">
							{subtitle}
						</Typography>
					) : null}
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setOpen(false)}>Fechar</Button>
					<Button color="primary" variant="contained" onClick={handleLocation} disabled={!hasLink}>
						Abrir no mapa
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);

};

export default LocationPreview;
