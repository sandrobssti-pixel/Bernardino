import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField
} from "@material-ui/core";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";

// Cria uma lista de contatos com um único contato avulso — antes esse
// atalho vivia dentro da campanha (CampaignRecipientPicker); agora fica só
// aqui em Lista de Contatos, junto dos outros jeitos de criar lista (ver
// docs/MANUAL_TECNICO.md).
const AddSingleContactListModal = ({ open, onClose, onCreated }) => {
  const [listName, setListName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    if (saving) return;
    setListName("");
    setContactName("");
    setContactNumber("");
    onClose();
  };

  const handleSave = async () => {
    if (!listName.trim() || !contactNumber.trim()) return;
    setSaving(true);
    try {
      const { data: contactList } = await api.post("/contact-lists", {
        name: listName.trim()
      });

      await api.post("/contact-list-items", {
        name: contactName.trim() || contactNumber.trim(),
        number: contactNumber.trim(),
        contactListId: contactList.id
      });

      toast.success(`Lista "${contactList.name}" criada com o contato.`);
      onCreated?.(contactList);
      handleClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const canSave = !saving && listName.trim().length >= 2 && contactNumber.trim().length > 0;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Adicionar contato avulso</DialogTitle>
      <DialogContent dividers>
        <TextField
          fullWidth
          variant="outlined"
          margin="dense"
          label="Nome da nova lista"
          value={listName}
          onChange={(e) => setListName(e.target.value)}
          disabled={saving}
        />
        <TextField
          fullWidth
          variant="outlined"
          margin="dense"
          label="Nome do contato (opcional)"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          disabled={saving}
        />
        <TextField
          fullWidth
          variant="outlined"
          margin="dense"
          label="Número de WhatsApp"
          placeholder="Ex.: 5511999999999"
          value={contactNumber}
          onChange={(e) => setContactNumber(e.target.value)}
          disabled={saving}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={!canSave}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddSingleContactListModal;
