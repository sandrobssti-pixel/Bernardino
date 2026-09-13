import React, { useState, useEffect, useMemo } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
	Dialog,
	DialogContent,
	DialogActions,
	Button,
	IconButton,
} from "@material-ui/core";
import { Close, GetApp, OpenInNew } from "@material-ui/icons";

import ModalImage from "react-modal-image";
import api from "../../services/api";

const useStyles = makeStyles(theme => ({
	messageMedia: {
		objectFit: "cover",
		width: 250,
		height: "auto",
		borderTopLeftRadius: 8,
		borderTopRightRadius: 8,
		borderBottomLeftRadius: 8,
		borderBottomRightRadius: 8,
	}
	,
	messageMediaButton: {
		border: 0,
		padding: 0,
		background: "transparent",
		cursor: "pointer",
		display: "inline-flex",
		borderRadius: 8,
	},
	dialogPaper: {
		backgroundColor: "#111827",
	},
	dialogContent: {
		padding: theme.spacing(1),
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
	},
	dialogImage: {
		maxWidth: "100%",
		maxHeight: "80vh",
		objectFit: "contain",
		borderRadius: 8,
	},
	dialogActions: {
		justifyContent: "space-between",
		padding: theme.spacing(1, 2, 2),
	},
	dialogLeftActions: {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1),
	},
	closeButton: {
		color: "#ffffff",
	}
}));

const isWebpLike = (value, contentType = "") => {
	const rawValue = String(value || "").trim().toLowerCase();
	const rawContentType = String(contentType || "").trim().toLowerCase();
	return rawValue.endsWith(".webp") || rawContentType.includes("image/webp");
};

const enhanceWhatsappAvatarUrl = (value) => {
	const raw = String(value || "").trim();
	if (!raw) return raw;
	try {
		const parsed = new URL(raw, window.location.origin);
		const host = String(parsed.hostname || "").toLowerCase();
		if (!host.includes("whatsapp.net")) return raw;
		const stp = parsed.searchParams.get("stp");
		if (stp && /_s\d+x\d+/i.test(stp)) {
			parsed.searchParams.set("stp", stp.replace(/_s\d+x\d+/ig, ""));
		}
		return parsed.toString();
	} catch {
		return raw;
	}
};

const ModalImageCors = ({ imageUrl, className }) => {
	const classes = useStyles();
	const [fetching, setFetching] = useState(true);
	const [blobUrl, setBlobUrl] = useState("");
	const [largeUrl, setLargeUrl] = useState("");
	const [contentType, setContentType] = useState("");
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (!imageUrl) {
			setFetching(false);
			setBlobUrl("");
			setLargeUrl("");
			setContentType("");
			return;
		}

		let objectUrl = null;
		setFetching(true);
		setBlobUrl("");
		setLargeUrl("");
		setContentType("");

		const fetchImage = async () => {
			const enhancedImageUrl = enhanceWhatsappAvatarUrl(imageUrl);
			try {
				// Some records can contain malformed URLs and crash XHR open().
				// If URL parsing fails, keep the original URL as fallback.
				new URL(enhancedImageUrl, window.location.origin);
				const { data, headers } = await api.get(enhancedImageUrl, {
					responseType: "blob",
				});
				const resolvedContentType = String(
					headers?.["content-type"] || data?.type || ""
				).trim();
				objectUrl = window.URL.createObjectURL(
					new Blob([data], { type: resolvedContentType || data?.type || undefined })
				);
				setBlobUrl(objectUrl);
				setLargeUrl(enhancedImageUrl);
				setContentType(resolvedContentType);
			} catch (error) {
				setBlobUrl(enhancedImageUrl);
				setLargeUrl(enhancedImageUrl);
				setContentType("");
			} finally {
				setFetching(false);
			}
		};
		fetchImage();

		return () => {
			if (objectUrl) {
				window.URL.revokeObjectURL(objectUrl);
			}
		};
	}, [imageUrl]);

	const previewUrl = fetching ? imageUrl : (blobUrl || imageUrl);
	const fullImageUrl = fetching ? imageUrl : (largeUrl || blobUrl || imageUrl);
	const shouldUseNativeDialog = useMemo(
		() => isWebpLike(imageUrl, contentType) || isWebpLike(blobUrl, contentType) || isWebpLike(largeUrl, contentType),
		[blobUrl, contentType, imageUrl, largeUrl]
	);

	if (shouldUseNativeDialog) {
		return (
			<>
				<button
					type="button"
					className={classes.messageMediaButton}
					onClick={() => setOpen(true)}
				>
					<img
						className={className || classes.messageMedia}
						src={previewUrl}
						alt="image"
						loading="lazy"
					/>
				</button>
				<Dialog
					open={open}
					onClose={() => setOpen(false)}
					maxWidth="md"
					fullWidth
					classes={{ paper: classes.dialogPaper }}
				>
					<DialogActions className={classes.dialogActions}>
						<div className={classes.dialogLeftActions}>
							<Button
								color="primary"
								startIcon={<OpenInNew />}
								component="a"
								href={fullImageUrl}
								target="_blank"
								rel="noopener noreferrer"
							>
								Abrir
							</Button>
							<Button
								color="primary"
								startIcon={<GetApp />}
								component="a"
								href={fullImageUrl}
								download
							>
								Baixar
							</Button>
						</div>
						<IconButton
							onClick={() => setOpen(false)}
							className={classes.closeButton}
							aria-label="fechar"
						>
							<Close />
						</IconButton>
					</DialogActions>
					<DialogContent className={classes.dialogContent}>
						<img
							className={classes.dialogImage}
							src={fullImageUrl}
							alt="image-preview"
						/>
					</DialogContent>
				</Dialog>
			</>
		);
	}

	return (
		<ModalImage
			className={className || classes.messageMedia}
			small={previewUrl}
			medium={previewUrl}
			large={fullImageUrl}
			alt="image"
			showRotate={true}
		/>
	);
};

export default ModalImageCors;
