import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Typography
} from "@material-ui/core";
import PublishIcon from "@material-ui/icons/Publish";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

// Importa uma planilha (.xlsx/.csv) e monta a lista de contatos conforme os
// campos do próprio arquivo — só o número de WhatsApp (detectado por
// telefone/celular/whatsapp/... ou, se não achar, a primeira coluna que
// "parecer" telefone) é usado pela campanha; todo o resto (cpf, vigência,
// status, etc.) fica guardado como dado extra, só pra consulta/organização
// da lista (ver docs/MANUAL_TECNICO.md).
const ImportFileContactsModal = ({ open, onClose, contactList }) => {
  const { user, socket } = useContext(AuthContext);
  const fileInputRef = useRef();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setUploading(false);
      setProgress(null);
    }
  }, [open]);

  useEffect(() => {
    if (!socket || !user?.companyId || !contactList?.id) return;
    const companyId = user.companyId;

    const onImportProgress = (payload) => {
      setProgress(payload);
      if (payload?.status === "done") {
        setUploading(false);
        toast.success("Arquivo importado com sucesso.");
        onClose(true);
      }
    };

    const eventName = `company-${companyId}-ContactListImport-${contactList.id}`;
    socket.on(eventName, onImportProgress);
    return () => socket.off(eventName, onImportProgress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, user, contactList, open]);

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const picked = e.target.files?.[0];
    if (picked) setFile(picked);
  };

  const handleUpload = async () => {
    if (!file || !contactList?.id) return;
    setUploading(true);
    setProgress({ status: "running", total: 0, processed: 0, percent: 0 });
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post(`/contact-lists/${contactList.id}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      // A conclusão real chega via socket (onImportProgress, status "done"),
      // que fecha o modal — este await só confirma que o upload em si
      // (envio do arquivo) terminou, não que o processamento acabou.
    } catch (err) {
      setUploading(false);
      toastError(err);
    }
  };

  return (
    <Dialog open={open} onClose={() => !uploading && onClose(false)} fullWidth maxWidth="sm">
      <DialogTitle>
        Importar arquivo {contactList?.name ? `— ${contactList.name}` : ""}
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Envie uma planilha (.xlsx ou .csv). O sistema detecta sozinho a
          coluna do número de WhatsApp (telefone/celular/whatsapp/...) — as
          demais colunas da planilha (CPF, vigência, status, etc.) ficam
          guardadas na lista só pra consulta, sem entrar na campanha.
        </Typography>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <Button
          variant="outlined"
          startIcon={<PublishIcon />}
          onClick={handlePickFile}
          disabled={uploading}
          style={{ marginTop: 8 }}
        >
          {file ? file.name : "Escolher arquivo"}
        </Button>

        {progress && (
          <div style={{ marginTop: 16 }}>
            <LinearProgress
              variant={progress.total ? "determinate" : "indeterminate"}
              value={progress.percent || 0}
            />
            <Typography variant="caption" color="textSecondary">
              {progress.total
                ? `${progress.processed}/${progress.total} — importados: ${progress.imported || 0}, já existiam: ${progress.duplicates || 0}, inválidos: ${progress.invalid || 0}`
                : "Processando..."}
            </Typography>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)} disabled={uploading}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          Importar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportFileContactsModal;
