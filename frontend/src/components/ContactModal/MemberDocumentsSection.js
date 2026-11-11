import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";

import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import CircularProgress from "@material-ui/core/CircularProgress";
import Accordion from "@material-ui/core/Accordion";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import AccordionDetails from "@material-ui/core/AccordionDetails";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import RadioButtonUncheckedIcon from "@material-ui/icons/RadioButtonUnchecked";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import VisibilityIcon from "@material-ui/icons/Visibility";
import AutorenewIcon from "@material-ui/icons/Autorenew";
import DeleteIcon from "@material-ui/icons/Delete";
import AddIcon from "@material-ui/icons/Add";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import TextField from "@material-ui/core/TextField";

import useMembers from "../../hooks/useMembers";
import toastError from "../../errors/toastError";
import DOCUMENT_GROUPS from "../../pages/Members/memberDocumentsConfig";

// Um slot de documento — "Anexar" quando vazio, "Visualizar/Substituir/
// Excluir" quando já tem arquivo. MESMO componente pra todo tipo de
// documento do catálogo (pedido explícito: "isso para todos os
// campos") — "Substituir" é só chamar onUpload de novo (o upsert
// acontece no backend).
const DocumentSlot = ({ label, doc, onUpload, onDelete, busy }) => {
  const inputRef = useRef(null);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = "";
  };

  return (
    <Paper
      variant="outlined"
      style={{
        padding: 12,
        backgroundColor: doc ? "rgba(14, 164, 115, 0.06)" : "rgba(0,0,0,0.035)",
        borderColor: doc ? "#0ea473" : undefined,
      }}
    >
      <Box display="flex" alignItems="flex-start" gridGap={6}>
        {doc ? (
          <CheckCircleIcon fontSize="small" style={{ color: "#0ea473", marginTop: 2 }} />
        ) : (
          <RadioButtonUncheckedIcon fontSize="small" style={{ color: "rgba(0,0,0,0.3)", marginTop: 2 }} />
        )}
        <Box flex={1} minWidth={0}>
          <Typography variant="body2" style={{ fontWeight: 600 }}>
            {label}
          </Typography>
          <Typography variant="caption" color="textSecondary" noWrap style={{ display: "block" }}>
            {doc ? doc.fileName : "Não entregue"}
          </Typography>
        </Box>
      </Box>
      <input ref={inputRef} type="file" hidden onChange={handleChange} accept="image/*,application/pdf" />
      <Box mt={1} display="flex" gridGap={4} flexWrap="wrap">
        {doc ? (
          <>
            <Button
              size="small"
              startIcon={<VisibilityIcon fontSize="small" />}
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              disabled={busy}
            >
              Visualizar
            </Button>
            <Button
              size="small"
              startIcon={<AutorenewIcon fontSize="small" />}
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              Substituir
            </Button>
            <Button
              size="small"
              style={{ color: "#c62828" }}
              startIcon={<DeleteIcon fontSize="small" />}
              disabled={busy}
              onClick={onDelete}
            >
              Excluir
            </Button>
          </>
        ) : (
          <Button
            size="small"
            startIcon={<AttachFileIcon fontSize="small" />}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Enviando..." : "Anexar"}
          </Button>
        )}
      </Box>
    </Paper>
  );
};

