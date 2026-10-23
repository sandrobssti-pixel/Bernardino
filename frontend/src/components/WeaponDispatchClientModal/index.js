import React, { useState, useEffect, useRef } from "react";
import { Formik, Form, FieldArray, Field } from "formik";
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
import Avatar from "@material-ui/core/Avatar";
import Chip from "@material-ui/core/Chip";
import AddIcon from "@material-ui/icons/Add";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import PrintIcon from "@material-ui/icons/Print";
import PersonIcon from "@material-ui/icons/Person";
import PhotoCameraIcon from "@material-ui/icons/PhotoCamera";

import toastError from "../../errors/toastError";
import { money } from "../../utils/financeFormat";
import FinanceAsyncAutocomplete from "../FinanceAsyncAutocomplete";

// "Forma de pagamento" por serviço pedido — registro informativo (ver
// comentário em WeaponDispatchProcess.ts), não dispara cobrança de
// verdade. Isso já existe em Contas a Receber/Configuração de Pagamento.
const PAYMENT_METHOD_OPTIONS = [
  { value: "", label: "—" },
  { value: "pix", label: "Pix" },
  { value: "card", label: "Cartão" },
  { value: "boleto", label: "Boleto" },
  { value: "cash", label: "Espécie (dinheiro)" },
];

const PAYMENT_METHOD_LABELS = PAYMENT_METHOD_OPTIONS.reduce((acc, opt) => {
  acc[opt.value] = opt.label;
  return acc;
}, {});

const emptyService = {
  serviceId: "",
  name: "",
  value: "0",
  paymentMethod: "",
};

const buildInitialValues = (record) => ({
  name: record?.name || "",
  cpf: record?.cpf || "",
  rg: record?.rg || "",
  profession: record?.profession || "",
  address: record?.address || "",
  phone: record?.phone || "",
  whatsapp: record?.whatsapp || "",
  notes: record?.notes || "",
  contactId: record?.contactId || null,
  services: [{ ...emptyService }],
});

const useStyles = makeStyles((theme) => ({
  dialogPaper: {
    borderRadius: 12,
  },
  serviceRow: {
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
  },
  photoBox: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  photoAvatar: {
    width: 72,
    height: 72,
    cursor: "pointer",
  },
  osChip: {
    fontWeight: 700,
  },
  printArea: {
    display: "none",
  },
  "@global": {
    "@media print": {
      "body *": {
        visibility: "hidden",
      },
      "#weapon-dispatch-client-print-area, #weapon-dispatch-client-print-area *": {
        visibility: "visible",
      },
      "#weapon-dispatch-client-print-area": {
        display: "block",
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
      },
    },
  },
}));

