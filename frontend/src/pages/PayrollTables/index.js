import React, { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePayroll from "../../hooks/usePayroll";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    padding: theme.spacing(3),
    height: "calc(100% - 48px)",
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  section: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  lockedBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    flex: 1,
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
}));

const INSS_EXAMPLE = JSON.stringify(
  [
    { min: 0, max: 1621.0, rate: 7.5, deduction: 0 },
    { min: 1621.01, max: 2902.84, rate: 9, deduction: 24.32 },
    { min: 2902.85, max: 4354.27, rate: 12, deduction: 111.4 },
    { min: 4354.28, max: 8475.55, rate: 14, deduction: 198.49 },
  ],
  null,
  2
);

const IRRF_EXAMPLE = JSON.stringify(
  [
    { min: 0, max: 2428.8, rate: 0, deduction: 0 },
    { min: 2428.81, max: 2826.65, rate: 7.5, deduction: 182.16 },
    { min: 2826.66, max: 3751.05, rate: 15, deduction: 394.16 },
    { min: 3751.06, max: 4664.68, rate: 22.5, deduction: 675.49 },
    { min: 4664.69, max: null, rate: 27.5, deduction: 908.73 },
  ],
  null,
  2
);

// Administração das tabelas de INSS/IRRF (RH — Fase 2, ver
// docs/MANUAL_TECNICO.md) — só Master (`user.super`), mesmo espírito do
// painel SaaS em GlobalConfig. NUNCA edita uma versão existente — só
// cadastra uma nova (com `effectiveFrom` a partir de quando os valores
// passam a valer), preservando o histórico de cálculos antigos
// corretos. As faixas são coladas como JSON (textarea) — um formulário
// de grade completo seria desproporcional ao escopo desta fase, já que
// isso só é usado quando a Receita Federal/Previdência atualiza os
// valores oficiais (normalmente 1x por ano).
const PayrollTables = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const payroll = usePayroll();

  const [inssTables, setInssTables] = useState([]);
  const [irrfTables, setIrrfTables] = useState([]);
  const [loading, setLoading] = useState(true);

  const [inssForm, setInssForm] = useState({
    effectiveFrom: "",
    ceilingValue: "",
    sourceReference: "",
    bracketsJson: INSS_EXAMPLE,
  });
  const [irrfForm, setIrrfForm] = useState({
    effectiveFrom: "",
    dependentDeductionValue: "",
    sourceReference: "",
    bracketsJson: IRRF_EXAMPLE,
    lei15270Tier1Limit: "5000.00",
    lei15270Tier2Limit: "7350.00",
    lei15270MaxReduction: "312.89",
    lei15270FormulaConstant: "978.62",
    lei15270FormulaRate: "0.133145",
  });
  const [savingInss, setSavingInss] = useState(false);
  const [savingIrrf, setSavingIrrf] = useState(false);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const [inss, irrf] = await Promise.all([payroll.tables.listInss(), payroll.tables.listIrrf()]);
      setInssTables(inss);
      setIrrfTables(irrf);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user.super) fetchTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user.super) {
    return (
      <div className={classes.pageRoot}>
        <Box className={classes.lockedBox}>
          <Typography variant="h6" gutterBottom>
            Acesso restrito
          </Typography>
          <Typography variant="body2">
            Esta tela é exclusiva do Master do sistema.
          </Typography>
        </Box>
      </div>
    );
  }

  const handleSaveInss = async () => {
    let brackets;
    try {
      brackets = JSON.parse(inssForm.bracketsJson);
    } catch (err) {
      toast.error("JSON das faixas de INSS inválido.");
      return;
    }
    if (!inssForm.effectiveFrom || !inssForm.ceilingValue) {
      toast.warn("Preencha a data de vigência e o teto de contribuição.");
      return;
    }
    setSavingInss(true);
    try {
      await payroll.tables.createInss({
        effectiveFrom: inssForm.effectiveFrom,
        ceilingValue: Number(inssForm.ceilingValue),
        sourceReference: inssForm.sourceReference,
        brackets,
      });
      toast.success("Nova versão da tabela de INSS cadastrada!");
      setInssForm({ effectiveFrom: "", ceilingValue: "", sourceReference: "", bracketsJson: INSS_EXAMPLE });
      fetchTables();
    } catch (err) {
      toastError(err);
    } finally {
      setSavingInss(false);
    }
  };

  const handleSaveIrrf = async () => {
    let brackets;
    try {
      brackets = JSON.parse(irrfForm.bracketsJson);
    } catch (err) {
      toast.error("JSON das faixas de IRRF inválido.");
      return;
    }
    if (!irrfForm.effectiveFrom || !irrfForm.dependentDeductionValue) {
      toast.warn("Preencha a data de vigência e o valor de dedução por dependente.");
      return;
    }
    setSavingIrrf(true);
    try {
      await payroll.tables.createIrrf({
        effectiveFrom: irrfForm.effectiveFrom,
        dependentDeductionValue: Number(irrfForm.dependentDeductionValue),
        sourceReference: irrfForm.sourceReference,
        brackets,
        lei15270Tier1Limit: Number(irrfForm.lei15270Tier1Limit),
        lei15270Tier2Limit: Number(irrfForm.lei15270Tier2Limit),
        lei15270MaxReduction: Number(irrfForm.lei15270MaxReduction),
        lei15270FormulaConstant: Number(irrfForm.lei15270FormulaConstant),
        lei15270FormulaRate: Number(irrfForm.lei15270FormulaRate),
      });
      toast.success("Nova versão da tabela de IRRF cadastrada!");
      setIrrfForm({
        effectiveFrom: "",
        dependentDeductionValue: "",
        sourceReference: "",
        bracketsJson: IRRF_EXAMPLE,
        lei15270Tier1Limit: "5000.00",
        lei15270Tier2Limit: "7350.00",
        lei15270MaxReduction: "312.89",
        lei15270FormulaConstant: "978.62",
        lei15270FormulaRate: "0.133145",
      });
      fetchTables();
    } catch (err) {
      toastError(err);
    } finally {
      setSavingIrrf(false);
    }
  };

  return (
    <div className={classes.pageRoot}>
      <Typography variant="h5" gutterBottom>
        Tabelas de INSS / IRRF
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Usadas pelo cálculo de Folha de Pagamento (módulo RH). Cadastrar
        uma versão nova NÃO apaga as anteriores — folhas já calculadas
        continuam usando a tabela que valia na época. Cadastre uma
        versão nova só quando a Receita Federal/Previdência publicar
        valores atualizados, com a data a partir de quando eles valem.
      </Typography>

      {loading ? (
        <CircularProgress />
      ) : (
        <>
          <Paper className={classes.section} variant="outlined">
            <Typography variant="h6" gutterBottom>
              INSS
            </Typography>
            <Table size="small" style={{ marginBottom: 16 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Vigente desde</TableCell>
                  <TableCell>Teto</TableCell>
                  <TableCell>Fonte</TableCell>
                  <TableCell>Faixas</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inssTables.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.effectiveFrom}</TableCell>
                    <TableCell>{t.ceilingValue}</TableCell>
                    <TableCell>{t.sourceReference || "—"}</TableCell>
                    <TableCell>{t.brackets?.length || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Typography variant="subtitle2" gutterBottom>
              Cadastrar nova versão
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Vigente a partir de"
                  type="date"
                  value={inssForm.effectiveFrom}
                  onChange={(e) => setInssForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
                  variant="outlined"
                  size="small"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Teto de contribuição (R$)"
                  value={inssForm.ceilingValue}
                  onChange={(e) => setInssForm((f) => ({ ...f, ceilingValue: e.target.value }))}
                  variant="outlined"
                  size="small"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Fonte (Portaria/IN)"
                  value={inssForm.sourceReference}
                  onChange={(e) => setInssForm((f) => ({ ...f, sourceReference: e.target.value }))}
                  variant="outlined"
                  size="small"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label='Faixas (JSON: [{"min","max","rate","deduction"}, ...])'
                  value={inssForm.bracketsJson}
                  onChange={(e) => setInssForm((f) => ({ ...f, bracketsJson: e.target.value }))}
                  variant="outlined"
                  size="small"
                  fullWidth
                  multiline
                  minRows={6}
                />
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" color="primary" onClick={handleSaveInss} disabled={savingInss}>
                  {savingInss ? <CircularProgress size={20} /> : "Cadastrar versão de INSS"}
                </Button>
              </Grid>
            </Grid>
          </Paper>

          <Paper className={classes.section} variant="outlined">
            <Typography variant="h6" gutterBottom>
              IRRF
            </Typography>
            <Table size="small" style={{ marginBottom: 16 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Vigente desde</TableCell>
                  <TableCell>Dedução/dependente</TableCell>
                  <TableCell>Fonte</TableCell>
                  <TableCell>Faixas</TableCell>
                  <TableCell>Redutor Lei 15.270/2025</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {irrfTables.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.effectiveFrom}</TableCell>
                    <TableCell>{t.dependentDeductionValue}</TableCell>
                    <TableCell>{t.sourceReference || "—"}</TableCell>
                    <TableCell>{t.brackets?.length || 0}</TableCell>
                    <TableCell>
                      até R$ {t.lei15270Tier1Limit}: máx R$ {t.lei15270MaxReduction} · até R${" "}
                      {t.lei15270Tier2Limit}: R$ {t.lei15270FormulaConstant} − {t.lei15270FormulaRate} × bruto
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Typography variant="subtitle2" gutterBottom>
              Cadastrar nova versão
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Vigente a partir de"
                  type="date"
                  value={irrfForm.effectiveFrom}
                  onChange={(e) => setIrrfForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
                  variant="outlined"
                  size="small"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Dedução por dependente (R$)"
                  value={irrfForm.dependentDeductionValue}
                  onChange={(e) => setIrrfForm((f) => ({ ...f, dependentDeductionValue: e.target.value }))}
                  variant="outlined"
                  size="small"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Fonte (Portaria/IN)"
                  value={irrfForm.sourceReference}
                  onChange={(e) => setIrrfForm((f) => ({ ...f, sourceReference: e.target.value }))}
                  variant="outlined"
                  size="small"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label='Faixas (JSON: [{"min","max","rate","deduction"}, ...])'
                  value={irrfForm.bracketsJson}
                  onChange={(e) => setIrrfForm((f) => ({ ...f, bracketsJson: e.target.value }))}
                  variant="outlined"
                  size="small"
                  fullWidth
                  multiline
                  minRows={6}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Redutor adicional da Lei 15.270/2025 (vigente desde jan/2026) — aplicado sobre o
                  rendimento BRUTO mensal, nunca sobre a base já líquida de INSS/dependentes.
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Limite faixa 1 — isenção plena (R$)"
                  value={irrfForm.lei15270Tier1Limit}
                  onChange={(e) => setIrrfForm((f) => ({ ...f, lei15270Tier1Limit: e.target.value }))}
                  variant="outlined"
                  size="small"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Redução máxima na faixa 1 (R$)"
                  value={irrfForm.lei15270MaxReduction}
                  onChange={(e) => setIrrfForm((f) => ({ ...f, lei15270MaxReduction: e.target.value }))}
                  variant="outlined"
                  size="small"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Limite faixa 2 — redução decrescente (R$)"
                  value={irrfForm.lei15270Tier2Limit}
                  onChange={(e) => setIrrfForm((f) => ({ ...f, lei15270Tier2Limit: e.target.value }))}
                  variant="outlined"
                  size="small"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Constante da fórmula (faixa 2, R$)"
                  value={irrfForm.lei15270FormulaConstant}
                  onChange={(e) => setIrrfForm((f) => ({ ...f, lei15270FormulaConstant: e.target.value }))}
                  variant="outlined"
                  size="small"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Taxa da fórmula (faixa 2)"
                  value={irrfForm.lei15270FormulaRate}
                  onChange={(e) => setIrrfForm((f) => ({ ...f, lei15270FormulaRate: e.target.value }))}
                  variant="outlined"
                  size="small"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" color="primary" onClick={handleSaveIrrf} disabled={savingIrrf}>
                  {savingIrrf ? <CircularProgress size={20} /> : "Cadastrar versão de IRRF"}
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </>
      )}
    </div>
  );
};

export default PayrollTables;
