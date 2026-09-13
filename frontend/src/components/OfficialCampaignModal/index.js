import React, { useContext, useEffect, useMemo, useState } from "react";
import moment from "moment";
import { toast } from "react-toastify";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles(theme => ({
  dialogPaper: {
    borderRadius: 12,
    overflow: "hidden",
    border: `1px solid ${theme.palette.divider}`
  },
  section: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(2)
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: 13,
    marginBottom: theme.spacing(0.5)
  },
  helper: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    lineHeight: 1.45
  }
}));

const initialState = {
  name: "",
  contactListId: "",
  whatsappId: "",
  templateCategory: "",
  templateIdMeta: "",
  scheduledAt: "",
  headerVariables: [],
  bodyVariables: [],
  headerMediaUrl: ""
};

const MEDIA_HEADER_FORMATS = ["IMAGE", "VIDEO", "DOCUMENT"];

const toUpper = value => String(value || "").toUpperCase();

const getComponent = (components = [], targetType) =>
  components.find(component => toUpper(component?.type) === toUpper(targetType));

const getHeaderFormat = (components = []) => {
  const header = getComponent(components, "HEADER");
  const format = toUpper(header?.format);
  return format || null;
};

const getPlaceholderCount = (components = [], targetType) => {
  const component = getComponent(components, targetType);
  const text = String(component?.text || "");
  const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)];
  if (!matches.length) return 0;
  return matches.reduce((max, match) => {
    const current = Number(match?.[1] || 0);
    return Number.isFinite(current) && current > max ? current : max;
  }, 0);
};

const replaceIndexedPlaceholders = (text, values = []) =>
  String(text || "").replace(/\{\{(\d+)\}\}/g, (_, rawIndex) => {
    const index = Number(rawIndex) - 1;
    return values[index] || `{{${rawIndex}}}`;
  });