// Ficha de cadastro do cliente do Despachante Bélico — campos pedidos
// explicitamente pelo cliente (modelo de formulário que ele mandou): Nº da
// OS (auto, só exibição), dados pessoais, foto, e uma lista de serviços
// desejados que puxam do cadastro de Serviço (v2.3.175, módulo próprio,
// sem nada fiscal) — cada linha vira um WeaponDispatchProcess novo ao
// salvar. Ver docs/MANUAL_TECNICO.md.
const WeaponDispatchClientModal = ({ open, onClose, onSave, record, weaponDispatch, services }) => {
  const classes = useStyles();
  const fileInputRef = useRef(null);
  const [initialValues, setInitialValues] = useState(buildInitialValues(null));
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [existingProcesses, setExistingProcesses] = useState([]);
  const [printSnapshot, setPrintSnapshot] = useState(null);
  // Resultado escolhido na busca "Já é cliente?" (Contato/Financeiro) — só
  // pra manter o nome visível na caixa depois de escolher (o campo em si
  // não é salvo, só preenche nome/CPF/telefone/endereço/contactId — ver
  // handlePersonLookupChange).
  const [personLookupValue, setPersonLookupValue] = useState(null);

  useEffect(() => {
    setInitialValues(buildInitialValues(record));
    setPhotoFile(null);
    setPhotoPreview(record?.photoUrl || null);
    setPersonLookupValue(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, open]);

  useEffect(() => {
    if (!open || !record?.id) {
      setExistingProcesses([]);
      return;
    }
    (async () => {
      try {
        const records = await weaponDispatch.processes.list({ clientId: record.id });
        setExistingProcesses(records || []);
      } catch (err) {
        toastError(err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record]);

  const handleClose = () => onClose();

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleServiceProductChange = (index, service, setFieldValue) => {
    setFieldValue(`services.${index}.serviceId`, service?.id || "");
    setFieldValue(`services.${index}.name`, service?.name || "");
    setFieldValue(`services.${index}.value`, service ? String(service.value || "0") : "0");
  };

  const fetchServiceOptions = async (searchParam) => {
    const { records } = await services.list({ searchParam });
    return records || [];
  };

  // Busca combinada em Contatos (Atendimento) + Clientes (Financeiro) —
  // pedido do cliente: evitar recadastrar quem já existe num dos dois.
  // Preenche os campos da ficha (editáveis depois, não trava) e guarda o
  // `contactId` quando o resultado tem um (direto, se veio de Contato; ou o
  // vínculo já salvo no Cliente Financeiro, se veio de lá).
  const fetchPersonOptions = async (searchParam) => {
    if (!searchParam || searchParam.trim().length < 2) return [];
    return weaponDispatch.clients.lookup(searchParam);
  };

  const handlePersonLookupChange = (person, setFieldValue) => {
    setPersonLookupValue(person || null);
    if (!person) return;
    setFieldValue("name", person.name || "");
    setFieldValue("cpf", person.cpf || "");
    setFieldValue("phone", person.phone || "");
    setFieldValue("whatsapp", person.whatsapp || "");
    setFieldValue("address", person.address || "");
    setFieldValue("contactId", person.contactId || null);
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      const personalPayload = {
        name: values.name,
        cpf: values.cpf,
        rg: values.rg,
        profession: values.profession,
        address: values.address,
        phone: values.phone,
        whatsapp: values.whatsapp,
        notes: values.notes,
        contactId: values.contactId || null,
      };

      const client = record?.id
        ? await weaponDispatch.clients.update(record.id, personalPayload)
        : await weaponDispatch.clients.save(personalPayload);

      if (photoFile) {
        await weaponDispatch.clients.uploadPhoto(client.id, photoFile);
      }

      const newServices = values.services.filter((s) => s.serviceId);
      for (const service of newServices) {
        await weaponDispatch.processes.save({
          clientId: client.id,
          type: service.name,
          value: service.value,
          serviceId: service.serviceId,
          paymentMethod: service.paymentMethod,
        });
      }

      toast.success(
        record?.id ? "Cliente atualizado." : "Cliente cadastrado."
      );
      setSubmitting(false);
      onSave();
      handleClose();
    } catch (err) {
      setSubmitting(false);
      toastError(err);
    }
  };

  const osNumber = record?.id ? String(record.id).padStart(4, "0") : "(gerado ao salvar)";

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
        {record?.id ? "Editar cliente — Despachante Bélico" : "Novo cliente — Despachante Bélico"}
        {"  "}
        <Chip size="small" className={classes.osChip} label={`OS ${osNumber}`} />
      </DialogTitle>
      <Formik
        initialValues={initialValues}
        enableReinitialize
        onSubmit={handleSubmit}
      >
        {({ values, setFieldValue, isSubmitting }) => {
          const servicesTotal = values.services.reduce(
            (sum, s) => sum + (s.serviceId ? Number(s.value) || 0 : 0),
            0
          );

          const handlePrint = () => {
            setPrintSnapshot({ values, osNumber, existingProcesses });
            setTimeout(() => {
              window.print();
              setPrintSnapshot(null);
            }, 150);
          };

          return (
            <Form>
              <DialogContent dividers={false}>
                <div className={classes.photoBox}>
                  <Avatar
                    src={photoPreview || undefined}
                    className={classes.photoAvatar}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {!photoPreview && <PersonIcon fontSize="large" />}
                  </Avatar>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={handlePhotoChange}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PhotoCameraIcon />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {photoPreview ? "Trocar foto" : "Anexar foto"}
                  </Button>
                </div>

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
                  <Grid item xs={12} sm={8}>
                    <Field
                      as={TextField}
                      fullWidth
                      variant="outlined"
                      size="small"
                      name="name"
                      label="Nome completo"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Field
                      as={TextField}
                      fullWidth
                      variant="outlined"
                      size="small"
                      name="cpf"
                      label="CPF"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Field
                      as={TextField}
                      fullWidth
                      variant="outlined"
                      size="small"
                      name="rg"
                      label="Identidade (RG)"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Field
                      as={TextField}
                      fullWidth
                      variant="outlined"
                      size="small"
                      name="profession"
                      label="Profissão"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Field
                      as={TextField}
                      fullWidth
                      variant="outlined"
                      size="small"
                      name="phone"
                      label="Número de contato"
                    />
                  </Grid>
                  <Grid item xs={12} sm={8}>
                    <Field
                      as={TextField}
                      fullWidth
                      variant="outlined"
                      size="small"
                      name="whatsapp"
                      label="Número de WhatsApp"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Field
                      as={TextField}
                      fullWidth
                      variant="outlined"
                      size="small"
                      multiline
                      minRows={2}
                      name="address"
                      label="Endereço completo"
                    />
                  </Grid>
                </Grid>

                <Divider style={{ margin: "16px 0" }} />

                {existingProcesses.length > 0 && (
                  <>
                    <Typography variant="subtitle2" gutterBottom>
                      Serviços já solicitados
                    </Typography>
                    {existingProcesses.map((p) => (
                      <Grid container spacing={1} key={p.id} className={classes.serviceRow}>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2">{p.type}</Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="body2" color="textSecondary">
                            {money(p.value)}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Chip size="small" label={p.stage} />
                        </Grid>
                      </Grid>
                    ))}
                    <Divider style={{ margin: "16px 0" }} />
                  </>
                )}

                <Typography variant="subtitle2" gutterBottom>
                  Tipo de serviço (adicionar novo pedido)
                </Typography>

                <FieldArray name="services">
                  {({ push, remove }) => (
                    <>
                      {values.services.map((service, index) => (
                        <Grid container spacing={1} key={index} className={classes.serviceRow}>
                          <Grid item xs={12} sm={6}>
                            <FinanceAsyncAutocomplete
                              label="Tipo de serviço"
                              placeholder="Buscar em Serviços"
                              value={
                                service.serviceId
                                  ? { id: service.serviceId, name: service.name }
                                  : null
                              }
                              initialOptions={
                                service.serviceId
                                  ? [{ id: service.serviceId, name: service.name }]
                                  : []
                              }
                              getOptionLabel={(opt) => opt?.name || ""}
                              fetchOptions={fetchServiceOptions}
                              onChange={(e, newValue) =>
                                handleServiceProductChange(index, newValue, setFieldValue)
                              }
                            />
                          </Grid>
                          <Grid item xs={6} sm={2}>
                            <Field
                              as={TextField}
                              fullWidth
                              variant="outlined"
                              size="small"
                              type="number"
                              label="Valor do serviço (R$)"
                              name={`services.${index}.value`}
                              disabled={!service.serviceId}
                            />
                          </Grid>
                          <Grid item xs={6} sm={3}>
                            <Field
                              as={TextField}
                              select
                              fullWidth
                              variant="outlined"
                              size="small"
                              label="Forma de pagamento"
                              name={`services.${index}.paymentMethod`}
                              disabled={!service.serviceId}
                            >
                              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </MenuItem>
                              ))}
                            </Field>
                          </Grid>
                          <Grid
                            item
                            xs={12}
                            sm={1}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <IconButton
                              size="small"
                              onClick={() => remove(index)}
                              disabled={values.services.length === 1}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Grid>
                        </Grid>
                      ))}
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => push({ ...emptyService })}
                      >
                        Adicionar serviço
                      </Button>
                    </>
                  )}
                </FieldArray>

                <Field
                  as={TextField}
                  fullWidth
                  variant="outlined"
                  size="small"
                  multiline
                  minRows={2}
                  label="Observação"
                  name="notes"
                  style={{ marginTop: 16 }}
                />

                {servicesTotal > 0 && (
                  <Typography
                    style={{ marginTop: 12, fontWeight: 700, textAlign: "right" }}
                  >
                    Total dos novos serviços: {money(servicesTotal)}
                  </Typography>
                )}
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={handlePrint}
                  color="primary"
                  startIcon={<PrintIcon />}
                  style={{ marginRight: "auto" }}
                >
                  Imprimir / PDF
                </Button>
                <Button onClick={handleClose} color="secondary" disabled={isSubmitting}>
                  Cancelar
                </Button>
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
      <div id="weapon-dispatch-client-print-area" className={classes.printArea}>
        <h2>Ficha do cliente — OS {printSnapshot.osNumber}</h2>
        <table width="100%" cellPadding={4} style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <th style={{ textAlign: "left", width: "30%" }}>Nome</th>
              <td>{printSnapshot.values.name || "—"}</td>
            </tr>
            <tr>
              <th style={{ textAlign: "left" }}>CPF</th>
              <td>{printSnapshot.values.cpf || "—"}</td>
            </tr>
            <tr>
              <th style={{ textAlign: "left" }}>Identidade</th>
              <td>{printSnapshot.values.rg || "—"}</td>
            </tr>
            <tr>
              <th style={{ textAlign: "left" }}>Profissão</th>
              <td>{printSnapshot.values.profession || "—"}</td>
            </tr>
            <tr>
              <th style={{ textAlign: "left" }}>Endereço</th>
              <td>{printSnapshot.values.address || "—"}</td>
            </tr>
            <tr>
              <th style={{ textAlign: "left" }}>Telefone</th>
              <td>{printSnapshot.values.phone || "—"}</td>
            </tr>
            <tr>
              <th style={{ textAlign: "left" }}>WhatsApp</th>
              <td>{printSnapshot.values.whatsapp || "—"}</td>
            </tr>
            <tr>
              <th style={{ textAlign: "left" }}>Observação</th>
              <td>{printSnapshot.values.notes || "—"}</td>
            </tr>
          </tbody>
        </table>

        {printSnapshot.existingProcesses.length > 0 && (
          <>
            <h3>Serviços já solicitados</h3>
            <table width="100%" cellPadding={4} style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Serviço</th>
                  <th style={{ textAlign: "left" }}>Valor</th>
                  <th style={{ textAlign: "left" }}>Etapa</th>
                </tr>
              </thead>
              <tbody>
                {printSnapshot.existingProcesses.map((p) => (
                  <tr key={p.id}>
                    <td>{p.type}</td>
                    <td>{money(p.value)}</td>
                    <td>{p.stage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {printSnapshot.values.services.some((s) => s.serviceId) && (
          <>
            <h3>Novos serviços solicitados</h3>
            <table width="100%" cellPadding={4} style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Serviço</th>
                  <th style={{ textAlign: "left" }}>Valor</th>
                  <th style={{ textAlign: "left" }}>Forma de pagamento</th>
                </tr>
              </thead>
              <tbody>
                {printSnapshot.values.services
                  .filter((s) => s.serviceId)
                  .map((s, idx) => (
                    <tr key={idx}>
                      <td>{s.name}</td>
                      <td>{money(s.value)}</td>
                      <td>{PAYMENT_METHOD_LABELS[s.paymentMethod] || "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    )}
    </>
  );
};

export default WeaponDispatchClientModal;
