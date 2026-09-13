import React, { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";

import { i18n } from "../../translate/i18n";
import { Button, CircularProgress, Grid, MenuItem, TextField, Typography } from "@material-ui/core";
import { Field, Form, Formik } from "formik";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

import axios from "axios";
import usePlans from "../../hooks/usePlans";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1.5),
    paddingBottom: 100
  },
  mainHeader: {
    marginTop: theme.spacing(1),
  },
  elementMargin: {
    padding: theme.spacing(1.2),
  },
  formContainer: {
    maxWidth: 500,
  },
  textRight: {
    textAlign: "right"
  },
  pageTitle: {
    fontSize: "1.1rem",
    fontWeight: 600,
  },
  sectionTitle: {
    fontSize: "0.9rem",
    fontWeight: 600,
  },
  contentText: {
    fontSize: "0.78rem",
    lineHeight: 1.45,
    "& p, & li, & b": {
      fontSize: "0.78rem",
      lineHeight: 1.45,
    },
    "& ul, & ol": {
      marginTop: 6,
      marginBottom: 6,
      paddingLeft: 20,
    },
  },
  testTitle: {
    fontSize: "0.8rem",
    fontWeight: 600,
  },
  textField: {
    "& .MuiInputBase-input": {
      fontSize: "0.8rem",
    },
    "& .MuiInputLabel-outlined": {
      fontSize: "0.8rem",
    },
  },
  submitButton: {
    minHeight: 38,
    fontSize: "0.74rem",
    fontWeight: 600,
  }
}));

