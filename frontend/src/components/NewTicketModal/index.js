import React, { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import Autocomplete, { createFilterOptions } from "@material-ui/lab/Autocomplete";
import CircularProgress from "@material-ui/core/CircularProgress";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Grid, ListItemText, MenuItem, Select } from "@material-ui/core";
import { toast } from "react-toastify";
import { Facebook, Instagram, WhatsApp } from "@material-ui/icons";
import ShowTicketOpen from "../ShowTicketOpenModal";

const useStyles = makeStyles((theme) => ({
  dialogPaper: {
    borderRadius: 14,
    overflow: "hidden",
  },
  header: {
    paddingBottom: theme.spacing(1),
    borderBottom: `1px solid ${theme.palette.divider}`,
    background:
      theme.mode === "light"
        ? "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)"
        : "linear-gradient(135deg, #111827 0%, #1f2937 100%)",
  },
  title: {
    fontWeight: 700,
    fontSize: "1rem",
    color: theme.palette.text.primary,
  },
  subtitle: {
    marginTop: theme.spacing(0.5),
    fontSize: "0.78rem",
    color: theme.palette.text.secondary,
  },
  content: {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(1.5),
  },
  formGrid: {
    width: 380,
    maxWidth: "100%",
  },
  inlineInfo: {
    fontSize: "0.74rem",
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.75),
    lineHeight: 1.4,
  },
  online: {
    fontSize: 11,
    color: "#25d366"
  },
  offline: {
    fontSize: 11,
    color: "#e1306c"
  }
}));

const filter = createFilterOptions({
  trim: true,
});

const getEffectiveConnectionStatus = (whatsApp) => {
  const channel = String(whatsApp?.channel || "").toLowerCase();
  if (channel !== "whatsapp_oficial") return whatsApp?.status;

  const hasOfficialBinding =
    Boolean(whatsApp?.waba_webhook_id) &&
    Boolean(String(whatsApp?.token || "").trim()) &&
    Boolean(String(whatsApp?.phone_number_id || "").trim());

  return hasOfficialBinding ? "CONNECTED" : "DISCONNECTED";
};

