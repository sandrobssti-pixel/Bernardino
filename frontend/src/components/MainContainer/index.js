import React from "react";

import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";

const useStyles = makeStyles(theme => ({
	mainContainer: {
		flex: 1,
		padding: theme.spacing(2),
		height: `calc(100% - 48px)`,
	},

	contentWrapper: {
		height: "100%",
		overflowY: "hidden",
		display: "flex",
		flexDirection: "column",
	},
}));

const MainContainer = ({ children, className, fullWidth = false }) => {
	const classes = useStyles();
	const containerClassName = className
		? `${classes.mainContainer} ${className}`
		: classes.mainContainer;

	return (
		<Container
			className={containerClassName}
			maxWidth={fullWidth ? false : undefined}
			disableGutters={fullWidth}
		>
			<div className={classes.contentWrapper}>{children}</div>
		</Container>
	);
};

export default MainContainer;