const MessagesAPI = () => {
  const classes = useStyles();
  const history = useHistory();

  const [formMessageTextData,] = useState({
    token: '', number: '', body: '', userId: '', queueId: '',
    messageType: 'text', buttonText: '', buttonUrl: ''
  })
  const [formMessageMediaData,] = useState({ token: '', number: '', medias: '', body:'', userId: '', queueId: '' })
  const [formMessageInteractiveData,] = useState({
    token: '',
    number: '',
    type: 'buttons',
    title: '',
    body: '',
    footer: '',
    buttonText: '',
    payloadJson: '[\n  {\n    "id": "opt_1",\n    "text": "Opção 1"\n  },\n  {\n    "id": "opt_2",\n    "text": "Opção 2"\n  }\n]',
    userId: '',
    queueId: ''
  })
  const [file, setFile] = useState({})
  const { user } = useContext(AuthContext);

  const { getPlanCompany } = usePlans();

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useExternalApi) {
        toast.error("Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando.");
        setTimeout(() => {
          history.push(`/`)
        }, 1000);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getEndpoint = () => {
    return process.env.REACT_APP_BACKEND_URL + '/api/messages/send'
  }

  const getInteractiveEndpoint = () => {
    return process.env.REACT_APP_BACKEND_URL + '/api/messages/send/interactive'
  }

  const handleSendTextMessage = async (values) => {
    const { number, body, userId, queueId, messageType, buttonText, buttonUrl } = values;
    const isUrlButton = messageType === "url_button";
    const data = isUrlButton
      ? {
          number,
          type: "url",
          body,
          buttonText,
          buttonUrl,
          userId,
          queueId
        }
      : { number, body, userId, queueId };
    try {
      await axios.request({
        url: isUrlButton ? getInteractiveEndpoint() : getEndpoint(),
        method: 'POST',
        data,
        headers: {
          'Content-type': 'application/json',
          'Authorization': `Bearer ${values.token}` 
        }
      })
      toast.success(isUrlButton ? 'Botão URL enviado com sucesso' : 'Mensagem enviada com sucesso');
    } catch (err) {
      toastError(err);
    }
  }

  const handleSendMediaMessage = async (values) => {
    try {
      const firstFile = file[0];
      const data = new FormData();
      data.append('number', values.number);
      data.append('body', values.body ? values.body: firstFile.name);
      data.append('userId', values.userId);
      data.append('queueId', values.queueId);
      data.append('medias', firstFile);
      await axios.request({
        url: getEndpoint(),
        method: 'POST',
        data,
        headers: {
          'Content-type': 'multipart/form-data',
          'Authorization': `Bearer ${values.token}`
        }
      })
      toast.success('Mensagem enviada com sucesso');
    } catch (err) {
      toastError(err);
    }
  }

  const handleSendInteractiveMessage = async (values) => {
    let parsedPayload;

    try {
      parsedPayload = values.payloadJson ? JSON.parse(values.payloadJson) : undefined;
    } catch (err) {
      toast.error("O campo JSON precisa estar em formato válido.");
      return;
    }

    const data = {
      number: values.number,
      type: values.type,
      title: values.title,
      body: values.body,
      footer: values.footer,
      buttonText: values.buttonText,
      userId: values.userId,
      queueId: values.queueId,
      ...(values.type === "buttons"
        ? { buttons: parsedPayload }
        : { sections: parsedPayload })
    };

    try {
      await axios.request({
        url: getInteractiveEndpoint(),
        method: 'POST',
        data,
        headers: {
          'Content-type': 'application/json',
          'Authorization': `Bearer ${values.token}`
        }
      });
      toast.success('Mensagem interativa enviada com sucesso');
    } catch (err) {
      toastError(err);
    }
  }

  const renderFormMessageText = () => {
    return (
      <Formik
        initialValues={formMessageTextData}
        enableReinitialize={true}
        onSubmit={(values, actions) => {
          setTimeout(async () => {
            await handleSendTextMessage(values);
            actions.setSubmitting(false);
            actions.resetForm()
          }, 400);
        }}
        className={classes.elementMargin}
      >
        {({ isSubmitting, values }) => (
          <Form className={classes.formContainer}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.textMessage.token")}
                  name="token"
                  autoFocus
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.textMessage.number")}
                  name="number"
                  autoFocus
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.textMessage.body")}
                  name="body"
                  autoFocus
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  select
                  label="Tipo de mensagem"
                  name="messageType"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                >
                  <MenuItem value="text">Texto normal</MenuItem>
                  <MenuItem value="url_button">Botão URL</MenuItem>
                </Field>
              </Grid>
              {values.messageType === "url_button" && (
                <>
                  <Grid item xs={12} md={6}>
                    <Field
                      as={TextField}
                      label="Texto do botão"
                      name="buttonText"
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      className={classes.textField}
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Field
                      as={TextField}
                      label="URL do botão"
                      name="buttonUrl"
                      placeholder="https://exemplo.com"
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      className={classes.textField}
                      required
                    />
                  </Grid>
                </>
              )}
              <Grid item xs={12}  md={6}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.textMessage.userId")}
                  name="userId"
                  autoFocus
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                />
              </Grid>
              <Grid item xs={12}  md={6}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.textMessage.queueId")}
                  name="queueId"
                  autoFocus
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                />
              </Grid>
              <Grid item xs={12} className={classes.textRight}>
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  className={classes.submitButton}
                >
                  {isSubmitting ? (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
                  ) : 'Enviar'}
                </Button>
              </Grid>
            </Grid>
          </Form>
        )}
      </Formik>
    )
  }

  const renderFormMessageMedia = () => {
    return (
      <Formik
        initialValues={formMessageMediaData}
        enableReinitialize={true}
        onSubmit={(values, actions) => {
          setTimeout(async () => {
            await handleSendMediaMessage(values);
            actions.setSubmitting(false);
            actions.resetForm()
            document.getElementById('medias').files = null
            document.getElementById('medias').value = null
          }, 400);
        }}
        className={classes.elementMargin}
      >
        {({ isSubmitting }) => (
          <Form className={classes.formContainer}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.mediaMessage.token")}
                  name="token"
                  autoFocus
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.mediaMessage.number")}
                  name="number"
                  autoFocus
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.textMessage.body")}
                  name="body"
                  autoFocus
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                />
              </Grid>
              <Grid item xs={12}  md={6}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.textMessage.userId")}
                  name="userId"
                  autoFocus
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                />
              </Grid>
              <Grid item xs={12}  md={6}>
                <Field
                  as={TextField}
                  label={i18n.t("messagesAPI.textMessage.queueId")}
                  name="queueId"
                  autoFocus
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                />
              </Grid>
              <Grid item xs={12}>
                <input type="file" name="medias" id="medias" required onChange={(e) => setFile(e.target.files)} />
              </Grid>
              <Grid item xs={12} className={classes.textRight}>
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  className={classes.submitButton}
                >
                  {isSubmitting ? (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
                  ) : 'Enviar'}
                </Button>
              </Grid>
            </Grid>
          </Form>
        )}
      </Formik>
    )
  }

  const renderFormMessageInteractive = () => {
    return (
      <Formik
        initialValues={formMessageInteractiveData}
        enableReinitialize={true}
        onSubmit={(values, actions) => {
          setTimeout(async () => {
            await handleSendInteractiveMessage(values);
            actions.setSubmitting(false);
          }, 400);
        }}
        className={classes.elementMargin}
      >
        {({ isSubmitting, values, setFieldValue }) => (
          <Form className={classes.formContainer}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label="Token cadastrado"
                  name="token"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label="Número"
                  name="number"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  select
                  label="Tipo interativo"
                  name="type"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                  onChange={(event) => {
                    const nextType = event.target.value;
                    setFieldValue("type", nextType);
                    setFieldValue(
                      "payloadJson",
                      nextType === "buttons"
                        ? '[\n  {\n    "id": "opt_1",\n    "text": "Opção 1"\n  },\n  {\n    "id": "opt_2",\n    "text": "Opção 2"\n  }\n]'
                        : '[\n  {\n    "title": "Setor Comercial",\n    "rows": [\n      {\n        "id": "sales_1",\n        "title": "Falar com vendas",\n        "description": "Atendimento comercial"\n      },\n      {\n        "id": "sales_2",\n        "title": "Solicitar proposta",\n        "description": "Receber orçamento"\n      }\n    ]\n  }\n]'
                    );
                  }}
                >
                  <MenuItem value="buttons">Botões</MenuItem>
                  <MenuItem value="list">Lista</MenuItem>
                </Field>
              </Grid>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label={values.type === "buttons" ? "Título opcional" : "Título da lista"}
                  name="title"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                />
              </Grid>
              <Grid item xs={12}>
                <Field
                  as={TextField}
                  label="Mensagem principal"
                  name="body"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label="Rodapé"
                  name="footer"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label="Texto do botão da lista"
                  name="buttonText"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                  disabled={values.type !== "list"}
                />
              </Grid>
              <Grid item xs={12}>
                <Field
                  as={TextField}
                  label={values.type === "buttons" ? "JSON dos botões" : "JSON das seções"}
                  name="payloadJson"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  multiline
                  minRows={8}
                  className={classes.textField}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label="ID do usuário/atendente"
                  name="userId"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label="ID da Fila"
                  name="queueId"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  className={classes.textField}
                />
              </Grid>
              <Grid item xs={12} className={classes.textRight}>
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  className={classes.submitButton}
                >
                  {isSubmitting ? (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
                  ) : 'Enviar'}
                </Button>
              </Grid>
            </Grid>
          </Form>
        )}
      </Formik>
    )
  }

  return (
    <Paper
      className={classes.mainPaper}
      style={{marginLeft: "5px"}}
      // className={classes.elementMargin}
      variant="outlined"
    >
      <Typography className={classes.pageTitle}>
        {i18n.t("messagesAPI.API.title")}
      </Typography>
      <Typography color="primary" className={`${classes.elementMargin} ${classes.sectionTitle}`}>
      {i18n.t("messagesAPI.API.methods.title")}
      </Typography>
      <Typography component="div" className={classes.contentText}>
        <ol>
          <li>{i18n.t("messagesAPI.API.methods.messagesText")}</li>
          <li>{i18n.t("messagesAPI.API.methods.messagesMidia")}</li>
          <li>Mensagens Interativas (Lista e Botões)</li>
        </ol>
      </Typography>
      <Typography color="primary" className={`${classes.elementMargin} ${classes.sectionTitle}`}>
      {i18n.t("messagesAPI.API.instructions.title")}
      </Typography>
      <Typography className={`${classes.elementMargin} ${classes.contentText}`} component="div">
        <b>{i18n.t("messagesAPI.API.instructions.comments")}</b><br />
        <ul>
          <li>{i18n.t("messagesAPI.API.instructions.comments1")}</li>
          <li>
          {i18n.t("messagesAPI.API.instructions.comments2")}
            <ul>
              <li>{i18n.t("messagesAPI.API.instructions.codeCountry")}</li>
              <li>{i18n.t("messagesAPI.API.instructions.code")}</li>
              <li>{i18n.t("messagesAPI.API.instructions.number")}</li>
            </ul>
          </li>
        </ul>
      </Typography>
      <Typography color="primary" className={`${classes.elementMargin} ${classes.sectionTitle}`}>
      {i18n.t("messagesAPI.API.text.title")}
      </Typography>
      <Grid container>
        <Grid item xs={12} sm={6}>
          <Typography className={`${classes.elementMargin} ${classes.contentText}`} component="div">
            <p>{i18n.t("messagesAPI.API.text.instructions")}</p>
            <b>Endpoint: </b> {getEndpoint()} <br />
            <b>Método: </b> POST <br />
            <b>Headers: </b> Authorization Bearer (token registrado) e Content-Type (application/json) <br />
            <b>Body: </b> {"{"} <br></br>
             "number": "558599999999" <br></br>
             "body": "Message" <br></br> 
             "userId": ID usuário ou "" <br></br>
             "queueId": ID Fila ou ""<br></br>
             "sendSignature": Assinar mensagem - true/false <br></br>
             "closeTicket": Encerrar o ticket - true/false<br></br>
             {"}"} 
          </Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography className={`${classes.elementMargin} ${classes.testTitle}`}>
            <b>Teste de Envio</b>
          </Typography>
          {renderFormMessageText()}
        </Grid>
      </Grid>
      <Typography color="primary" className={`${classes.elementMargin} ${classes.sectionTitle}`}>
      {i18n.t("messagesAPI.API.media.title")}
      </Typography>
      <Grid container>
        <Grid item xs={12} sm={6}>
          <Typography className={`${classes.elementMargin} ${classes.contentText}`} component="div">
            <p>{i18n.t("messagesAPI.API.media.instructions")}</p>
            <b>Endpoint: </b> {getEndpoint()} <br />
            <b>Método: </b> POST <br />
            <b>Headers: </b> Authorization Bearer (token cadastrado) e Content-Type (multipart/form-data) <br />
            <b>FormData: </b> <br />
            <ul>
              <li>
                <b>number: </b> 558599999999
              </li>
              <li>
                <b>body:</b> Message
              </li>
              <li>
                <b>userId:</b> ID usuário ou ""
              </li>
              <li>
                <b>queueId:</b> ID da fila ou ""
              </li>
              <li>
                <b>medias: </b> arquivo
              </li>
              <li>
                <b>sendSignature:</b> Assinar mensagem true/false
              </li>
              <li>
                <b>closeTicket:</b> Encerrar ticket true/false
              </li>
            </ul>
          </Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography className={`${classes.elementMargin} ${classes.testTitle}`}>
            <b>Teste de Envio</b>
          </Typography>
          {renderFormMessageMedia()}
        </Grid>
      </Grid>
      <Typography color="primary" className={`${classes.elementMargin} ${classes.sectionTitle}`}>
        3. Mensagens Interativas
      </Typography>
      <Grid container>
        <Grid item xs={12} sm={6}>
          <Typography className={`${classes.elementMargin} ${classes.contentText}`} component="div">
            <p>Use este método para testar envio de listas e botões.</p>
            <b>Endpoint: </b> {getInteractiveEndpoint()} <br />
            <b>Método: </b> POST <br />
            <b>Headers: </b> Authorization Bearer (token cadastrado) e Content-Type (application/json) <br />
            <b>Body base: </b> {"{"}<br />
            "number": "558599999999",<br />
            "type": "buttons" ou "list",<br />
            "title": "Título opcional",<br />
            "body": "Mensagem principal",<br />
            "footer": "Rodapé opcional",<br />
            "buttonText": "Selecionar",<br />
            "buttons" ou "sections": [...],<br />
            "userId": ID usuário ou "",<br />
            "queueId": ID fila ou ""<br />
            {"}"}
            <br /><br />
            <b>Exemplo buttons:</b>
            <pre style={{ whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{`[
  { "id": "opt_1", "text": "Opção 1" },
  { "id": "opt_2", "text": "Opção 2" }
]`}</pre>
            <b>Exemplo list:</b>
            <pre style={{ whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{`[
  {
    "title": "Setor Comercial",
    "rows": [
      {
        "id": "sales_1",
        "title": "Falar com vendas",
        "description": "Atendimento comercial"
      }
    ]
  }
]`}</pre>
            <p>Observação: este teste está disponível para conexões Baileys.</p>
          </Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography className={`${classes.elementMargin} ${classes.testTitle}`}>
            <b>Teste de Envio</b>
          </Typography>
          {renderFormMessageInteractive()}
        </Grid>
      </Grid>
    </Paper>
  );
};

export default MessagesAPI;
