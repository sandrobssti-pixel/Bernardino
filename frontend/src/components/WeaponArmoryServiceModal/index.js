import React, { useState, useEffect, useRef } from "react";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import CircularProgress from "@material-ui/core/CircularProgress";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import Chip from "@material-ui/core/Chip";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import AddAPhotoIcon from "@material-ui/icons/AddAPhoto";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import PrintIcon from "@material-ui/icons/Print";

import toastError from "../../errors/toastError";
import FinanceAsyncAutocomplete from "../FinanceAsyncAutocomplete";

const WEAPON_TYPE_OPTIONS = [
  { value: "", label: "—" },
  { value: "pistol", label: "Pistola" },
  { value: "revolver", label: "Revólver" },
  { value: "rifle", label: "Rifle/Carabina" },
  { value: "shotgun", label: "Espingarda" },
  { value: "other", label: "Outra" },
];
const WEAPON_TYPE_LABELS = Object.fromEntries(WEAPON_TYPE_OPTIONS.map((o) => [o.value, o.label]));

const TRAFFIC_GUIDE_ISSUER_OPTIONS = [
  { value: "", label: "—" },
  { value: "pf_sinarm", label: "PF/Sinarm" },
  { value: "eb_sigma", label: "EB/Sigma" },
  { value: "other", label: "Outro" },
];
const TRAFFIC_GUIDE_ISSUER_LABELS = Object.fromEntries(
  TRAFFIC_GUIDE_ISSUER_OPTIONS.map((o) => [o.value, o.label])
);

const AUTHORIZATION_TYPE_OPTIONS = [
  { value: "", label: "—" },
  { value: "porte", label: "Arma de Porte (uso pessoal/funcional autorizado)" },
  { value: "posse", label: "Arma de Posse (registrada p/ interior do domicílio)" },
];
const AUTHORIZATION_TYPE_LABELS = Object.fromEntries(
  AUTHORIZATION_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

const CONSERVATION_STATE_OPTIONS = [
  { value: "", label: "—" },
  { value: "excellent", label: "Excelente" },
  { value: "good", label: "Bom" },
  { value: "regular", label: "Regular" },
  { value: "worn", label: "Apresenta marcas de desgaste/oxidação" },
];
const CONSERVATION_STATE_LABELS = Object.fromEntries(
  CONSERVATION_STATE_OPTIONS.map((o) => [o.value, o.label])
);

const STATUS_OPTIONS = [
  { value: "received", label: "Recebida (depositada)" },
  { value: "in_service", label: "Em serviço" },
  { value: "completed", label: "Concluída" },
  { value: "returned", label: "Devolvida" },
];
const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label]));

const buildInitialValues = (record) => ({
  contactId: record?.contactId || null,
  clientName: record?.clientName || "",
  clientCpf: record?.clientCpf || "",
  clientRg: record?.clientRg || "",
  clientProfession: record?.clientProfession || "",
  clientAddress: record?.clientAddress || "",
  clientPhone: record?.clientPhone || "",
  clientEmail: record?.clientEmail || "",
  weaponType: record?.weaponType || "",
  weaponBrand: record?.weaponBrand || "",
  weaponModel: record?.weaponModel || "",
  weaponCaliber: record?.weaponCaliber || "",
  weaponSerialNumber: record?.weaponSerialNumber || "",
  weaponCapacity: record?.weaponCapacity || "",
  weaponFinish: record?.weaponFinish || "",
  weaponCountryOfOrigin: record?.weaponCountryOfOrigin || "",
  accessoriesMagazineQty: record?.accessoriesMagazineQty || "0",
  accessoriesCase: record?.accessoriesCase || false,
  accessoriesHolster: record?.accessoriesHolster || false,
  accessoriesOther: record?.accessoriesOther || "",
  crafNumber: record?.crafNumber || "",
  crafExpiry: record?.crafExpiry ? record.crafExpiry.substring(0, 10) : "",
  trafficGuideNumber: record?.trafficGuideNumber || "",
  trafficGuideExpiry: record?.trafficGuideExpiry ? record.trafficGuideExpiry.substring(0, 10) : "",
  trafficGuideIssuer: record?.trafficGuideIssuer || "",
  authorizationType: record?.authorizationType || "",
  authorizationNumber: record?.authorizationNumber || "",
  authorizationExpiry: record?.authorizationExpiry
    ? record.authorizationExpiry.substring(0, 10)
    : "",
  serviceRequested: record?.serviceRequested || "",
  defectReported: record?.defectReported || "",
  conservationState: record?.conservationState || "",
  workPerformedDescription: record?.workPerformedDescription || "",
  status: record?.status || "received",
});