// Checklist completo de documentos do associado — referência real do
// clube-atirador.techsofttecnologia.com.br (tela "Documentos"). Seção
// independente dentro da aba Gerenciador CAC, próprio estado, nunca
// toca no Formik principal da aba. Ver docs/MANUAL_TECNICO.md.
const MemberDocumentsSection = ({ member }) => {
  const members = useMembers();
  const isMounted = useRef(true);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [weapons, setWeapons] = useState([]);
  const [busyKey, setBusyKey] = useState(null);
  const [multiDialog, setMultiDialog] = useState(null); // { documentType, addLabel }
  const [multiLabel, setMultiLabel] = useState("");
  const multiFileRef = useRef(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [docs, weaponList] = await Promise.all([
        members.listDocuments(member.id),
        members.listWeapons(member.id),
      ]);
      if (isMounted.current) {
        setDocuments(docs);
        setWeapons(weaponList);
      }
    } catch (err) {
      toastError(err);
    }
    if (isMounted.current) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const findDoc = (documentType, weaponId) =>
    documents.find((d) => d.documentType === documentType && (d.weaponId || null) === (weaponId || null));

  const handleUpload = async (documentType, weaponId, file, label) => {
    const key = `${documentType}-${weaponId || ""}`;
    setBusyKey(key);
    try {
      const data = await members.uploadDocument(member.id, { documentType, weaponId, label, file });
      setDocuments((prev) => {
        const idx = prev.findIndex((d) => d.id === data.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = data;
          return next;
        }
        return [...prev, data];
      });
      toast.success("Documento enviado.");
    } catch (err) {
      toastError(err);
    }
    setBusyKey(null);
  };

  const handleDelete = async (doc) => {
    try {
      await members.removeDocument(doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success("Documento excluído.");
    } catch (err) {
      toastError(err);
    }
  };

  const handleMultiFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !multiDialog) return;
    await handleUpload(multiDialog.documentType, null, file, multiLabel);
    setMultiDialog(null);
    setMultiLabel("");
  };

  const qualifyingWeapons = weapons.filter((w) => w.usageType === "propria" && w.active);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box>
      <input ref={multiFileRef} type="file" hidden onChange={handleMultiFileChange} accept="image/*,application/pdf" />

      {DOCUMENT_GROUPS.map((group) => {
        const content = (
          <Grid container spacing={2}>
            {group.key === "craf" && (
              <>
                {qualifyingWeapons.length === 0 ? (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary" style={{ fontStyle: "italic" }}>
                      O CRAF é anexado por arma, e só armas com tipo de uso "Própria" e ativas
                      geram o campo de anexo. Este associado tem {weapons.length} arma(s)
                      cadastrada(s), mas nenhuma delas está nessa condição (ex.: importada do
                      sistema antigo, de terceiro/stand ou desativada). Ajuste o cadastro da arma
                      na aba "Dados" e o campo aparece nesta seção.
                    </Typography>
                  </Grid>
                ) : (
                  qualifyingWeapons.map((weapon) => {
                    const doc = findDoc("craf", weapon.id);
                    const key = `craf-${weapon.id}`;
                    return (
                      <Grid item xs={12} sm={6} md={4} key={key}>
                        <DocumentSlot
                          label={`CRAF — ${weapon.brand ? `${weapon.brand} ` : ""}${weapon.model}`}
                          doc={doc}
                          busy={busyKey === key}
                          onUpload={(file) => handleUpload("craf", weapon.id, file)}
                          onDelete={() => handleDelete(doc)}
                        />
                      </Grid>
                    );
                  })
                )}
              </>
            )}

            {group.items.map((item) => {
              if (item.multiple) {
                const items = documents.filter((d) => d.documentType === item.type);
                return (
                  <Grid item xs={12} key={item.type}>
                    {items.length === 0 ? (
                      <Typography variant="body2" color="textSecondary">
                        {item.emptyLabel}
                      </Typography>
                    ) : (
                      <Grid container spacing={2}>
                        {items.map((doc) => (
                          <Grid item xs={12} sm={6} md={4} key={doc.id}>
                            <DocumentSlot
                              label={doc.label || item.label}
                              doc={doc}
                              busy={false}
                              onUpload={(file) => handleUpload(item.type, null, file, doc.label)}
                              onDelete={() => handleDelete(doc)}
                            />
                          </Grid>
                        ))}
                      </Grid>
                    )}
                    <Box mt={1}>
                      <Button
                        type="button"
                        size="small"
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => setMultiDialog({ documentType: item.type })}
                      >
                        {item.addLabel}
                      </Button>
                    </Box>
                  </Grid>
                );
              }

              const doc = findDoc(item.type, null);
              const key = `${item.type}-`;
              return (
                <Grid item xs={12} sm={6} md={4} key={item.type}>
                  <DocumentSlot
                    label={item.label}
                    doc={doc}
                    busy={busyKey === key}
                    onUpload={(file) => handleUpload(item.type, null, file)}
                    onDelete={() => handleDelete(doc)}
                  />
                </Grid>
              );
            })}
          </Grid>
        );

        if (!group.label) {
          return (
            <Box key={group.key} mb={3}>
              {content}
            </Box>
          );
        }

        return (
          <Accordion key={group.key} defaultExpanded={false} style={{ marginBottom: 8 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
                {group.label}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box width="100%">
                {group.key === "cr" && (
                  <Typography variant="caption" color="textSecondary" style={{ display: "block", marginBottom: 12 }}>
                    CR: {member.crNumber || "não informado"} · Validade:{" "}
                    {member.crValidUntil
                      ? new Date(`${member.crValidUntil}T00:00:00`).toLocaleDateString("pt-BR")
                      : "não informada"}
                    . Número e validade do CR são editados na aba "Dados".
                  </Typography>
                )}
                {content}
              </Box>
            </AccordionDetails>
          </Accordion>
        );
      })}

      <Dialog open={!!multiDialog} onClose={() => setMultiDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Adicionar documento</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            autoFocus
            variant="outlined"
            size="small"
            label="Nome do documento"
            value={multiLabel}
            onChange={(e) => setMultiLabel(e.target.value)}
            style={{ marginTop: 8 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMultiDialog(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color="primary"
            disabled={!multiLabel.trim()}
            onClick={() => multiFileRef.current?.click()}
          >
            Escolher arquivo
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MemberDocumentsSection;
