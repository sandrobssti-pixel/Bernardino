import React, { useState } from "react";

import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import SendIcon from "@material-ui/icons/Send";

// Diálogo de mensagem ao vivo do supervisor pro atendente (ver
// docs/MANUAL_TECNICO.md) — usado a partir do "Painel" (MomentsUser), um
// por ticket, pra corrigir o atendimento em tempo real sem entrar na
// conversa com o cliente.
const SupervisorMessageDialog = ({ open, onClose, onSend, ticketLabel }) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleClose = () => {
    setMessage("");
    onClose();
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await onSend(message.trim());
      setMessage("");
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Mensagem para o atendente</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {ticketLabel}
        </Typography>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={3}
          variant="outlined"
          placeholder="Ex.: confirme o CPF do cliente antes de fechar o atendimento"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={sending}>Cancelar</Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<SendIcon />}
          onClick={handleSend}
          disabled={sending || !message.trim()}
        >
          Enviar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SupervisorMessageDialog;