const parsePhotos = (json) => {
  try {
    return JSON.parse(json || "[]");
  } catch {
    return [];
  }
};

const formatDate = (value) => {
  if (!value) return "____/____/________";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
};

const useStyles = makeStyles((theme) => ({
  dialogPaper: {
    borderRadius: 12,
  },
  sectionTitle: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
    fontWeight: 700,
  },
  photosGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  photoThumb: {
    position: "relative",
    width: 84,
    height: 84,
    borderRadius: 8,
    overflow: "hidden",
    border: `1px solid ${theme.palette.divider}`,
  },
  photoImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  photoRemoveBtn: {
    position: "absolute",
    top: 0,
    right: 0,
    background: "rgba(0,0,0,0.5)",
    padding: 2,
  },
  printArea: {
    display: "none",
  },
  printLogo: {
    maxHeight: 70,
    maxWidth: 160,
  },
  "@global": {
    "@media print": {
      "body *": {
        visibility: "hidden",
      },
      "#weapon-armory-print-area, #weapon-armory-print-area *": {
        visibility: "visible",
      },
      "#weapon-armory-print-area": {
        display: "block",
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
      },
    },
  },
}));

// Ficha do Serviço Armaria (v2.3.178) — campos mapeados 1:1 no "Termo de
// Cautela, Recebimento e Depósito de Arma de Fogo (para manutenção)",
// modelo real enviado pelo cliente como referência (padrão Polícia
// Federal). Ver WeaponArmoryService.ts e docs/MANUAL_TECNICO.md.
const WeaponArmoryServiceModal = ({ open, onClose, onSave, record, weaponArmory, companyLogoUrl, companyName }) => {
  const classes = useStyles();
  const beforeInputRef = useRef(null);
  const afterInputRef = useRef(null);
  const [initialValues, setInitialValues] = useState(buildInitialValues(null));
  const [personLookupValue, setPersonLookupValue] = useState(null);
  const [photosBefore, setPhotosBefore] = useState([]);
  const [photosAfter, setPhotosAfter] = useState([]);
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [uploadingAfter, setUploadingAfter] = useState(false);
  const [printSnapshot, setPrintSnapshot] = useState(null);

  useEffect(() => {
    setInitialValues(buildInitialValues(record));
    setPersonLookupValue(null);
    setPhotosBefore(parsePhotos(record?.photosBefore));
    setPhotosAfter(parsePhotos(record?.photosAfter));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, open]);

  const handleClose = () => onClose();

  // Busca combinada em Contatos (Atendimento) + Clientes (Financeiro) —
  // mesma lógica já usada no Despachante Bélico (ver
  // WeaponDispatchClientModal.js). Preenche os campos, continuam editáveis.
  const fetchPersonOptions = async (searchParam) => {
    if (!searchParam || searchParam.trim().length < 2) return [];
    return weaponArmory.services.lookup(searchParam);
  };

  const handlePersonLookupChange = (person, setFieldValue) => {
    setPersonLookupValue(person || null);
    if (!person) return;
    setFieldValue("clientName", person.name || "");
    setFieldValue("clientCpf", person.cpf || "");
    setFieldValue("clientPhone", person.phone || "");
    setFieldValue("clientAddress", person.address || "");
    setFieldValue("contactId", person.contactId || null);
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      const payload = { ...values };
      ["crafExpiry", "trafficGuideExpiry", "authorizationExpiry"].forEach((f) => {
        if (!payload[f]) payload[f] = null;
      });

      const saved = record?.id
        ? await weaponArmory.services.update(record.id, payload)
        : await weaponArmory.services.save(payload);

      toast.success(record?.id ? "Registro atualizado." : "Registro cadastrado.");
      setSubmitting(false);
      onSave(saved);
      handleClose();
    } catch (err) {
      setSubmitting(false);
      toastError(err);
    }
  };

  const handlePhotoUpload = async (e, stage) => {
    const files = e.target.files;
    if (!files?.length) return;
    if (!record?.id) {
      toast.warn("Salve o registro antes de anexar fotos.");
      return;
    }
    const setUploading = stage === "after" ? setUploadingAfter : setUploadingBefore;
    const setPhotos = stage === "after" ? setPhotosAfter : setPhotosBefore;
    setUploading(true);
    try {
      const { photos } = await weaponArmory.services.uploadPhotos(record.id, files, stage);
      setPhotos(photos || []);
    } catch (err) {
      toastError(err);
    }
    setUploading(false);
  };

  const handlePhotoRemove = async (stage, url) => {
    if (!record?.id) return;
    const setPhotos = stage === "after" ? setPhotosAfter : setPhotosBefore;
    try {
      const { photos } = await weaponArmory.services.removePhoto(record.id, stage, url);
      setPhotos(photos || []);
    } catch (err) {
      toastError(err);
    }
  };

  const recordNumber = record?.id ? String(record.id).padStart(4, "0") : "(gerado ao salvar)";

  return (
    <>
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      classes={{ paper: classes.dialogPaper }}
      scroll="paper"
    >
      <DialogTitle>
        {record?.id ? "Editar registro — Serviço Armaria" : "Novo registro — Serviço Armaria"}
        {"  "}
        <Chip size="small" label={`Nº ${recordNumber}`} />
      </DialogTitle>
      <Formik initialValues={initialValues} enableReinitialize onSubmit={handleSubmit}>
        {({ values, setFieldValue, isSubmitting }) => {
          const handlePrint = () => {
            setPrintSnapshot({ values, recordNumber, photosBefore, photosAfter });
            setTimeout(() => {
              window.print();
              setPrintSnapshot(null);
            }, 150);
          };

          return (
            <Form>
              <DialogContent dividers={false}>
                <Typography variant="subtitle2" className={classes.sectionTitle}>
                  1. Qualificação do proprietário/detentor
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FinanceAsyncAutocomplete
                      label="Já é cliente? Buscar em Contatos/Financeiro"
                      placeholder="Buscar por nome, CPF ou telefone"
                      value={personLookupValue}
                      initialOptions={personLookupValue ? [personLookupValue] : []}
                      getOptionLabel={(opt) =>
                        opt?.name
                          ? `${opt.name} (${opt.source === "contact" ? "Contato" : "Cliente Financeiro"})`
                          : ""
                      }
                      fetchOptions={fetchPersonOptions}
                      onChange={(e, newValue) => handlePersonLookupChange(newValue, setFieldValue)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="clientName" label="Nome completo" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="clientCpf" label="CPF" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="clientRg" label="Identidade (RG)" />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="clientProfession" label="Cargo/Profissão" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="clientPhone" label="Telefone de contato" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="clientEmail" label="E-mail" />
                  </Grid>
                  <Grid item xs={12}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" multiline minRows={2} name="clientAddress" label="Endereço residencial" />
                  </Grid>
                </Grid>

                <Divider style={{ margin: "16px 0" }} />
                <Typography variant="subtitle2" className={classes.sectionTitle}>
                  2. Especificação técnica do armamento e acessórios
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Field as={TextField} select fullWidth variant="outlined" size="small" name="weaponType" label="Espécie">
                      {WEAPON_TYPE_OPTIONS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                      ))}
                    </Field>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="weaponBrand" label="Marca" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="weaponModel" label="Modelo" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="weaponCaliber" label="Calibre" />
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="weaponSerialNumber" label="Número de série" />
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="weaponCapacity" label="Capacidade" />
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="weaponFinish" label="Acabamento" />
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="weaponCountryOfOrigin" label="País de fabricação" />
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" type="number" name="accessoriesMagazineQty" label="Carregadores (qtd)" />
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <FormControlLabel
                      control={<Field as={Switch} type="checkbox" name="accessoriesCase" checked={values.accessoriesCase} />}
                      label="Maleta"
                    />
                    <FormControlLabel
                      control={<Field as={Switch} type="checkbox" name="accessoriesHolster" checked={values.accessoriesHolster} />}
                      label="Coldre"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="accessoriesOther" label="Outros acessórios deixados" />
                  </Grid>
                </Grid>

                <Divider style={{ margin: "16px 0" }} />
                <Typography variant="subtitle2" className={classes.sectionTitle}>
                  3. Controle documental mandatório
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={4}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="crafNumber" label="Nº CRAF/Registro (SIGMA/SINARM)" />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" type="date" InputLabelProps={{ shrink: true }} name="crafExpiry" label="Vencimento CRAF" />
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="trafficGuideNumber" label="Nº Guia de Tráfego" />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" type="date" InputLabelProps={{ shrink: true }} name="trafficGuideExpiry" label="Vencimento Guia" />
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Field as={TextField} select fullWidth variant="outlined" size="small" name="trafficGuideIssuer" label="Órgão expedidor da Guia">
                      {TRAFFIC_GUIDE_ISSUER_OPTIONS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                      ))}
                    </Field>
                  </Grid>
                  <Grid item xs={12} sm={5}>
                    <Field as={TextField} select fullWidth variant="outlined" size="small" name="authorizationType" label="Autorização/Enquadramento">
                      {AUTHORIZATION_TYPE_OPTIONS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                      ))}
                    </Field>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" name="authorizationNumber" label="Nº do Porte (se aplicável)" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" type="date" InputLabelProps={{ shrink: true }} name="authorizationExpiry" label="Vencimento" />
                  </Grid>
                </Grid>

                <Divider style={{ margin: "16px 0" }} />
                <Typography variant="subtitle2" className={classes.sectionTitle}>
                  4. Objeto da manutenção e estado de conservação
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" multiline minRows={2} name="serviceRequested" label="Serviço solicitado (ex.: Limpeza Geral, Reparo de Peça, Regulagem de Gatilho...)" />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" multiline minRows={2} name="defectReported" label="Defeito/Problema relatado pelo cliente" />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field as={TextField} select fullWidth variant="outlined" size="small" name="conservationState" label="Estado de conservação visual (na entrada)">
                      {CONSERVATION_STATE_OPTIONS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                      ))}
                    </Field>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field as={TextField} select fullWidth variant="outlined" size="small" name="status" label="Status do serviço">
                      {STATUS_OPTIONS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                      ))}
                    </Field>
                  </Grid>
                  <Grid item xs={12}>
                    <Field as={TextField} fullWidth variant="outlined" size="small" multiline minRows={2} name="workPerformedDescription" label="Serviço realizado (preencher na conclusão)" />
                  </Grid>
                </Grid>

                <Divider style={{ margin: "16px 0" }} />
                <Typography variant="subtitle2" className={classes.sectionTitle}>
                  5. Fotos — antes e depois
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="textSecondary">Antes do serviço</Typography>
                    <div className={classes.photosGrid}>
                      {photosBefore.map((url) => (
                        <div className={classes.photoThumb} key={url}>
                          <img src={url} alt="antes" className={classes.photoImg} />
                          <IconButton size="small" className={classes.photoRemoveBtn} onClick={() => handlePhotoRemove("before", url)}>
                            <DeleteOutlineIcon fontSize="small" style={{ color: "#fff" }} />
                          </IconButton>
                        </div>
                      ))}
                      <input ref={beforeInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(e) => handlePhotoUpload(e, "before")} />
                      <Button size="small" variant="outlined" startIcon={uploadingBefore ? <CircularProgress size={14} /> : <AddAPhotoIcon />} onClick={() => beforeInputRef.current?.click()} disabled={uploadingBefore}>
                        Adicionar
                      </Button>
                    </div>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="textSecondary">Depois do serviço</Typography>
                    <div className={classes.photosGrid}>
                      {photosAfter.map((url) => (
                        <div className={classes.photoThumb} key={url}>
                          <img src={url} alt="depois" className={classes.photoImg} />
                          <IconButton size="small" className={classes.photoRemoveBtn} onClick={() => handlePhotoRemove("after", url)}>
                            <DeleteOutlineIcon fontSize="small" style={{ color: "#fff" }} />
                          </IconButton>
                        </div>
                      ))}
                      <input ref={afterInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(e) => handlePhotoUpload(e, "after")} />
                      <Button size="small" variant="outlined" startIcon={uploadingAfter ? <CircularProgress size={14} /> : <AddAPhotoIcon />} onClick={() => afterInputRef.current?.click()} disabled={uploadingAfter}>
                        Adicionar
                      </Button>
                    </div>
                  </Grid>
                </Grid>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={handlePrint}
                  color="primary"
                  startIcon={<PrintIcon />}
                  style={{ marginRight: "auto" }}
                  disabled={!record?.id}
                >
                  Imprimir Termo de Cautela
                </Button>
                <Button onClick={handleClose} color="secondary" disabled={isSubmitting}>Cancelar</Button>
                <Button type="submit" color="primary" variant="contained" disabled={isSubmitting}>
                  {isSubmitting ? <CircularProgress size={20} /> : "Salvar"}
                </Button>
              </DialogActions>
            </Form>
          );
        }}
      </Formik>
    </Dialog>

    {printSnapshot && (
      <div id="weapon-armory-print-area" className={classes.printArea}>
        <table width="100%" style={{ marginBottom: 12 }}>
          <tbody>
            <tr>
              <td style={{ width: 160 }}>
                {companyLogoUrl && <img src={companyLogoUrl} alt="logo" className={classes.printLogo} />}
              </td>
              <td style={{ textAlign: "center" }}>
                {companyName && <div style={{ fontWeight: 700 }}>{companyName}</div>}
                <div>TERMO DE CAUTELA, RECEBIMENTO E DEPÓSITO DE ARMA DE FOGO</div>
                <div>(PARA MANUTENÇÃO)</div>
                <div>Nº {printSnapshot.recordNumber}</div>
              </td>
            </tr>
          </tbody>
        </table>

        <p>
          Pelo presente instrumento, firma-se o presente Termo de Cautela e Depósito Temporário,
          para fins de manutenção corretiva/preventiva em armamento, mediante as cláusulas e
          condições seguintes.
        </p>

        <h3>1. Qualificação do proprietário/detentor</h3>
        <table width="100%" cellPadding={4} style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr><th style={{ textAlign: "left", width: "30%" }}>Nome completo</th><td>{printSnapshot.values.clientName || "—"}</td></tr>
            <tr><th style={{ textAlign: "left" }}>CPF</th><td>{printSnapshot.values.clientCpf || "—"}</td></tr>
            <tr><th style={{ textAlign: "left" }}>Identidade (RG)</th><td>{printSnapshot.values.clientRg || "—"}</td></tr>
            <tr><th style={{ textAlign: "left" }}>Cargo/Profissão</th><td>{printSnapshot.values.clientProfession || "—"}</td></tr>
            <tr><th style={{ textAlign: "left" }}>Endereço residencial</th><td>{printSnapshot.values.clientAddress || "—"}</td></tr>
            <tr><th style={{ textAlign: "left" }}>Telefone/E-mail</th><td>{printSnapshot.values.clientPhone || "—"} / {printSnapshot.values.clientEmail || "—"}</td></tr>
          </tbody>
        </table>

        <h3>2. Especificação técnica do armamento e acessórios</h3>
        <table width="100%" cellPadding={4} style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr><th style={{ textAlign: "left", width: "30%" }}>Espécie</th><td>{WEAPON_TYPE_LABELS[printSnapshot.values.weaponType] || "—"}</td></tr>
            <tr><th style={{ textAlign: "left" }}>Marca/Modelo/Calibre</th><td>{printSnapshot.values.weaponBrand || "—"} / {printSnapshot.values.weaponModel || "—"} / {printSnapshot.values.weaponCaliber || "—"}</td></tr>
            <tr><th style={{ textAlign: "left" }}>Número de série</th><td>{printSnapshot.values.weaponSerialNumber || "—"}</td></tr>
            <tr><th style={{ textAlign: "left" }}>Capacidade</th><td>{printSnapshot.values.weaponCapacity || "—"}</td></tr>
            <tr><th style={{ textAlign: "left" }}>Acabamento</th><td>{printSnapshot.values.weaponFinish || "—"}</td></tr>
            <tr><th style={{ textAlign: "left" }}>País de fabricação</th><td>{printSnapshot.values.weaponCountryOfOrigin || "—"}</td></tr>
            <tr>
              <th style={{ textAlign: "left" }}>Acessórios deixados</th>
              <td>
                Carregador(es): {printSnapshot.values.accessoriesMagazineQty || "0"}
                {printSnapshot.values.accessoriesCase ? " · Maleta" : ""}
                {printSnapshot.values.accessoriesHolster ? " · Coldre" : ""}
                {printSnapshot.values.accessoriesOther ? ` · ${printSnapshot.values.accessoriesOther}` : ""}
              </td>
            </tr>
          </tbody>
        </table>

        <h3>3. Controle documental mandatório</h3>
        <table width="100%" cellPadding={4} style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr><th style={{ textAlign: "left", width: "30%" }}>CRAF/Registro (SIGMA/SINARM)</th><td>{printSnapshot.values.crafNumber || "—"} — Vencimento: {formatDate(printSnapshot.values.crafExpiry)}</td></tr>
            <tr><th style={{ textAlign: "left" }}>Guia de Tráfego</th><td>{printSnapshot.values.trafficGuideNumber || "—"} — Vencimento: {formatDate(printSnapshot.values.trafficGuideExpiry)} — Órgão: {TRAFFIC_GUIDE_ISSUER_LABELS[printSnapshot.values.trafficGuideIssuer] || "—"}</td></tr>
            <tr><th style={{ textAlign: "left" }}>Autorização/Enquadramento</th><td>{AUTHORIZATION_TYPE_LABELS[printSnapshot.values.authorizationType] || "—"}</td></tr>
            <tr><th style={{ textAlign: "left" }}>Nº do Porte / Vencimento</th><td>{printSnapshot.values.authorizationNumber || "—"} / {formatDate(printSnapshot.values.authorizationExpiry)}</td></tr>
          </tbody>
        </table>

        <h3>4. Objeto da manutenção e estado de conservação</h3>
        <table width="100%" cellPadding={4} style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr><th style={{ textAlign: "left", width: "30%" }}>Serviço solicitado</th><td>{printSnapshot.values.serviceRequested || "—"}</td></tr>
            <tr><th style={{ textAlign: "left" }}>Defeito/Problema relatado</th><td>{printSnapshot.values.defectReported || "—"}</td></tr>
            <tr><th style={{ textAlign: "left" }}>Estado de conservação (entrada)</th><td>{CONSERVATION_STATE_LABELS[printSnapshot.values.conservationState] || "—"}</td></tr>
            <tr><th style={{ textAlign: "left" }}>Status</th><td>{STATUS_LABELS[printSnapshot.values.status] || "—"}</td></tr>
            <tr><th style={{ textAlign: "left" }}>Serviço realizado</th><td>{printSnapshot.values.workPerformedDescription || "—"}</td></tr>
          </tbody>
        </table>

        {(printSnapshot.photosBefore.length > 0 || printSnapshot.photosAfter.length > 0) && (
          <>
            <h3>Registro fotográfico</h3>
            {printSnapshot.photosBefore.length > 0 && (
              <>
                <p><strong>Antes:</strong></p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {printSnapshot.photosBefore.map((url) => (
                    <img key={url} src={url} alt="antes" style={{ width: 100, height: 100, objectFit: "cover" }} />
                  ))}
                </div>
              </>
            )}
            {printSnapshot.photosAfter.length > 0 && (
              <>
                <p><strong>Depois:</strong></p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {printSnapshot.photosAfter.map((url) => (
                    <img key={url} src={url} alt="depois" style={{ width: 100, height: 100, objectFit: "cover" }} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <h3>5. Declaração de responsabilidade e condições</h3>
        <ol>
          <li>Depósito Temporário: o armamento acima descrito fica sob a guarda temporária e responsabilidade técnica do setor responsável pela execução estrita dos reparos necessários.</li>
          <li>Retirada do bem: a restituição da arma de fogo e seus acessórios só será efetuada ao legítimo proprietário/detentor qualificado neste termo, mediante apresentação de documento de identidade oficial válido e assinatura do recibo de entrega.</li>
          <li>Validade de tráfego: o proprietário fica advertido de que a Guia de Tráfego apresentada deve estar válida também no momento da retirada para o transporte legal do armamento após a conclusão do serviço.</li>
        </ol>

        <table width="100%" style={{ marginTop: 40 }}>
          <tbody>
            <tr>
              <td style={{ width: "50%", textAlign: "center", borderTop: "1px solid #000", paddingTop: 4 }}>
                Assinatura do Proprietário/Detentor do Armamento
              </td>
              <td style={{ width: "50%", textAlign: "center", borderTop: "1px solid #000", paddingTop: 4 }}>
                Assinatura e Carimbo do Responsável Técnico
              </td>
            </tr>
          </tbody>
        </table>

        <h3 style={{ marginTop: 32 }}>Termo de Restituição (preenchido exclusivamente no ato da devolução)</h3>
        <p>
          Declaro que nesta data, ____/____/_______, recebi em devolução o armamento e acessórios
          descritos neste termo, devidamente revisados/manutenidos, em perfeito estado de
          conservação, nada mais tendo a reclamar.
        </p>
        <table width="100%" style={{ marginTop: 24 }}>
          <tbody>
            <tr>
              <td style={{ textAlign: "center", borderTop: "1px solid #000", paddingTop: 4 }}>
                Assinatura do Proprietário/Destinatário na Retirada
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    )}
    </>
  );
};

export default WeaponArmoryServiceModal;
