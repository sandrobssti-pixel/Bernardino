import React from "react";
import { i18n } from "../../translate/i18n";
import { Avatar, CardHeader, Grid, Typography, makeStyles } from "@material-ui/core";
import formatToCurrency from "../../utils/formatToCurrency";

const useStyles = makeStyles(theme => ({
	cardHeader: {
		padding: "8px 8px",
		flex: 1,
		minWidth: 0,
		"& .MuiCardHeader-avatar": {
			marginRight: 12,
		},
		"& .MuiCardHeader-content": {
			minWidth: 0,
		},
		"& .MuiCardHeader-title": {
			fontSize: "0.88rem",
			fontWeight: 600,
			color: theme.mode === "light" ? "#0f172a" : "#f1f5f9",
			letterSpacing: "0.01em",
		},
		"& .MuiCardHeader-subheader": {
			fontSize: "0.75rem",
			color: theme.mode === "light" ? "#64748b" : "#94a3b8",
			marginTop: 2,
		},
		[theme.breakpoints.down("sm")]: {
			padding: "4px 6px",
			"& .MuiCardHeader-avatar": {
				marginRight: 8,
			},
			"& .MuiCardHeader-title": {
				fontSize: "0.82rem",
			},
			"& .MuiCardHeader-subheader": {
				fontSize: "0.68rem",
				marginTop: 1,
			},
		},
	},
	avatar: {
		width: 42,
		height: 42,
		[theme.breakpoints.down("sm")]: {
			width: 32,
			height: 32,
		},
	},
	valueText: {
		padding: "0 16px 8px 70px",
		fontSize: "0.78rem",
		fontWeight: 600,
		color: theme.palette.success.main,
		[theme.breakpoints.down("sm")]: {
			padding: "0 12px 6px 46px",
			fontSize: "0.72rem",
		},
	},
	presenceOnline: {
		color: "#22c55e",
		fontWeight: 500,
	},
	presenceTyping: {
		color: theme.mode === "light" ? "#6366f1" : "#818cf8",
		fontWeight: 500,
	},
}));

const TicketInfo = ({ contact, ticket, onClick, contactPresence }) => {
	const classes = useStyles();

	const resolveSubheader = () => {
		if (contactPresence === "typing") {
			return <span className={classes.presenceTyping}>Digitando...</span>;
		}
		if (contactPresence === "online") {
			return <span className={classes.presenceOnline}>online</span>;
		}
		if (ticket.user) {
			return `${i18n.t("messagesList.header.assignedTo")} ${ticket.user.name}`;
		}
		return null;
	};

	const renderCardReader = () => {
		return (
			<CardHeader
				onClick={onClick}
				className={classes.cardHeader}
				style={{ cursor: "pointer" }}
				titleTypographyProps={{ noWrap: true }}
				subheaderTypographyProps={{ noWrap: true }}
				avatar={<Avatar src={contact?.urlPicture} alt="contact_image" className={classes.avatar} />}
				title={`${contact?.name || '(sem contato)'} #${ticket.id}`}
				subheader={resolveSubheader()}
			/>
		);
	}


	return (
		<React.Fragment>
			<Grid container alignItems="center" style={{ flex: 1, minWidth: 0 }}>
				<Grid item style={{ flex: 1, minWidth: 0 }}>
					{renderCardReader()}
					{ticket?.kanbanValue !== null && ticket?.kanbanValue !== undefined && (
						<Typography className={classes.valueText}>
							{i18n.t("kanban.value")}: {formatToCurrency(Number(ticket.kanbanValue || 0))}
						</Typography>
					)}
				</Grid>
			</Grid>
		</React.Fragment>
	);
};

export default TicketInfo;
