import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  CircularProgress,
  TextField,
} from "@material-ui/core";
import { Formik, Form } from "formik";

import AddressForm from "./Forms/AddressForm";
import PaymentForm from "./Forms/PaymentForm";
import ReviewOrder from "./ReviewOrder";
import CheckoutSuccess from "./CheckoutSuccess";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { AuthContext } from "../../context/Auth/AuthContext";


import validationSchema from "./FormModel/validationSchema";
import checkoutFormModel from "./FormModel/checkoutFormModel";
import formInitialValues from "./FormModel/formInitialValues";

import useStyles from "./styles";


export default function CheckoutPage(props) {
  const steps = ["Dados", "Personalizar", "Revisar"];
  const { formId, formField } = checkoutFormModel;
  
  
  
  const classes = useStyles();
  const [activeStep, setActiveStep] = useState(1);
  const [datePayment, setDatePayment] = useState(null);
  const [invoiceId, ] = useState(props.Invoice.id);
  const [paymentText, setPaymentText] = useState("");
  const [companyProfile, setCompanyProfile] = useState(null);
  const [documentRequired, setDocumentRequired] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const currentValidationSchema = validationSchema[activeStep];
  const isLastStep = activeStep === steps.length - 1;
  const { user } = useContext(AuthContext);
  const sanitizeCpfCnpj = (value) => String(value || "").replace(/\D/g, "");
  const isValidCpfCnpj = (value) => {
    const normalized = sanitizeCpfCnpj(value);
    return normalized.length === 11 || normalized.length === 14;
  };
  useEffect(() => {
    let isMounted = true;

    const loadCompanyProfile = async () => {
      try {
        if (!user?.companyId) return;
        const { data } = await api.get(`/companies/${user.companyId}`);
        if (isMounted) {
          setCompanyProfile(data || null);
        }
      } catch (error) {
        // fallback para dados já existentes no contexto do usuário
      }
    };

    loadCompanyProfile();
    return () => {
      isMounted = false;
    };
  }, [user?.companyId]);

  const initialCheckoutValues = useMemo(() => {
    const companyName =
      companyProfile?.name ||
      user?.company?.name ||
      user?.name ||
      "";
    const companyEmail =
      companyProfile?.email ||
      user?.company?.email ||
      user?.email ||
      "";
    const companyDocument =
      companyProfile?.document ||
      user?.company?.document ||
      "";

    return {
      ...formInitialValues,
      ...user,
      firstName: companyName,
      lastName: "",
      zipcode: companyDocument,
      address2: companyProfile?.addressStreet || user?.company?.addressStreet || "",
      city: companyProfile?.addressCity || user?.company?.addressCity || "",
      state: companyProfile?.addressState || user?.company?.addressState || "",
      country: "Brasil",
      nameOnCard: companyName,
      email: companyEmail,
      cpfCnpj: companyDocument
    };
  }, [companyProfile, user]);

  function _renderStepContent(step, setFieldValue, setActiveStep, values ) {

    switch (step) {
      case 0:
        return <AddressForm formField={formField} values={values} setFieldValue={setFieldValue}  />;
      case 1:
        return <PaymentForm 
        formField={formField} 
        setFieldValue={setFieldValue} 
        setActiveStep={setActiveStep} 
        activeStep={step} 
        invoiceId={invoiceId}
        values={values}
        />;
      case 2:
        return <ReviewOrder />;
      default:
        return <div>Not Found</div>;
    }
  }


  async function _submitForm(values, actions) {
    try {
      let cpfCnpj = sanitizeCpfCnpj(
        values?.cpfCnpj || companyProfile?.document || user?.company?.document || ""
      );

      if (!isValidCpfCnpj(cpfCnpj)) {
        setDocumentRequired(true);
        setDocumentError("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) para continuar.");
        actions.setSubmitting(false);
        return;
      }

      setDocumentRequired(false);
      setDocumentError("");

      let plan;
      try {
        plan = values?.plan ? JSON.parse(values.plan) : null;
      } catch (_) {
        plan = null;
      }
      if (!plan) {
        toast.error("Não foi possível identificar o plano selecionado. Reabra o pagamento e tente novamente.");
        actions.setSubmitting(false);
        return;
      }
      const newValues = {
        firstName: values.firstName,
        lastName: values.lastName,
        address2: values.address2,
        city: values.city,
        state: values.state,
        zipcode: values.zipcode,
        country: values.country,
        useAddressForPaymentDetails: values.useAddressForPaymentDetails,
        nameOnCard: values.nameOnCard,
        cardNumber: values.cardNumber,
        cvv: values.cvv,
        plan: values.plan,
        price: plan.price,
        users: plan.users,
        connections: plan.connections,
        invoiceId: invoiceId,
        cpfCnpj
      }

      let data;
      try {
        const response = await api.post("/subscription", newValues);
        data = response.data;
      } catch (firstError) {
        const errorMessage = String(
          firstError?.response?.data?.error || firstError?.response?.data?.message || firstError?.message || ""
        );
        const needsDocument = errorMessage.includes("CPF/CNPJ da empresa inválido ou não preenchido");
        if (!needsDocument) {
          throw firstError;
        }

        setDocumentRequired(true);
        setDocumentError("Para pagar com Asaas, informe um CPF/CNPJ válido.");
        if (!isValidCpfCnpj(cpfCnpj)) {
          actions.setSubmitting(false);
          return;
        }

        const retryResponse = await api.post("/subscription", {
          ...newValues,
          cpfCnpj
        });
        data = retryResponse.data;
      }

      setDatePayment(data);

      if (data.gateway === "efi" || data.gateway === "pushinpay") {
        actions.setSubmitting(true);
        setActiveStep(steps.length);
        toast.success("Cobrança Pix gerada! Escaneie o QR Code ou copie o código para pagar.");
        return;
      }

      setPaymentText("Ao realizar o pagamento, atualize a página!");
      const paymentUrl = data.urlPayment || data.urlMcPg;
      if (paymentUrl) {
        window.open(paymentUrl, '_blank');
      }
      actions.setSubmitting(true);
      toast.success("Assinatura realizada com sucesso!, aguardando a realização do pagamento");
    } catch (err) {
      actions.setSubmitting(false);
      toastError(err);
    }
  }

  function _handleSubmit(values, actions) {
    if (isLastStep) {
      _submitForm(values, actions);
    } else {
      setActiveStep(activeStep + 1);
      actions.setTouched({});
      actions.setSubmitting(false);
    }
  }

  function _handleBack() {
    setActiveStep(activeStep - 1);
  }

  return (
    <React.Fragment>
      <Typography component="h1" align="center" className={classes.pageTitle}>
        Falta pouco!
      </Typography>
      <div className={classes.stepperWrap}>
        <Stepper activeStep={activeStep} className={classes.stepper}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </div>
      <React.Fragment>
        {activeStep === steps.length ? (
          <CheckoutSuccess pix={datePayment} />
        ) : (
          <Formik
            initialValues={initialCheckoutValues}
            enableReinitialize
            validationSchema={currentValidationSchema}
            onSubmit={_handleSubmit}
          >
            {({ isSubmitting, setFieldValue, values }) => (
              <Form id={formId}>
                {_renderStepContent(activeStep, setFieldValue, setActiveStep, values)}
                {isLastStep && documentRequired && (
                  <TextField
                    fullWidth
                    margin="normal"
                    variant="outlined"
                    label="CPF ou CNPJ para pagamento"
                    value={values.cpfCnpj || ""}
                    onChange={(e) => {
                      setFieldValue("cpfCnpj", e.target.value);
                      if (documentError) setDocumentError("");
                    }}
                    error={Boolean(documentError)}
                    helperText={documentError || "Esse dado será salvo no cadastro da empresa."}
                    InputLabelProps={{ style: { color: "#b91c1c", fontWeight: 700 } }}
                  />
                )}

                <div className={classes.buttons}>
                  {activeStep !== 1 && (
                    <Button onClick={_handleBack} className={classes.button}>
                      VOLTAR
                    </Button>
                  )}
                  <div className={classes.wrapper}>
                    {activeStep !== 1 && (
                      <Button
                        disabled={isSubmitting}
                        type="submit"
                        variant="contained"
                        color="primary"
                        className={classes.button}
                      >
                        {isLastStep ? "PAGAR" : "PRÓXIMO"}
                      </Button>
                    )}
                    {isSubmitting && (
                      <CircularProgress
                        size={24}
                        className={classes.buttonProgress}
                      />
                    )}
                  </div>
                </div>
                {paymentText && (
  <div className={classes.payHint}>
    <Typography variant="h5" align="center" style={{ color: '#ff5722', fontWeight: 'bold', fontFamily: 'cursive' }}>
      {paymentText}
    </Typography>
  </div>
)}
              </Form>
            )}
          </Formik>
        )}
      </React.Fragment>
    </React.Fragment>
  );
}
