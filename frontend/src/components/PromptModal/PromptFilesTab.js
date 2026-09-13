import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { makeStyles } from "@material-ui/core/styles";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  TextField,
  Typography
} from "@material-ui/core";
import { DeleteOutline, AttachFile, InsertDriveFile } from "@material-ui/icons";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => {
  const isDark = theme.palette.type === "dark";

  return {
    helpText: {
      fontSize: "0.78rem",
      color: isDark ? "#94a3b8" : "#64748b",
      lineHeight: 1.5,
      marginBottom: 14
    },
    uploadBox: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      padding: 14,
      borderRadius: 12,
      border: `1px dashed ${
        isDark ? "rgba(255,255,255,0.18)" : "rgba(15, 23, 42, 0.2)"
      }`,
      backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(15,23,42,0.015)",
      marginBottom: 16
    },
    fileRow: {
      display: "flex",
      alignItems: "center",
      gap: 8
    },
    emptyState: {
      fontSize: "0.8rem",
      color: isDark ? "#64748b" : "#94a3b8",
      padding: "16px 0",
      textAlign: "center"
    },
    fileName: {
      fontWeight: 600,
      fontSize: "0.82rem",
      color: isDark ? "#f1f5f9" : "#0f172a",
      lineHeight: 1.2
    },
    fileDescription: {
      fontSize: "0.72rem",
      color: isDark ? "#94a3b8" : "#64748b",
      marginTop: 1
    }
  };
});

// Catálogo único por empresa: os arquivos cadastrados aqui ficam
// disponíveis para qualquer IA da empresa (assistente geral de /prompts
// e qualquer nó de IA do flowbuilder).
const PromptFilesTab = () => {
  const classes = useStyles();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/prompt-files");
      setFiles(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleAdd = async () => {
    if (!selectedFile || !name.trim() || !description.trim()) {
      toast.warn("Preencha nome, descrição e selecione um arquivo.");
      return;
    }

    const formData = new FormData();
    formData.append("typeArch", "promptFiles");
    formData.append("name", name.trim());
    formData.append("description", description.trim());
    formData.append("file", selectedFile);

    setUploading(true);
    try {
      await api.post("/prompt-files", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success("Arquivo adicionado ao catálogo da IA!");
      setName("");
      setDescription("");
      setSelectedFile(null);
      fetchFiles();
    } catch (err) {
      toastError(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async fileId => {
    try {
      await api.delete(`/prompt-files/${fileId}`);
      toast.success("Arquivo removido do catálogo da IA!");
      fetchFiles();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Box>
      <div className={classes.helpText}>
        Cadastre imagens e documentos que a IA pode enviar durante o atendimento.
        Descreva claramente quando cada arquivo deve ser enviado — a IA usa essa
        descrição para decidir o momento certo. Este catálogo é único para a
        empresa e fica disponível tanto para o assistente geral de IA quanto
        para qualquer nó de IA usado no flowbuilder. O envio desses arquivos
        funciona com qualquer provedor (OpenAI, Gemini, DeepSeek ou Groq); já a
        leitura de imagens enviadas pelo cliente (visão) só funciona com OpenAI
        e Gemini.
      </div>

      <div className={classes.uploadBox}>
        <TextField
          label="Nome do arquivo"
          value={name}
          onChange={e => setName(e.target.value)}
          variant="outlined"
          margin="dense"
          size="small"
          fullWidth
        />
        <TextField
          label="Quando a IA deve enviar este arquivo"
          value={description}
          onChange={e => setDescription(e.target.value)}
          variant="outlined"
          margin="dense"
          size="small"
          fullWidth
          multiline
          minRows={2}
        />
        <div className={classes.fileRow}>
          <Button
            variant="outlined"
            component="label"
            startIcon={<AttachFile />}
            size="small"
          >
            {selectedFile ? selectedFile.name : "Selecionar arquivo"}
            <input
              type="file"
              hidden
              onChange={e => setSelectedFile(e.target.files?.[0] || null)}
            />
          </Button>
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={handleAdd}
            disabled={uploading}
          >
            {uploading ? <CircularProgress size={18} /> : "Adicionar"}
          </Button>
        </div>
      </div>

      {loading ? (
        <Box display="flex" justifyContent="center" padding={2}>
          <CircularProgress size={24} />
        </Box>
      ) : files.length === 0 ? (
        <Typography className={classes.emptyState}>
          Nenhum arquivo cadastrado ainda.
        </Typography>
      ) : (
        <List dense>
          {files.map(file => (
            <ListItem key={file.id} divider>
              <InsertDriveFile
                fontSize="small"
                style={{ marginRight: 10, color: "#64748b" }}
              />
              <ListItemText
                primary={file.name}
                secondary={file.description}
                primaryTypographyProps={{ className: classes.fileName }}
                secondaryTypographyProps={{ className: classes.fileDescription }}
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  size="small"
                  onClick={() => handleDelete(file.id)}
                >
                  <DeleteOutline fontSize="small" />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default PromptFilesTab;
