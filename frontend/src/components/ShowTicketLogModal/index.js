import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import { i18n } from '../../translate/i18n';
import { Stepper, Step, StepLabel, Typography, Paper, Grid } from '@material-ui/core';
import { format, parseISO } from 'date-fns';
import api from '../../services/api';
import toastError from "../../errors/toastError";

const ShowTicketLogModal = ({ isOpen, handleClose, ticketId }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  const typeDescriptions = {
    create: i18n.t("showTicketLogModal.options.create"),
    chatBot: i18n.t("showTicketLogModal.options.chatBot"),
    queue: i18n.t("showTicketLogModal.options.queue"),
    open: i18n.t("showTicketLogModal.options.open"),
    access: i18n.t("showTicketLogModal.options.access"),
    transfered: i18n.t("showTicketLogModal.options.transfered"),
    receivedTransfer: i18n.t("showTicketLogModal.options.receivedTransfer"),
    pending: i18n.t("showTicketLogModal.options.pending"),
    closed: i18n.t("showTicketLogModal.options.closed"),
    reopen: i18n.t("showTicketLogModal.options.reopen"),
    redirect: i18n.t("showTicketLogModal.options.redirect")
    // Adicione outros mapeamentos conforme necessário
  };

  const resolveActorLabel = (log) => {
    if (["access", "transfered", "open", "pending", "closed", "reopen"].includes(log?.type)) {
      return String(log?.user?.name || "").trim();
    }
    if (log?.type === "queue") {
      return String(log?.queue?.name || "").trim();
    }
    if (log?.type === "redirect") {
      return "Sistema";
    }
    if (log?.type === "receivedTransfer") {
      const queueName = String(log?.queue?.name || "").trim();
      const userName = String(log?.user?.name || "").trim();
      return [queueName, userName].filter(Boolean).join(" - ");
    }
    return "";
  };

  const resolveTypeLabel = (log) => {
    if (log?.type === "redirect") {
      const queueName = String(log?.queue?.name || "").trim();
      return queueName
        ? `redirecionou automaticamente para a fila ${queueName}.`
        : "redirecionou automaticamente para uma fila.";
    }

    const translated = String(typeDescriptions?.[log?.type] || "").trim();
    if (translated) return translated;
    return String(log?.type || "evento");
  };

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchLogs = async () => {
        try {
          const { data } = await api.get(`/tickets-log/${ticketId}`);
          setLogs(data);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchLogs();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [ticketId]);

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <DialogTitle>{i18n.t('showTicketLogModal.title.header')}</DialogTitle>
      <DialogContent>
        <Paper>
          <DialogContentText>
            <Stepper activeStep={activeStep} orientation="vertical">
              {logs.map((log, index) => (
                <Step key={index}>
                  <StepLabel>
                    {`${resolveActorLabel(log)} ${resolveTypeLabel(log)} - ${format(
                      parseISO(log?.createdAt),
                      'dd/MM/yyyy HH:mm'
                    )}`}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          </DialogContentText>
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShowTicketLogModal;