const OfficialCampaignModal = ({ open, onClose, campaignId, onSave }) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [form, setForm] = useState(initialState);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncingTemplates, setSyncingTemplates] = useState(false);
  const [contactLists, setContactLists] = useState([]);
  const [officialConnections, setOfficialConnections] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [errors, setErrors] = useState({});
  const [uploadingHeaderMedia, setUploadingHeaderMedia] = useState(false);
  const [headerMediaFileName, setHeaderMediaFileName] = useState("");

  const selectedTemplate = useMemo(
    () =>
      templates.find(
        template => String(template.templateIdMeta) === String(form.templateIdMeta)
      ) || null,
    [templates, form.templateIdMeta]
  );

  const approvedTemplates = useMemo(
    () =>
      templates.filter(
        template => String(template.status || "").toUpperCase() === "APPROVED"
      ),
    [templates]
  );

  const categories = useMemo(() => {
    const unique = new Set();
    approvedTemplates.forEach(template => {
      if (template.category) unique.add(template.category);
    });
    return Array.from(unique);
  }, [approvedTemplates]);

  const filteredTemplates = useMemo(() => {
    if (!form.templateCategory) return approvedTemplates;
    return approvedTemplates.filter(
      template => String(template.category || "") === String(form.templateCategory)
    );
  }, [approvedTemplates, form.templateCategory]);

  const templateComponents = useMemo(() => {
    if (selectedTemplate?.components) return selectedTemplate.components;
    return [];
  }, [selectedTemplate]);

  const headerFormat = useMemo(
    () => getHeaderFormat(templateComponents),
    [templateComponents]
  );
  const isMediaHeader = MEDIA_HEADER_FORMATS.includes(headerFormat);

  const headerCount = useMemo(
    () => (isMediaHeader ? 0 : getPlaceholderCount(templateComponents, "HEADER")),
    [templateComponents, isMediaHeader]
  );
  const bodyCount = useMemo(
    () => getPlaceholderCount(templateComponents, "BODY"),
    [templateComponents]
  );

  const headerPreview = isMediaHeader
    ? form.headerMediaUrl
      ? `[${headerFormat}] ${headerMediaFileName || form.headerMediaUrl}`
      : ""
    : replaceIndexedPlaceholders(
        String(getComponent(templateComponents, "HEADER")?.text || ""),
        form.headerVariables
      );
  const bodyPreview = replaceIndexedPlaceholders(
    String(getComponent(templateComponents, "BODY")?.text || ""),
    form.bodyVariables
  );

  const loadTemplates = async whatsappId => {
    if (!whatsappId) {
      setTemplates([]);
      return;
    }

    const { data } = await api.get(`/whatsapp/${whatsappId}/templates`);
    setTemplates(Array.isArray(data?.templates) ? data.templates : []);
  };

  useEffect(() => {
    if (!open) return;

    const loadBase = async () => {
      setLoading(true);
      try {
        const [contactListsRes, connectionsRes] = await Promise.all([
          api.get("/contact-lists/list", {
            params: { companyId: user?.companyId }
          }),
          api.get("/whatsapp/filter", {
            params: { session: 0, channel: "whatsapp_oficial" }
          })
        ]);

        setContactLists(Array.isArray(contactListsRes.data) ? contactListsRes.data : []);
        setOfficialConnections(
          Array.isArray(connectionsRes.data) ? connectionsRes.data : []
        );

        if (campaignId) {
          const { data } = await api.get(`/official-campaigns/${campaignId}`);
          setForm({
            name: data.name || "",
            contactListId: data.contactListId || "",
            whatsappId: data.whatsappId || "",
            templateCategory: data.templateCategory || "",
            templateIdMeta: data.templateIdMeta || "",
            scheduledAt: data.scheduledAt
              ? moment(data.scheduledAt).format("YYYY-MM-DDTHH:mm")
              : "",
            headerVariables: Array.isArray(data.headerVariables)
              ? data.headerVariables
              : [],
            bodyVariables: Array.isArray(data.bodyVariables)
              ? data.bodyVariables
              : [],
            headerMediaUrl: data.headerMediaUrl || ""
          });
          setHeaderMediaFileName(
            data.headerMediaUrl ? String(data.headerMediaUrl).split("/").pop() : ""
          );
          await loadTemplates(data.whatsappId);
        } else {
          setForm(initialState);
          setTemplates([]);
          setHeaderMediaFileName("");
        }
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    };

    loadBase();
  }, [open, campaignId, user?.companyId]);

  useEffect(() => {
    const nextHeader = Array.from(
      { length: headerCount },
      (_, index) => form.headerVariables[index] || ""
    );
    const nextBody = Array.from(
      { length: bodyCount },
      (_, index) => form.bodyVariables[index] || ""
    );

    if (
      JSON.stringify(nextHeader) !== JSON.stringify(form.headerVariables) ||
      JSON.stringify(nextBody) !== JSON.stringify(form.bodyVariables)
    ) {
      setForm(prev => ({
        ...prev,
        headerVariables: nextHeader,
        bodyVariables: nextBody
      }));
    }
  }, [headerCount, bodyCount]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: false }));
  };

  const handleConnectionChange = async event => {
    const nextWhatsappId = event.target.value;
    setForm(prev => ({
      ...prev,
      whatsappId: nextWhatsappId,
      templateCategory: "",
      templateIdMeta: "",
      headerVariables: [],
      bodyVariables: [],
      headerMediaUrl: ""
    }));
    setHeaderMediaFileName("");
    setTemplates([]);

    try {
      await loadTemplates(nextWhatsappId);
    } catch (err) {
      toastError(err);
    }
  };

  const handleSyncTemplates = async () => {
    if (!form.whatsappId) {
      toast.error("Selecione a conexão oficial antes de sincronizar os templates.");
      return;
    }

    try {
      setSyncingTemplates(true);
      await api.post(`/whatsapp/${form.whatsappId}/templates/sync`);
      await loadTemplates(form.whatsappId);
      toast.success("Templates sincronizados com sucesso.");
    } catch (err) {
      toastError(err);
    } finally {
      setSyncingTemplates(false);
    }
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = true;
    if (!form.contactListId) nextErrors.contactListId = true;
    if (!form.whatsappId) nextErrors.whatsappId = true;
    if (!form.templateCategory) nextErrors.templateCategory = true;
    if (!form.templateIdMeta) nextErrors.templateIdMeta = true;
    if (!form.scheduledAt) nextErrors.scheduledAt = true;
    if (headerCount > 0 && form.headerVariables.some(value => !String(value || "").trim())) {
      nextErrors.headerVariables = true;
    }
    if (bodyCount > 0 && form.bodyVariables.some(value => !String(value || "").trim())) {
      nextErrors.bodyVariables = true;
    }
    if (isMediaHeader && !String(form.headerMediaUrl || "").trim()) {
      nextErrors.headerMediaUrl = true;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleHeaderMediaChange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingHeaderMedia(true);
      const mediaForm = new FormData();
      mediaForm.append("headerMedia", file);
      const { data } = await api.post("/official-campaigns/header-media", mediaForm);
      handleChange("headerMediaUrl", data?.url || "");
      setHeaderMediaFileName(file.name);
    } catch (err) {
      toastError(err);
    } finally {
      setUploadingHeaderMedia(false);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      contactListId: Number(form.contactListId),
      whatsappId: Number(form.whatsappId),
      templateIdMeta: form.templateIdMeta,
      scheduledAt: moment(form.scheduledAt).format("YYYY-MM-DD HH:mm:ss"),
      headerVariables: form.headerVariables,
      bodyVariables: form.bodyVariables,
      headerMediaUrl: form.headerMediaUrl,
      status: "INATIVA",
      statusTicket: "closed"
    };

    try {
      setSaving(true);
      if (campaignId) {
        await api.put(`/official-campaigns/${campaignId}`, payload);
      } else {
        await api.post("/official-campaigns", payload);
      }
      toast.success("Campanha oficial salva com sucesso.");
      if (onSave) onSave();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{ className: classes.dialogPaper }}
    >
      <DialogTitle>
        {campaignId ? "Editar campanha oficial" : "Nova campanha oficial"}
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <>
            <Box className={classes.section}>
              <Typography className={classes.sectionTitle}>Dados da campanha</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Nome da campanha"
                    variant="outlined"
                    size="small"
                    value={form.name}
                    onChange={event => handleChange("name", event.target.value)}
                    error={Boolean(errors.name)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Programar envio"
                    type="datetime-local"
                    variant="outlined"
                    size="small"
                    value={form.scheduledAt}
                    onChange={event => handleChange("scheduledAt", event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    error={Boolean(errors.scheduledAt)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth variant="outlined" size="small" error={Boolean(errors.contactListId)}>
                    <InputLabel>Lista de contatos</InputLabel>
                    <Select
                      value={form.contactListId}
                      onChange={event => handleChange("contactListId", event.target.value)}
                      label="Lista de contatos"
                    >
                      {contactLists.map(list => (
                        <MenuItem key={list.id} value={list.id}>
                          {list.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>

            <Box className={classes.section}>
              <Typography className={classes.sectionTitle}>Template oficial</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={7}>
                  <FormControl fullWidth variant="outlined" size="small" error={Boolean(errors.whatsappId)}>
                    <InputLabel>Enviar por</InputLabel>
                    <Select
                      value={form.whatsappId}
                      onChange={handleConnectionChange}
                      label="Enviar por"
                    >
                      {officialConnections.map(connection => (
                        <MenuItem key={connection.id} value={connection.id}>
                          {connection.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={5}>
                  <Button
                    fullWidth
                    variant="outlined"
                    color="primary"
                    disabled={syncingTemplates || !form.whatsappId}
                    onClick={handleSyncTemplates}
                    style={{ height: 40 }}
                  >
                    {syncingTemplates ? "Sincronizando..." : "Sincronizar templates"}
                  </Button>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl
                    fullWidth
                    variant="outlined"
                    size="small"
                    error={Boolean(errors.templateCategory)}
                  >
                    <InputLabel>Categoria do template</InputLabel>
                    <Select
                      value={form.templateCategory}
                      onChange={event => {
                        handleChange("templateCategory", event.target.value);
                        handleChange("templateIdMeta", "");
                        handleChange("headerVariables", []);
                        handleChange("bodyVariables", []);
                        handleChange("headerMediaUrl", "");
                        setHeaderMediaFileName("");
                      }}
                      label="Categoria do template"
                    >
                      {categories.map(category => (
                        <MenuItem key={category} value={category}>
                          {category}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={8}>
                  <FormControl
                    fullWidth
                    variant="outlined"
                    size="small"
                    error={Boolean(errors.templateIdMeta)}
                  >
                    <InputLabel>Template</InputLabel>
                    <Select
                      value={form.templateIdMeta}
                      onChange={event => {
                        handleChange("templateIdMeta", event.target.value);
                        handleChange("headerVariables", []);
                        handleChange("bodyVariables", []);
                        handleChange("headerMediaUrl", "");
                        setHeaderMediaFileName("");
                      }}
                      label="Template"
                    >
                      {filteredTemplates.map(template => (
                        <MenuItem key={template.id} value={template.templateIdMeta}>
                          {template.name} ({template.language})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>

            <Box className={classes.section}>
              <Typography className={classes.sectionTitle}>Configurar template</Typography>
              <Typography className={classes.helper}>
                Você pode usar placeholders do contato dentro dos valores, por exemplo:
                {" "}{"{{name}}"}, {"{{firstName}}"}, {"{{number}}"} e {"{{email}}"}.
              </Typography>

              {!selectedTemplate ? (
                <Box mt={1.5}>
                  <Typography className={classes.helper}>
                    Selecione uma conexão oficial, a categoria e o template para liberar esta configuração.
                  </Typography>
                </Box>
              ) : (
                <Grid container spacing={2} style={{ marginTop: 4 }}>
                  {isMediaHeader && (
                    <Grid item xs={12}>
                      <Button
                        variant="outlined"
                        component="label"
                        fullWidth
                        color={errors.headerMediaUrl ? "secondary" : "primary"}
                        disabled={uploadingHeaderMedia}
                      >
                        {uploadingHeaderMedia
                          ? "Enviando arquivo..."
                          : headerMediaFileName
                          ? headerMediaFileName
                          : `Selecionar arquivo do header (${headerFormat})`}
                        <input
                          type="file"
                          hidden
                          accept={
                            headerFormat === "IMAGE"
                              ? "image/*"
                              : headerFormat === "VIDEO"
                              ? "video/*"
                              : ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                          }
                          onChange={handleHeaderMediaChange}
                        />
                      </Button>
                    </Grid>
                  )}
                  {headerCount > 0 &&
                    Array.from({ length: headerCount }).map((_, index) => (
                      <Grid item xs={12} md={6} key={`header-${index}`}>
                        <TextField
                          fullWidth
                          variant="outlined"
                          size="small"
                          label={`Header variável ${index + 1}`}
                          value={form.headerVariables[index] || ""}
                          onChange={event => {
                            const next = [...form.headerVariables];
                            next[index] = event.target.value;
                            handleChange("headerVariables", next);
                          }}
                          error={Boolean(errors.headerVariables)}
                        />
                      </Grid>
                    ))}
                  {bodyCount > 0 &&
                    Array.from({ length: bodyCount }).map((_, index) => (
                      <Grid item xs={12} md={6} key={`body-${index}`}>
                        <TextField
                          fullWidth
                          variant="outlined"
                          size="small"
                          label={`Body variável ${index + 1}`}
                          value={form.bodyVariables[index] || ""}
                          onChange={event => {
                            const next = [...form.bodyVariables];
                            next[index] = event.target.value;
                            handleChange("bodyVariables", next);
                          }}
                          error={Boolean(errors.bodyVariables)}
                        />
                      </Grid>
                    ))}

                  <Grid item xs={12}>
                    <Box
                      mt={1}
                      p={1.5}
                      borderRadius={10}
                      border="1px solid rgba(15,23,42,0.12)"
                      bgcolor="rgba(15,23,42,0.02)"
                    >
                      <Typography className={classes.sectionTitle} style={{ marginBottom: 8 }}>
                        Pré-visualização
                      </Typography>
                      {headerPreview ? (
                        <Typography variant="body2" style={{ marginBottom: 8 }}>
                          <strong>Header:</strong> {headerPreview}
                        </Typography>
                      ) : null}
                      {bodyPreview ? (
                        <Typography variant="body2">
                          <strong>Body:</strong> {bodyPreview}
                        </Typography>
                      ) : (
                        <Typography className={classes.helper}>
                          Este template não possui variáveis de texto editáveis.
                        </Typography>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              )}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          color="primary"
          variant="contained"
          disabled={saving || loading}
        >
          {saving ? "Salvando..." : "Salvar campanha"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OfficialCampaignModal;
