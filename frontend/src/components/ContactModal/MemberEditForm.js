import React, { useState, useRef } from "react";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Avatar from "@material-ui/core/Avatar";
import PersonIcon from "@material-ui/icons/Person";
import FaceIcon from "@material-ui/icons/Face";
import Chip from "@material-ui/core/Chip";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import VpnKeyIcon from "@material-ui/icons/VpnKey";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";

import toastError from "../../errors/toastError";
import useMembers from "../../hooks/useMembers";
import MemberWeaponsSection from "./MemberWeaponsSection";
import MemberAddressesSection from "./MemberAddressesSection";
import MemberDocumentsSection from "./MemberDocumentsSection";
import MemberMembershipSection from "./MemberMembershipSection";
import MemberCheckInHistorySection from "./MemberCheckInHistorySection";
import { computeFaceDescriptor } from "../../utils/faceRecognition";
import {
  CAC_CATEGORY_OPTIONS,
  CAC_CATEGORY_INFO,
  STATUS_OPTIONS,
  CR_ISSUING_AUTHORITY_OPTIONS,
  ADDRESS_TYPE_OPTIONS,
} from "../../pages/Members/membersConfig";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2, 2.5),
    flex: "1 1 auto",
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  photoRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    flexWrap: "wrap",
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    padding: theme.spacing(1.5, 2.5),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
}));

