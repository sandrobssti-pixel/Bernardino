import React, { useEffect } from "react";

import { Card, Button } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import TicketHeaderSkeleton from "../TicketHeaderSkeleton";
import ArrowBackIos from "@material-ui/icons/ArrowBackIos";
import { useHistory } from "react-router-dom";

const useStyles = makeStyles(theme => ({
	ticketHeader: {
		display: "flex",
		alignItems: "center",
		background: theme.palette.background.paper,
		boxShadow: "none",
		flex: "none",
		borderBottom: `1px solid ${theme.mode === "light" ? "rgba(15,23,42,0.08)" : "rgba(148,163,184,0.12)"}`,
		height: "62px",
		padding: "0 8px",
		[theme.breakpoints.down("sm")]: {
			flexWrap: "nowrap",
			height: "50px",
			overflow: "hidden",
		},
	},
	backButton: {
		minWidth: "40px",
		width: "40px",
		height: "40px",
		borderRadius: "50%",
		padding: 0,
		marginRight: "4px",
		color: theme.palette.text.secondary,
		"&:hover": {
			background: theme.palette.chat.listHover,
		},
	},
}));

const TicketHeader = ({ loading, children }) => {
	const classes = useStyles();
	const history = useHistory();

	const handleBack = () => {

		history.push("/tickets");
	};

	// useEffect(() => {
	// 	const handleKeyDown = (event) => {
	// 		if (event.key === "Escape") {
	// 			handleBack();
	// 		}
	// 	};
	// 	document.addEventListener("keydown", handleKeyDown);
	// 	return () => {
	// 		document.removeEventListener("keydown", handleKeyDown);
	// 	};
	// }, [history]);

	return (
		<>
			{loading ? (
				<TicketHeaderSkeleton />
			) : (
				<Card
					className={classes.ticketHeader}
				>
					<Button className={classes.backButton} onClick={handleBack}>
						<ArrowBackIos />
					</Button>
					{children}
				</Card>
			)}
		</>
	);
};

export default TicketHeader;
