import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tabs,
  Tab,
  Typography
} from "@material-ui/core";
import GroupIcon from "@material-ui/icons/Group";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";

// Atalho pra campanha mandar mensagem direto pra um GRUPO do WhatsApp ou pra
// um NÚMERO AVULSO, sem precisar montar uma lista de contatos na mão antes.
// Por baixo dos panos reaproveita 100% o mesmo motor de disparo já existente
// (lista de contatos + item da lista) — só automatiza a criação da lista
// "guarda-chuva" e do item, e escolhe ela no campo de lista da campanha (ver
// docs/MANUAL_TECNICO.md).
const CampaignRecipientPicker = ({ whatsappId, onPicked, disabled }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0); // 0 = grupo, 1 = individual
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [individualName, setIndividualName] = useState("");
  const [individualNumber, setIndividualNumber] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || tab !== 0 || !whatsappId) {
      setGroups([]);
      return;
    }
    const loadGroups = async () => {
      setLoadingGroups(true);
      try {
        // Busca direto da conexão do WhatsApp (Baileys), trazendo TODOS os
        // grupos que a conexão participa — não depende de já ter trocado
        // mensagem com o grupo antes (ver docs/MANUAL_TECNICO.md).
        const { data } = await api.get(`/whatsapp/${whatsappId}/groups`);
        setGroups(Array.isArray(data) ? data : []);
      } catch (err) {
        toastError(err);
      } finally {
        setLoadingGroups(false);
      }
    };
    loadGroups();
  }, [open, tab, whatsappId]);

  const handleClose = () => {
    setOpen(false);
    setSelectedGroupId("");
    setIndividualName("");
    setIndividualNumber("");
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const { data: quickList } = await api.get("/contact-lists/quick-list");

      if (tab === 0) {
        if (!selectedGroupId) return;
        const group = groups.find((g) => g.number === selectedGroupId);
        if (!group) return;
        await api.post("/contact-list-items/group", {
          name: group.name,
          number: group.number,
          contactListId: quickList.id
        });
        toast.success(`Grupo "${group.name}" selecionado como destinatário.`);
      } else {
        if (!individualNumber.trim()) return;
        await api.post("/contact-list-items", {
          name: individualName.trim() || individualNumber.trim(),
          number: individualNumber.trim(),
          contactListId: quickList.id
        });
        toast.success("Contato individual selecionado como destinatário.");
      }

      onPicked?.(quickList.id, quickList.name);
      handleClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const canConfirm =
    tab === 0 ? !!selectedGroupId : individualNumber.trim().length > 0;

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<GroupIcon fontSize="small" />}
        onClick={() => setOpen(true)}
        disabled={disabled}
        style={{ marginTop: 4 }}
      >
        Grupo ou contato avulso
      </Button>

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
        <DialogTitle>Escolher destinatário</DialogTitle>
        <DialogContent dividers>
          <Tabs
            value={tab}
            onChange={(e, v) => setTab(v)}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
          >
            <Tab label="Grupo do WhatsApp" />
            <Tab label="Contato individual" />
          </Tabs>

          {tab === 0 ? (
            <FormControl variant="outlined" margin="dense" fullWidth style={{ marginTop: 16 }}>
              <InputLabel id="campaign-group-picker-label">Grupo</InputLabel>
              <Select
                labelId="campaign-group-picker-label"
                label="Grupo"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                disabled={loadingGroups}
              >
                {groups.map((group) => (
                  <MenuItem key={group.number} value={group.number}>
                    {group.name}
                    {group.participantsCount
                      ? ` (${group.participantsCount})`
                      : ""}
                  </MenuItem>
                ))}
              </Select>
              {!whatsappId && (
                <Typography variant="caption" color="textSecondary" style={{ marginTop: 8 }}>
                  Selecione a conexão (WhatsApp) da campanha antes, pra
                  carregar os grupos dela.
                </Typography>
              )}
              {whatsappId && !loadingGroups && groups.length === 0 && (
                <Typography variant="caption" color="textSecondary" style={{ marginTop: 8 }}>
                  Nenhum grupo encontrado nessa conexão. Confira se o número
                  está mesmo participando de algum grupo do WhatsApp.
                </Typography>
              )}
            </FormControl>
          ) : (
            <>
              <TextField
                fullWidth
                variant="outlined"
                margin="dense"
                label="Nome (opcional)"
                value={individualName}
                onChange={(e) => setIndividualName(e.target.value)}
              />
              <TextField
                fullWidth
                variant="outlined"
                margin="dense"
                label="Número de WhatsApp"
                placeholder="Ex.: 5511999999999"
                value={individualNumber}
                onChange={(e) => setIndividualNumber(e.target.value)}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={saving}>Cancelar</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleConfirm}
            disabled={saving || !canConfirm}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CampaignRecipientPicker;
