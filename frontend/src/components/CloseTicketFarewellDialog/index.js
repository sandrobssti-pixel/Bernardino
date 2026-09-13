import React from "react";

import { makeStyles } from "@material-ui/core/styles";
import { Dialog, DialogContent, IconButton, Typography, Avatar } from "@material-ui/core";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import SendIcon from "@material-ui/icons/Send";
import SpeakerNotesOffIcon from "@material-ui/icons/SpeakerNotesOff";
import CloseIcon from "@material-ui/icons/Close";

import { i18n } from "../../translate/i18n";
import ButtonWithSpinner from "../ButtonWithSpinner";

const useStyles = makeStyles(theme => ({
    paper: {
        borderRadius: 16,
        maxWidth: 380,
        width: "100%",
    },
    closeButton: {
        position: "absolute",
        top: 8,
        right: 8,
        color: theme.palette.grey[500],
    },
    content: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: theme.spacing(4, 3, 3),
    },
    avatar: {
        width: 56,
        height: 56,
        backgroundColor: theme.mode === "light" ? "#e8f5e9" : "rgba(76, 175, 80, 0.16)",
        color: theme.palette.success?.main || "#43a047",
        marginBottom: theme.spacing(2),
    },
    title: {
        fontWeight: 600,
        marginBottom: theme.spacing(1),
    },
    subtitle: {
        color: theme.palette.text.secondary,
        marginBottom: theme.spacing(3),
    },
    actions: {
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing(1.5),
        width: "100%",
    },
    withFarewellButton: {
        textTransform: "none",
        fontWeight: 600,
        borderRadius: 10,
        padding: theme.spacing(1.2, 2),
        boxShadow: "none",
    },
    withoutFarewellButton: {
        textTransform: "none",
        fontWeight: 600,
        borderRadius: 10,
        padding: theme.spacing(1.2, 2),
        border: `1px solid ${theme.palette.divider}`,
        color: theme.palette.text.primary,
        backgroundColor: "transparent",
        "&:hover": {
            backgroundColor: theme.mode === "light" ? "#f5f5f5" : "rgba(255,255,255,0.08)",
        },
    },
    buttonIcon: {
        marginRight: theme.spacing(1),
    },
}));

const CloseTicketFarewellDialog = ({
    open,
    onClose,
    onConfirmWithFarewell,
    onConfirmWithoutFarewell,
    loading,
}) => {
    const classes = useStyles();

    return (
        <Dialog
            open={open}
            onClose={onClose}
            classes={{ paper: classes.paper }}
        >
            <IconButton
                aria-label="close"
                className={classes.closeButton}
                onClick={onClose}
                size="small"
            >
                <CloseIcon fontSize="small" />
            </IconButton>
            <DialogContent className={classes.content}>
                <Avatar className={classes.avatar}>
                    <CheckCircleOutlineIcon fontSize="large" />
                </Avatar>
                <Typography variant="h6" className={classes.title}>
                    {i18n.t("messagesList.header.dialogClosingTitle")}
                </Typography>
                <Typography variant="body2" className={classes.subtitle}>
                    {i18n.t("messagesList.header.dialogFarewellSubtitle")}
                </Typography>
                <div className={classes.actions}>
                    <ButtonWithSpinner
                        loading={loading}
                        variant="contained"
                        color="primary"
                        fullWidth
                        disableElevation
                        className={classes.withFarewellButton}
                        onClick={onConfirmWithFarewell}
                    >
                        <SendIcon fontSize="small" className={classes.buttonIcon} />
                        {i18n.t("messagesList.header.dialogRatingCancel")}
                    </ButtonWithSpinner>
                    <ButtonWithSpinner
                        loading={false}
                        variant="outlined"
                        fullWidth
                        className={classes.withoutFarewellButton}
                        onClick={onConfirmWithoutFarewell}
                        disabled={loading}
                    >
                        <SpeakerNotesOffIcon fontSize="small" className={classes.buttonIcon} />
                        {i18n.t("messagesList.header.dialogRatingWithoutFarewellMsg")}
                    </ButtonWithSpinner>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default CloseTicketFarewellDialog;
