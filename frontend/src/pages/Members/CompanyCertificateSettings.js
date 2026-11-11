import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";

import Paper from "@material-ui/core/Paper";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import TextField from "@material-ui/core/TextField";
import VerifiedUserIcon from "@material-ui/icons/VerifiedUser";
import WarningIcon from "@material-ui/icons/Warning";

import useCompanyCertificate from "../../hooks/useCompanyCertificate";
import toastError from "../../errors/toastError";

// Certificado digital A1 (.pfx/.p12) da entidade — pedido do cliente:
// "coloca um campo inserir certificado digital". Usado pra assinar
// digitalmente a Declaração de Filiação (Anexo B, Decreto 11.615/2023)
// e outros documentos oficiais. O arquivo e a senha NUNCA aparecem de
// novo depois de enviados (ficam só criptografados no banco) — só
// metadados informativos (nome do arquivo, titular, validade). Ver
// docs/MANUAL_TECNICO.md.
const CompanyCertificateSettings = () => {
  const certificate = useCompanyCertificate();
  const isMounted = useRef(true);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await certificate.getStatus();
      if (isMounted.current) setStatus(data);
    } catch (err) {
      // Sem acesso (não-admin) ou módulo sem o certificado ainda — não
      // é um erro pra mostrar, só esconde a seção.
      if (isMounted.current) setStatus(null);
    }
    if (isMounted.current) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleOpenDialog = () => {
    setFile(null);
    setPassword("");
    setDialogOpen(true);
  };

  const handleUpload = async () => {
    if (!file || !password) return;
    setSaving(true);
    try {
      const data = await certificate.upload({ file, password });
      setStatus(data);
      toast.success("Certificado digital salvo.");
      setDialogOpen(false);
    } catch (err) {
      toastError(err);
    }
    setSaving(false);
  };

  const handleRemove = async () => {
    try {
      await certificate.remove();
      setStatus({ hasCertificate: false });
      toast.success("Certificado digital removido.");
    } catch (err) {
      toastError(err);
    }
  };

  if (loading || !status) return null;

  const validUntilDate = status.validUntil ? new Date(status.validUntil) : null;
  const expired = validUntilDate && validUntilDate < new Date();

  return (
    <Paper variant="outlined" style={{ padding: 16, marginBottom: 16 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gridGap={8}>
        <Box display="flex" alignItems="center" gridGap={8}>
          {status.hasCertificate ? (
            <VerifiedUserIcon style={{ color: expired ? "#c62828" : "#0ea473" }} />
          ) : (
            <WarningIcon style={{ color: "#bdbdbd" }} />
          )}
          <Box>
            <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
              Certificado digital da entidade (assinatura de documentos oficiais)
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {status.hasCertificate
                ? `${status.subjectName || status.fileName}${
                    validUntilDate
                      ? ` — ${expired ? "VENCIDO em" : "válido até"} ${validUntilDate.toLocaleDateString("pt-BR")}`
                      : ""
                  }`
                : "Nenhum certificado cadastrado ainda."}
            </Typography>
          </Box>
        </Box>
        <Box display="flex" gridGap={8}>
          <Button size="small" variant="outlined" onClick={handleOpenDialog}>
            {status.hasCertificate ? "Substituir" : "Inserir certificado digital"}
          </Button>
          {status.hasCertificate && (
            <Button size="small" style={{ color: "#c62828" }} onClick={handleRemove}>
              Remover
            </Button>
          )}
        </Box>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Certificado digital (A1)</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Envie o arquivo .pfx/.p12 do certificado A1 da entidade e a senha
            dele. Ficam guardados criptografados — nunca aparecem de novo
            depois de salvos.
          </Typography>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pfx,.p12"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <Box mt={2}>
            <Button variant="outlined" fullWidth onClick={() => fileInputRef.current?.click()}>
              {file ? file.name : "Escolher arquivo (.pfx/.p12)"}
            </Button>
          </Box>
          <TextField
            fullWidth
            type="password"
            variant="outlined"
            size="small"
            label="Senha do certificado"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginTop: 16 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="primary"
            disabled={!file || !password || saving}
            onClick={handleUpload}
          >
            {saving ? <CircularProgress size={20} /> : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default CompanyCertificateSettings;