const NewTicketModal = ({ modalOpen, onClose, initialContact }) => {
  const classes = useStyles();
  const [options, setOptions] = useState([]);
  const [channelFilter, setChannelFilter] = useState(null);

  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [typedInput, setTypedInput] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedQueue, setSelectedQueue] = useState("");
  const [selectedWhatsapp, setSelectedWhatsapp] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [whatsapps, setWhatsapps] = useState([]);
  const { user } = useContext(AuthContext);
  const { companyId, whatsappId } = user;

  const [openAlert, setOpenAlert] = useState(false);
  const [userTicketOpen, setUserTicketOpen] = useState("");
  const [queueTicketOpen, setQueueTicketOpen] = useState("");

  useEffect(() => {
    if (initialContact?.id !== undefined) {
      setOptions([initialContact]);
      setSelectedContact(initialContact);
    }
  }, [initialContact]);

  useEffect(() => {
    if (!modalOpen) return;

    let isMounted = true;

    const fetchWhatsapps = async () => {
      try {
        const { data } = await api.get(`/whatsapp`, {
          params: { companyId, session: 0 }
        });
        if (isMounted) {
          setWhatsapps(data);
        }
      } catch (err) {
        if (isMounted) {
          toastError(err);
        }
      }
    };

    if (whatsappId !== null && whatsappId !== undefined) {
      setSelectedWhatsapp(whatsappId);
    }

    if (user.queues.length === 1) {
      setSelectedQueue(user.queues[0].id);
    }

    fetchWhatsapps();

    return () => {
      isMounted = false;
    };
  }, [modalOpen, channelFilter, companyId, user.queues, whatsappId]);

  useEffect(() => {
    if (!modalOpen || searchParam.length < 3) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get("contacts", {
            params: { searchParam },
          });
          setOptions(data.contacts);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, modalOpen]);

  const IconChannel = (channel) => {
    switch (channel) {
      case "facebook":
        return <Facebook style={{ color: "#3b5998", verticalAlign: "middle" }} />;
      case "instagram":
        return <Instagram style={{ color: "#e1306c", verticalAlign: "middle" }} />;
      case "whatsapp":
        return <WhatsApp style={{ color: "#25d366", verticalAlign: "middle" }} />
      default:
        return "error";
    }
  };

  const handleClose = () => {
    onClose();
    setSearchParam("");
    setOpenAlert(false);
    setUserTicketOpen("");
    setQueueTicketOpen("");
    setSelectedContact(null);
    setTypedInput("");
    setNewContactName("");
  };

  const handleCloseAlert = () => {
    setOpenAlert(false);
    setLoading(false);
    setOpenAlert(false);
    setUserTicketOpen("");
    setQueueTicketOpen("");
  };

  const normalizeNumber = (value) => String(value || "").replace(/\D/g, "");

  const shouldShowInlineName = () => {
    const typedNumber = normalizeNumber(typedInput);
    return (
      !selectedContact &&
      typedNumber.length >= 8 &&
      searchParam.length >= 3 &&
      options.length === 0
    );
  };

  const resolveContactIdForTicket = async () => {
    if (selectedContact?.id) {
      return selectedContact.id;
    }

    if (!shouldShowInlineName()) {
      return null;
    }

    const typedNumber = normalizeNumber(typedInput);
    const typedName = String(newContactName || "").trim();
    const whatsappId = selectedWhatsapp !== "" ? selectedWhatsapp : null;

    if (!typedName) {
      toast.error("Informe o nome do contato");
      return null;
    }

    if (!whatsappId) {
      toast.error("Selecione uma conexão");
      return null;
    }

    const { data } = await api.post("/contacts", {
      name: typedName,
      number: typedNumber,
      whatsappId
    });

    if (data?.id) {
      setSelectedContact(data);
      return data.id;
    }

    return null;
  };

  const handleSaveTicket = async () => {
    setLoading(true);
    try {
      const contactId = await resolveContactIdForTicket();
      if (!contactId) return;

      if (selectedQueue === "") {
        toast.error("Selecione uma fila");
        return;
      }

      if (selectedWhatsapp === "") {
        toast.error("Selecione uma conexão");
        return;
      }

      const queueId = selectedQueue !== "" ? selectedQueue : null;
      const whatsappId = selectedWhatsapp !== "" ? selectedWhatsapp : null;
      const { data: ticket } = await api.post("/tickets", {
        contactId: contactId,
        queueId,
        whatsappId,
        userId: user.id,
        status: "open",
      });

      onClose(ticket);
    } catch (err) {
      try {
        const ticket = JSON.parse(err.response.data.error);

        if (ticket.userId !== user?.id) {
          setOpenAlert(true);
          setUserTicketOpen(ticket?.user?.name);
          setQueueTicketOpen(ticket?.queue?.name);
        } else {
          setOpenAlert(false);
          setUserTicketOpen("");
          setQueueTicketOpen("");
          onClose(ticket);
        }
      } catch (error) {
        toastError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (e, newValue) => {
    if (newValue?.number) {
      setSelectedContact(newValue);
      setNewContactName("");
      return;
    }
    setSelectedContact(null);
  };

  const createAddContactOption = (filterOptions, params) => filter(filterOptions, params);

  const renderOption = option => {
    if (typeof option === "string") {
      return option;
    }
    if (option.number) {
      return <>
        {IconChannel(option.channel)}
        <Typography component="span" style={{ fontSize: 14, marginLeft: "10px", display: "inline-flex", alignItems: "center", lineHeight: "2" }}>
          {option.name} - {option.number}
        </Typography>
      </>
    } else {
      return `${i18n.t("newTicketModal.add")} ${option.name}`;
    }
  };

  const renderOptionLabel = option => {
    if (typeof option === "string") {
      return option;
    }
    if (option.number) {
      return `${option.name} - ${option.number}`;
    } else {
      return `${option.name}`;
    }
  };

  const renderContactAutocomplete = () => {
    if (initialContact === undefined || initialContact.id === undefined) {
      return (
        <Grid xs={12} item>
          <Autocomplete
            fullWidth
            options={options}
            loading={loading}
            clearOnBlur={false}
            autoHighlight
            freeSolo
            clearOnEscape
            getOptionLabel={renderOptionLabel}
            renderOption={renderOption}
            filterOptions={createAddContactOption}
            onChange={(e, newValue) => {                     
              setChannelFilter(newValue ? newValue.channel : "whatsapp");
              handleSelectOption(e, newValue)
            }}
            onInputChange={(event, value, reason) => {
              if (reason === "input" || reason === "clear") {
                setTypedInput(value || "");
                setSearchParam(value || "");
              }
              if (reason === "clear" || (reason === "input" && !value)) {
                setSelectedContact(null);
                setNewContactName("");
              }
            }}
            renderInput={params => (
              <TextField
                {...params}
                label={i18n.t("newTicketModal.fieldLabel")}
                variant="outlined"
                autoFocus
                onKeyPress={e => {
                  if (loading) return;
                  else if (e.key === "Enter") {
                    handleSaveTicket();
                  }
                }}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <React.Fragment>
                      {loading ? (
                        <CircularProgress color="inherit" size={20} />
                      ) : null}
                      {params.InputProps.endAdornment}
                    </React.Fragment>
                  ),
                }}
              />
            )}
          />
        </Grid>
      )
    }
    return null;
  }

  return (
    <>

      <Dialog open={modalOpen} onClose={handleClose} maxWidth="xs" fullWidth classes={{ paper: classes.dialogPaper }}>
        <DialogTitle id="form-dialog-title" className={classes.header}>
          <Typography className={classes.title}>
            {i18n.t("newTicketModal.title")}
          </Typography>
          <Typography className={classes.subtitle}>
            Informe contato, fila e conexão para iniciar o atendimento.
          </Typography>
        </DialogTitle>
        <DialogContent dividers className={classes.content}>
          <Grid className={classes.formGrid} container spacing={2}>
            {/* CONTATO */}
            {renderContactAutocomplete()}
            {/* FILA */}
            {shouldShowInlineName() && (
              <Grid xs={12} item>
                <TextField
                  fullWidth
                  variant="outlined"
                  label="Nome do Contato"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="Nome do Contato"
                />
                <Typography className={classes.inlineInfo}>
                  Número não encontrado. Informe o nome para criar o contato e abrir o ticket.
                </Typography>
              </Grid>
            )}
            {/* FILA */}
            <Grid xs={12} item>
              <Select
                required
                fullWidth
                displayEmpty
                variant="outlined"
                value={selectedQueue}
                onChange={(e) => {
                  setSelectedQueue(e.target.value)
                }}
                MenuProps={{
                  anchorOrigin: {
                    vertical: "bottom",
                    horizontal: "left",
                  },
                  transformOrigin: {
                    vertical: "top",
                    horizontal: "left",
                  },
                  getContentAnchorEl: null,
                }}
                renderValue={() => {
                  if (selectedQueue === "") {
                    return "Selecione uma fila"
                  }
                  const queue = user.queues.find(q => q.id === selectedQueue)
                  return queue.name
                }}
              >
                {user.queues?.length > 0 &&
                  user.queues.map((queue, key) => (
                    <MenuItem dense key={key} value={queue.id}>
                      <ListItemText primary={queue.name} />
                    </MenuItem>
                  ))
                }
              </Select>
            </Grid>
            {/* CONEXAO */}
            <Grid xs={12} item>
              <Select
                required
                fullWidth
                displayEmpty
                variant="outlined"
                value={selectedWhatsapp}
                onChange={(e) => {
                  setSelectedWhatsapp(e.target.value)
                }}
                MenuProps={{
                  anchorOrigin: {
                    vertical: "bottom",
                    horizontal: "left",
                  },
                  transformOrigin: {
                    vertical: "top",
                    horizontal: "left",
                  },
                  getContentAnchorEl: null,
                }}
                renderValue={() => {
                  if (selectedWhatsapp === "") {
                    return "Selecione uma Conexão"
                  }
                  const whatsapp = whatsapps.find(w => w.id === selectedWhatsapp)
                  return whatsapp?.name
                }}
              >
                {whatsapps?.length > 0 &&
                  whatsapps.map((whatsapp) => {
                    const status = getEffectiveConnectionStatus(whatsapp);

                    return (
                      <MenuItem dense key={whatsapp.id} value={whatsapp.id}>
                        <ListItemText
                          primary={
                            <>
                              {IconChannel(whatsapp.channel)}
                              <Typography component="span" style={{ fontSize: 14, marginLeft: "10px", display: "inline-flex", alignItems: "center", lineHeight: "2" }}>
                                {whatsapp.name} &nbsp; <p className={status === "CONNECTED" ? classes.online : classes.offline} >({status})</p>
                              </Typography>
                            </>
                          }
                        />
                      </MenuItem>
                    );
                  })}
              </Select>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleClose}
            color="secondary"
            disabled={loading}
            variant="outlined"
          >
            {i18n.t("newTicketModal.buttons.cancel")}
          </Button>
          <ButtonWithSpinner
            variant="contained"
            type="button"
            disabled={!selectedContact && !shouldShowInlineName()}
            onClick={() => handleSaveTicket()}
            color="primary"
            loading={loading}
          >
            {i18n.t("newTicketModal.buttons.ok")}
          </ButtonWithSpinner>
        </DialogActions>
        {openAlert && (
          <ShowTicketOpen
            isOpen={openAlert}
            handleClose={handleCloseAlert}
            user={userTicketOpen}
            queue={queueTicketOpen}
          />
        )}
      </Dialog >
    </>
  );
};
export default NewTicketModal;
