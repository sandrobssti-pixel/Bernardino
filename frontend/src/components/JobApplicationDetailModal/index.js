import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";

import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import CircularProgress from "@material-ui/core/CircularProgress";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import Divider from "@material-ui/core/Divider";
import Rating from "@material-ui/lab/Rating";
import DescriptionIcon from "@material-ui/icons/Description";

import ConfirmationModal from "../ConfirmationModal";
import toastError from "../../errors/toastError";
import { getBackendUrl } from "../../config";

// Modal de triagem de candidatura (Fase 5 — módulo de RH, ver
// docs/MANUAL_TECNICO.md, seção 6.2): status/observações/nota + efetivação
// (transforma o candidato num User da empresa, com senha provisória).
const JobApplicationDetailModal = ({ open, onClose, onSaved, application, hr }) => {
  const [status, setStatus] = useState("received");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmHireOpen, setConfirmHireOpen] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState(null);

  useEffect(() => {
    if (application) {
      setStatus(application.status || "received");
      setNotes(application.notes || "");
      setRating(application.rating ?? null);
      setTemporaryPassword(null);
    }
  }, [application, open]);

  if (!application) return null;

  const resumeUrl = application.resumeUrl
    ? `${getBackendUrl()}/public/${application.resumeUrl}`
    : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await hr.jobApplications.update(application.id, { status, notes, rating });
      toast.success("Candidatura atualizada.");
      onSaved();
      onClose();
    } catch (err) {
      toastError(err);
    }
    setSaving(false);
  };

  const handleHire = async () => {
    setHiring(true);
    try {
      const result = await hr.jobApplications.hire(application.id);
      setTemporaryPassword(result.temporaryPassword);
      toast.success("Candidato efetivado com sucesso!");
      onSaved();
    } catch (err) {
      toastError(err);
    }
    setHiring(false);
    setConfirmHireOpen(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>Candidatura — {application.candidateName}</DialogTitle>
      <DialogContent dividers={false}>
        <Grid container spacing={1}>
          <Grid item xs={12}>
            <Typography variant="body2">
              <strong>Vaga:</strong> {application.jobPosting?.title || "—"}
            </Typography>
            <Typography variant="body2">
              <strong>E-mail:</strong> {application.candidateEmail}
            </Typography>
            <Typography variant="body2">
              <strong>Telefone:</strong> {application.candidatePhone || "—"}
            </Typography>
            {resumeUrl && (
              <Button
                size="small"
                startIcon={<DescriptionIcon />}
                href={resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginTop: 8 }}
              >
                Ver currículo
              </Button>
            )}
          </Grid>

          {application.coverLetter && (
            <Grid item xs={12}>
              <Divider style={{ margin: "8px 0" }} />
              <Typography variant="caption" color="textSecondary">Carta de apresentação</Typography>
              <Typography variant="body2">{application.coverLetter}</Typography>
            </Grid>
          )}

          <Grid item xs={12}>
            <Divider style={{ margin: "8px 0" }} />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              variant="outlined"
              size="small"
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <MenuItem value="received">Recebida</MenuItem>
              <MenuItem value="screening">Em triagem</MenuItem>
              <MenuItem value="interview">Entrevista</MenuItem>
              <MenuItem value="approved">Aprovada</MenuItem>
              <MenuItem value="rejected">Reprovada</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box display="flex" alignItems="center" height="100%">
              <Typography variant="body2" style={{ marginRight: 8 }}>Avaliação:</Typography>
              <Rating
                value={rating ? Number(rating) : null}
                onChange={(e, newValue) => setRating(newValue)}
              />
            </Box>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              multiline
              minRows={3}
              label="Observações internas"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Grid>

          {application.hiredUserId && (
            <Grid item xs={12}>
              <Typography variant="body2" style={{ color: "#10b981", fontWeight: 600 }}>
                Este candidato já foi efetivado como usuário do sistema.
              </Typography>
            </Grid>
          )}

          {temporaryPassword && (
            <Grid item xs={12}>
              <Box p={1.5} bgcolor="#f0fdf4" borderRadius={8}>
                <Typography variant="body2" style={{ fontWeight: 700 }}>
                  Usuário criado! Senha provisória: {temporaryPassword}
                </Typography>
                <Typography variant="caption">
                  Anote e repasse ao novo funcionário — essa senha não será mostrada novamente.
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        {!application.hiredUserId && (
          <Button
            onClick={() => setConfirmHireOpen(true)}
            color="primary"
            disabled={saving || hiring}
          >
            {hiring ? <CircularProgress size={18} /> : "Efetivar candidato"}
          </Button>
        )}
        <Button onClick={onClose} color="secondary" disabled={saving}>
          Fechar
        </Button>
        <Button onClick={handleSave} color="primary" variant="contained" disabled={saving}>
          {saving ? <CircularProgress size={20} /> : "Salvar"}
        </Button>
      </DialogActions>

      <ConfirmationModal
        title="Efetivar candidato?"
        open={confirmHireOpen}
        onClose={() => setConfirmHireOpen(false)}
        onConfirm={handleHire}
      >
        Isso cria um usuário de verdade para {application.candidateName} nesta empresa, com uma
        senha provisória gerada automaticamente. Não é possível desfazer.
      </ConfirmationModal>
    </Dialog>
  );
};

export default JobApplicationDetailModal;