// Conteúdo COMPLETO de edição do Associado (Dados/Endereço/Financeiro/
// Documentos/Controle de Acesso) — extraído de ContactCacTab.js (v2.3.273)
// pra ser reaproveitado tanto na aba "Gerenciador CAC" do ContactModal
// quanto na tela cheia "Gerenciador CAC" (pages/Members), que até agora
// (v2.3.274) usava só o modal genérico de campo-config (FinanceRecordModal)
// e não tinha nenhuma dessas seções — bug real reportado pelo cliente.
// `showIdentityFields` controla nome/e-mail/telefone/WhatsApp: na aba do
// Contato esses campos são do PRÓPRIO Contato (editados em "Dados
// principais"), então ficam escondidos aqui e `extraSaveValues` força os
// valores certos no save; na tela cheia esses campos são do Associado em
// si, então aparecem editáveis e `extraSaveValues` fica vazio. Ver
// docs/MANUAL_TECNICO.md.
const MemberEditForm = ({
  member,
  onMemberChange,
  showIdentityFields = false,
  extraSaveValues = {},
}) => {
  const classes = useStyles();
  const members = useMembers();
  const [saving, setSaving] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [generatingPin, setGeneratingPin] = useState(false);
  const [generatedPin, setGeneratedPin] = useState(null);
  const [subTab, setSubTab] = useState("dados");
  const photoRef = useRef(null);

  const handleSave = async (values) => {
    setSaving(true);
    try {
      const data = await members.update(member.id, { ...values, ...extraSaveValues });
      onMemberChange(data);
      toast.success("Dados do CAC salvos.");
    } catch (err) {
      toastError(err);
    }
    setSaving(false);
  };

  const handleUploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { photoUrl, status } = await members.uploadPhoto(member.id, file);
      onMemberChange({ ...member, photoUrl, status });
    } catch (err) {
      toastError(err);
    }
  };

  // Controle de Acesso (reconhecimento facial) — calcula o descritor a
  // partir da FOTO JÁ CADASTRADA (não precisa de webcam aqui; webcam é só
  // no momento do check-in em si, ver pages/MemberCheckIn). Tudo roda no
  // navegador (face-api.js); só o descritor (números) é enviado ao
  // backend, nunca a imagem.
  const waitForImageLoad = (img) =>
    new Promise((resolve, reject) => {
      if (img.complete && img.naturalWidth > 0) {
        resolve();
        return;
      }
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("ERR_MEMBER_PHOTO_LOAD_FAILED"));
    });

  const handleEnrollFace = async () => {
    if (!photoRef.current) return;
    setEnrolling(true);
    try {
      await waitForImageLoad(photoRef.current);
      const descriptor = await computeFaceDescriptor(photoRef.current);
      if (!descriptor) {
        toast.error("Nenhum rosto detectado nessa foto. Tente uma foto mais nítida, com o rosto bem visível.");
      } else {
        await members.setFaceDescriptor(member.id, descriptor);
        onMemberChange({ ...member, faceEnrolled: true });
        toast.success("Reconhecimento facial cadastrado.");
      }
    } catch (err) {
      toastError(err);
    }
    setEnrolling(false);
  };

  // PIN de acesso ao Portal do Associado — mostrado em texto puro só
  // UMA VEZ, nesta resposta; depois disso só o hash fica guardado (nem
  // o próprio Admin consegue ver de novo, só gerar um novo PIN, que
  // revoga o anterior).
  const handleGeneratePin = async () => {
    setGeneratingPin(true);
    try {
      const { pin } = await members.generatePortalPin(member.id);
      setGeneratedPin(pin);
    } catch (err) {
      toastError(err);
    }
    setGeneratingPin(false);
  };

  const fetchMember = async () => {
    try {
      const data = await members.show(member.id);
      onMemberChange(data);
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <>
      <Dialog open={!!generatedPin} onClose={() => setGeneratedPin(null)} maxWidth="xs" fullWidth>
        <DialogTitle>PIN do Portal do Associado</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Repasse este PIN ao associado (presencialmente ou por WhatsApp).
            Ele não será mostrado de novo — se perder, gere um novo (o
            anterior deixa de funcionar).
          </Typography>
          <Box display="flex" justifyContent="center" my={2}>
            <Typography variant="h4" style={{ letterSpacing: 4 }}>
              {generatedPin}
            </Typography>
          </Box>
          <Typography variant="caption" color="textSecondary">
            O associado acessa em /portal/login com o CPF cadastrado + este PIN.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGeneratedPin(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
      <Formik
        initialValues={{
          name: member.name || "",
          email: member.email || "",
          phone: member.phone || "",
          whatsapp: member.whatsapp || "",
          document: member.document || "",
          rg: member.rg || "",
          birthDate: member.birthDate || "",
          category: member.category || "",
          cacCategory: member.cacCategory || "none",
          status: member.status || "pending",
          crNumber: member.crNumber || "",
          crIssuingAuthority: member.crIssuingAuthority || "none",
          crValidUntil: member.crValidUntil || "",
          addressType: member.addressType || "residencial",
          addressDescription: member.addressDescription || "",
          zipCode: member.zipCode || "",
          street: member.street || "",
          number: member.number || "",
          complement: member.complement || "",
          neighborhood: member.neighborhood || "",
          city: member.city || "",
          state: member.state || "",
          notes: member.notes || "",
        }}
        enableReinitialize
        onSubmit={handleSave}
      >
        {({ values }) => (
          <Form style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0 }}>
            <div className={classes.root}>
              <div className={classes.photoRow}>
                <Avatar src={member.photoUrl || undefined} style={{ width: 56, height: 56 }}>
                  {!member.photoUrl && <PersonIcon />}
                </Avatar>
                <Button type="button" variant="outlined" size="small" component="label">
                  Anexar foto
                  <input type="file" accept="image/*" hidden onChange={handleUploadPhoto} />
                </Button>
                {member.photoUrl && (
                  <>
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <img
                      ref={photoRef}
                      src={member.photoUrl}
                      crossOrigin="anonymous"
                      style={{ display: "none" }}
                    />
                    <Button
                      type="button"
                      variant="outlined"
                      size="small"
                      startIcon={<FaceIcon />}
                      disabled={enrolling}
                      onClick={handleEnrollFace}
                    >
                      {enrolling
                        ? "Processando..."
                        : member.faceEnrolled
                        ? "Recadastrar reconhecimento facial"
                        : "Cadastrar reconhecimento facial"}
                    </Button>
                    {member.faceEnrolled && (
                      <Chip size="small" color="primary" label="Facial cadastrado" />
                    )}
                  </>
                )}
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  startIcon={<VpnKeyIcon />}
                  disabled={generatingPin}
                  onClick={handleGeneratePin}
                >
                  {generatingPin ? "Gerando..." : "Gerar PIN do Portal do Associado"}
                </Button>
              </div>
              <Tabs
                value={subTab}
                onChange={(e, v) => setSubTab(v)}
                indicatorColor="primary"
                textColor="primary"
                variant="scrollable"
                scrollButtons="auto"
                style={{ marginBottom: 16, borderBottom: "1px solid rgba(0,0,0,0.08)" }}
              >
                <Tab value="dados" label="Dados" />
                <Tab value="endereco" label="Endereço" />
                <Tab value="financeiro" label="Financeiro" />
                <Tab value="documentos" label="Documentos" />
                <Tab value="acesso" label="Controle de Acesso" />
              </Tabs>
              <Grid container spacing={2} style={{ display: subTab === "dados" ? "flex" : "none" }}>
                {showIdentityFields && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <Field as={TextField} fullWidth required variant="outlined" size="small" name="name" label="Nome completo" />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Field as={TextField} fullWidth variant="outlined" size="small" name="email" label="E-mail" />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Field as={TextField} fullWidth variant="outlined" size="small" name="phone" label="Telefone" />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Field as={TextField} fullWidth variant="outlined" size="small" name="whatsapp" label="WhatsApp" />
                    </Grid>
                  </>
                )}
                <Grid item xs={12} sm={4}>
                  <Field as={TextField} fullWidth variant="outlined" size="small" name="document" label="CPF" />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Field as={TextField} fullWidth variant="outlined" size="small" name="rg" label="RG" />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    type="date"
                    name="birthDate"
                    label="Data de nascimento"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    name="category"
                    label="Categoria (ex.: atirador, sócio, aluno)"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field as={TextField} select fullWidth variant="outlined" size="small" name="cacCategory" label="Classe CAC (se for clube de tiro)">
                    {CAC_CATEGORY_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Field>
                </Grid>
                {values.cacCategory === "atirador_alto_rendimento" && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">
                      {CAC_CATEGORY_INFO.atirador_alto_rendimento}
                    </Typography>
                  </Grid>
                )}
                <Grid item xs={12} sm={6}>
                  <Field as={TextField} select fullWidth variant="outlined" size="small" name="status" label="Status">
                    {STATUS_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Field>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" style={{ fontWeight: 700, marginTop: 8 }}>
                    CR (Certificado de Registro) do associado
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Field as={TextField} fullWidth variant="outlined" size="small" name="crNumber" label="Número do CR" />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Field as={TextField} select fullWidth variant="outlined" size="small" name="crIssuingAuthority" label="Órgão emissor">
                    {CR_ISSUING_AUTHORITY_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Field>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    size="small"
                    type="date"
                    name="crValidUntil"
                    label="Validade do CR"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    fullWidth
                    multiline
                    minRows={3}
                    variant="outlined"
                    size="small"
                    name="notes"
                    label="Observações"
                  />
                </Grid>
              </Grid>
              {subTab === "dados" && <MemberWeaponsSection memberId={member.id} />}

              <Grid container spacing={2} style={{ display: subTab === "endereco" ? "flex" : "none" }}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
                    Endereço principal
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Obrigatório, exceto o número do CR (associado pode ainda estar em trâmite).
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Field as={TextField} select fullWidth variant="outlined" size="small" name="addressType" label="Tipo">
                    {ADDRESS_TYPE_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Field>
                </Grid>
                <Grid item xs={12} sm={8}>
                  <Field as={TextField} fullWidth variant="outlined" size="small" name="addressDescription" label="Descrição (opcional)" />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Field as={TextField} fullWidth required variant="outlined" size="small" name="zipCode" label="CEP" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field as={TextField} fullWidth required variant="outlined" size="small" name="street" label="Rua" />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Field as={TextField} fullWidth required variant="outlined" size="small" name="number" label="Número" />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Field as={TextField} fullWidth variant="outlined" size="small" name="complement" label="Complemento (opcional)" />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Field as={TextField} fullWidth required variant="outlined" size="small" name="neighborhood" label="Bairro" />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <Field as={TextField} fullWidth required variant="outlined" size="small" name="city" label="Cidade" />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <Field as={TextField} fullWidth variant="outlined" size="small" name="state" label="UF" />
                </Grid>
                <Grid item xs={12}>
                  <MemberAddressesSection memberId={member.id} />
                </Grid>
              </Grid>

              {subTab === "financeiro" && (
                <MemberMembershipSection member={member} onMemberUpdate={fetchMember} />
              )}
              {subTab === "documentos" && <MemberDocumentsSection member={member} />}
              {subTab === "acesso" && <MemberCheckInHistorySection memberId={member.id} />}
            </div>
            <div className={classes.footer}>
              <Button type="submit" variant="contained" color="primary" disabled={saving}>
                {saving ? "Salvando..." : "Salvar dados do CAC"}
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </>
  );
};

export default MemberEditForm;
