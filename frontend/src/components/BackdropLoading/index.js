import React, { useEffect, useState } from "react";

import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => {
	// Tenta obter cor do whitelabel do localStorage, fallback para índigo
	const brandColor = (() => {
		try {
			const stored = localStorage.getItem("primaryColorLight");
			return stored || "#6366f1";
		} catch (e) {
			return "#6366f1";
		}
	})();

	return {
		root: {
			position: "fixed",
			inset: 0,
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center",
			zIndex: theme.zIndex.drawer + 1,
			backgroundColor: theme.mode === "light" ? "#f8fafc" : "#0f172a",
			transition: "opacity 0.3s ease",
		},
		content: {
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			textAlign: "center",
			gap: 16,
		},
		brandTitle: {
			margin: 0,
			fontSize: 24,
			fontWeight: 600,
			color: theme.mode === "light" ? "#0f172a" : "#f1f5f9",
			letterSpacing: "-0.02em",
		},
		brandSubtitle: {
			margin: 0,
			fontSize: 14,
			color: theme.mode === "light" ? "#64748b" : "#94a3b8",
			fontWeight: 400,
		},
		progressBar: {
			width: 200,
			height: 3,
			backgroundColor: theme.mode === "light" ? "#e2e8f0" : "#334155",
			borderRadius: 2,
			overflow: "hidden",
			marginTop: 4,
		},
		progressBarFill: {
			height: "100%",
			width: "60%",
			backgroundColor: brandColor,
			animation: "$shimmer 1.5s ease-in-out infinite",
		},
		"@keyframes shimmer": {
			"0%": { transform: "translateX(-100%)" },
			"50%": { transform: "translateX(0%)" },
			"100%": { transform: "translateX(100%)" },
		},
	};
});

const BackdropLoading = () => {
	const classes = useStyles();
	const [appName, setAppName] = useState("Whaticket");

	useEffect(() => {
		// Tenta obter nome do app do localStorage
		const storedName = localStorage.getItem("appName");
		if (storedName) {
			setAppName(storedName);
		}
	}, []);

	return (
		<div className={classes.root}>
			<div className={classes.content}>
				<h1 className={classes.brandTitle}>{appName}</h1>
				<p className={classes.brandSubtitle}>Carregando...</p>
				<div className={classes.progressBar}>
					<div className={classes.progressBarFill} />
				</div>
			</div>
		</div>
	);
};

export default BackdropLoading;
