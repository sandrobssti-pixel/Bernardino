import React from 'react';
import { Typography, Grid } from '@material-ui/core';
import useStyles from './styles';

function PaymentDetails(props) {
  const { formValues } = props;
  const classes = useStyles();
  const { plan } = formValues;

  const newPlan = JSON.parse(plan);

  const { users, connections, queues } = newPlan;
  return (
    <Grid item xs={12} className={classes.responsiveColumn}>
      <div className={classes.summaryCard}>
      <Typography className={classes.sectionTitle}>
        Detalhes do plano
      </Typography>
      <div className={classes.row}>
        <Typography className={classes.rowLabel}>Usuários</Typography>
        <Typography className={classes.rowValue}>{users}</Typography>
      </div>
      <div className={classes.row}>
        <Typography className={classes.rowLabel}>Conexões</Typography>
        <Typography className={classes.rowValue}>{connections}</Typography>
      </div>
      <div className={classes.row}>
        <Typography className={classes.rowLabel}>Filas</Typography>
        <Typography className={classes.rowValue}>{queues}</Typography>
      </div>
      <div className={classes.row}>
        <Typography className={classes.rowLabel}>Recorrência</Typography>
        <Typography className={classes.rowValue}>Mensal</Typography>
      </div>
      </div>
    </Grid>
  );
}

export default PaymentDetails;
