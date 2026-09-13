import React, { useContext } from 'react';
import { Typography, Grid } from '@material-ui/core';
import useStyles from './styles';
import { AuthContext } from "../../../context/Auth/AuthContext";

function PaymentDetails(props) {
  const { formValues } = props;
  const classes = useStyles();
  const { firstName, zipcode, plan, email } = formValues;
  const { user } = useContext(AuthContext);

  let parsedPlan = {};
  try {
    parsedPlan = plan ? JSON.parse(plan) : {};
  } catch (_) {
    parsedPlan = {};
  }
  const price = Number(parsedPlan?.price || 0);
  const displayName =
    firstName ||
    user?.company?.name ||
    user?.name ||
    "-";
  const displayDocument =
    zipcode ||
    user?.company?.document ||
    "-";
  const displayEmail =
    email ||
    user?.company?.email ||
    user?.email ||
    "-";

  return (
    <Grid item xs={12} className={classes.responsiveColumn}>
      <div className={classes.summaryCard}>
      <Typography className={classes.sectionTitle}>
        Informação de pagamento
      </Typography>
      <div className={classes.row}>
        <Typography className={classes.rowLabel}>E-mail</Typography>
        <Typography className={classes.rowValue}>{displayEmail}</Typography>
      </div>
      <div className={classes.row}>
        <Typography className={classes.rowLabel}>Nome</Typography>
        <Typography className={classes.rowValue}>{displayName}</Typography>
      </div>
      <div className={classes.row}>
        <Typography className={classes.rowLabel}>CPF/CNPJ</Typography>
        <Typography className={classes.rowValue}>{displayDocument}</Typography>
      </div>
      <div className={classes.row}>
        <Typography className={classes.rowLabel}>Total</Typography>
        <Typography className={`${classes.rowValue} ${classes.totalValue}`}>
          R${price.toLocaleString('pt-br', { minimumFractionDigits: 2 })}
        </Typography>
      </div>
      <div className={classes.tag}>Sua assinatura será renovada após a confirmação do pagamento</div>
      </div>
    </Grid>
  );
}

export default PaymentDetails;
