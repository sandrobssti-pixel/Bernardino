import React, { useContext, useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography
} from "@material-ui/core";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

// Central de criação de lista a partir de grupos do WhatsApp — parte do
// módulo "Lista de Contatos" ser o único lugar de onde toda lista nasce
// (individual, por arquivo, ou por grupo), tirando de dentro da campanha a
// escolha de grupo/contato avulso (ver docs/MANUAL_TECNICO.md).
const ImportGroupContactsModal = ({ open, onClose, onImported }) => {
  const { user } = useContext(AuthContext);
  const [whatsapps, setWhatsapps] = useState([]);
  const [whatsappId, setWhatsappId] = useState("");
  const [mode, setMode] = useState("participants"); // "participants" | "groups"
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [listName, setListName] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) {
      setWhatsappId("");
      setMode("participants");
      setGroups([]);
      setSelectedGroupIds([]);
      setListName("");
      setImporting(false);
      return;
    }
    api
      .get("/whatsapp", { params: { companyId: user.companyId, session: 0 } })
      .then(({ data }) => setWhatsapps(Array.isArray(data) ? data : []))
      .catch((err) => toastError(err));
  }, [open, user.companyId]);

  useEffect(() => {
    if (!open || !whatsappId) {
      setGroups([]);
      setSelectedGroupIds([]);
      return;
    }
    setLoadingGroups(true);
    api
      .get(`/whatsapp/${whatsappId}/groups`)
      .then(({ data }) => setGroups(Array.isArray(data) ? data : []))
      .catch((err) => toastError(err))
      .finally(() => setLoadingGroups(false));
  }, [open, whatsappId]);

  const toggleGroup = (number) => {
    setSelectedGroupIds((prev) =>
      prev.includes(number)
        ? prev.filter((id) => id !== number)
        : [...prev, number]
    );
  };

  const toggleSelectAll = () => {
    setSelectedGroupIds((prev) =>
      prev.length === groups.length ? [] : groups.map((g) => g.number)
    );
  };

  const handleImport = async () => {
    if (!whatsappId || selectedGroupIds.length === 0 || !listName.trim()) {
      return;
    }
    setImporting(true);
    try {
      const { data } = await api.post("/contact-lists/import-groups", {
        whatsappId,
        groupIds: selectedGroupIds,
        mode,
        name: listName.trim()
      });

      const parts = [];
      if (data.imported) parts.push(`${data.imported} importados`);
      if (data.duplicates) parts.push(`${data.duplicates} repetidos`);
      if (data.unresolved) parts.push(`${data.unresolved} sem número identificável`);
      toast.success(
        `Lista "${data.contactList.name}" criada — ${parts.join(", ") || "nada encontrado"}.`
      );

      onImported?.(data.contactList);
    } catch (err) {
      toastError(err);
    } finally {
      setImporting(false);
    }
  };

  const canImport =
    !importing && whatsappId && selectedGroupIds.length > 0 && listName.trim().length >= 2;

  return (
    <Dialog open={open} onClose={() => !importing && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Importar de grupos do WhatsApp</DialogTitle>
      <DialogContent dividers>
        <TextField
          fullWidth
          variant="outlined"
          margin="dense"
          label="Nome da nova lista"
          value={listName}
          onChange={(e) => setListName(e.target.value)}
          disabled={importing}
        />

        <FormControl variant="outlined" margin="dense" fullWidth style={{ marginTop: 8 }}>
          <InputLabel id="import-group-whatsapp-label">Conexão</InputLabel>
          <Select
            labelId="import-group-whatsapp-label"
            label="Conexão"
            value={whatsappId}
            onChange={(e) => setWhatsappId(e.target.value)}
            disabled={importing}
          >
            {whatsapps.map((whatsapp) => (
              <MenuItem key={whatsapp.id} value={whatsapp.id}>
                {whatsapp.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl component="fieldset" margin="dense" style={{ marginTop: 8 }}>
          <FormLabel component="legend">O que importar</FormLabel>
          <RadioGroup
            row
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <FormControlLabel
              value="participants"
              control={<Radio disabled={importing} />}
              label="Participantes dos grupos (um contato por membro)"
            />
            <FormControlLabel
              value="groups"
              control={<Radio disabled={importing} />}
              label="Os grupos como destinatário (uma mensagem por grupo)"
            />
          </RadioGroup>
        </FormControl>

        {!whatsappId && (
          <Typography variant="caption" color="textSecondary">
            Selecione a conexão pra carregar os grupos dela.
          </Typography>
        )}

        {whatsappId && (
          <>
            <FormControlLabel
              style={{ marginTop: 8 }}
              control={
                <Checkbox
                  checked={groups.length > 0 && selectedGroupIds.length === groups.length}
                  indeterminate={
                    selectedGroupIds.length > 0 && selectedGroupIds.length < groups.length
                  }
                  onChange={toggleSelectAll}
                  disabled={importing || loadingGroups || groups.length === 0}
                />
              }
              label="Selecionar todos os grupos"
            />
            {loadingGroups && <LinearProgress />}
            {!loadingGroups && groups.length === 0 && (
              <Typography variant="caption" color="textSecondary">
                Nenhum grupo encontrado nessa conexão.
              </Typography>
            )}
            {!loadingGroups && groups.length > 0 && (
              <List dense style={{ maxHeight: 240, overflowY: "auto" }}>
                {groups.map((group) => (
                  <ListItem key={group.number} disableGutters>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedGroupIds.includes(group.number)}
                          onChange={() => toggleGroup(group.number)}
                          disabled={importing}
                        />
                      }
                      label={`${group.name}${
                        group.participantsCount ? ` (${group.participantsCount})` : ""
                      }`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </>
        )}

        {importing && (
          <div style={{ marginTop: 16 }}>
            <LinearProgress />
            <Typography variant="caption" color="textSecondary">
              Buscando os grupos e montando a lista...
            </Typography>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()} disabled={importing}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleImport}
          disabled={!canImport}
        >
          Importar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportGroupContactsModal;
