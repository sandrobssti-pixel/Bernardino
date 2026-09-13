import React, { useEffect, useRef } from "react";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import CheckoutPage from "../CheckoutPage";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  dialogPaper: {
    width: "100%",
    maxWidth: 980,
    borderRadius: 18,
    overflow: "hidden",
    [theme.breakpoints.down("sm")]: {
      maxWidth: "100%",
      margin: theme.spacing(1),
      borderRadius: 14,
    },
  },
  content: {
    background:
      theme.palette.type === "dark"
        ? "linear-gradient(180deg, rgba(15,23,42,0.86) 0%, rgba(2,6,23,0.96) 100%)"
        : "linear-gradient(180deg, #f8fbff 0%, #f1f7ff 100%)",
    padding: theme.spacing(2.5),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1.5),
    },
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },

  extraAttr: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
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

const ContactModal = ({ open, onClose, Invoice, contactId, initialValues, onSave }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleClose = () => {
    onClose();
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        scroll="paper"
        fullWidth
        classes={{ paper: classes.dialogPaper }}
      >
        <DialogContent dividers className={classes.content}>
          <CheckoutPage
            Invoice={Invoice}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContactModal;
