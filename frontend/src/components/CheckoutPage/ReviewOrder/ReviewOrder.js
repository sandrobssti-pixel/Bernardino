import React from 'react';
import { useFormikContext } from 'formik';
import { Typography, Grid } from '@material-ui/core';
import ShippingDetails from './ShippingDetails';
import PaymentDetails from './PaymentDetails';
import useStyles from './styles';

export default function ReviewOrder() {
  const { values: formValues } = useFormikContext();
  const classes = useStyles();

  return (
    <div className={classes.reviewWrap}>
      <Typography className={classes.headerTitle}>
        Resumo da assinatura
      </Typography>
      <Typography className={classes.headerSubtitle}>
        Confira os dados antes de gerar a cobrança.
      </Typography>
      <Grid container spacing={2}>
        <ShippingDetails formValues={formValues} />
        <PaymentDetails formValues={formValues} />
      </Grid>
    </div>
  );
}
