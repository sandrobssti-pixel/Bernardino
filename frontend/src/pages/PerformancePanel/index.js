import React, { useEffect, useMemo, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from "@material-ui/core";
import usePerformanceRecords from "../../hooks/usePerformanceRecords";
import toastError from "../../errors/toastError";
import FinanceRecordList from "../../components/FinanceRecordList";
import { performanceRecordColumns, performanceRecordFields } from "./performanceRecordConfig";

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    padding: theme.spacing(2),
    height: "calc(100% - 48px)",
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  pickerBox: {
    marginBottom: theme.spacing(2),
    maxWidth: 420,
  },
}));

// Painel de Desempenho (RH — Fase 3 de 3, ver docs/MANUAL_TECNICO.md) —
// avaliações do gestor, OKRs, feedback 1:1 e matriz de prontidão pra
// promoção. PREMISSA FECHADA COM O CLIENTE JÁ NA FASE 1 (seção 215):
// só Admin/Master ou o gestor daquele funcionário específico enxerga —
// não qualquer um com acesso ao RH. `performance.listEmployees()` já
// devolve só os funcionários que o usuário logado pode gerenciar (o
// backend aplica a trava — ver PerformanceAccessService.ts), então o
// seletor abaixo nunca mostra quem o usuário não deveria ver.
const PerformancePanel = () => {
  const classes = useStyles();
  const performance = usePerformanceRecords();
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  useEffect(() => {
    (async () => {
      setLoadingEmployees(true);
      try {
        const data = await performance.listEmployees();
        setEmployees(data || []);
      } catch (err) {
        toastError(err);
      } finally {
        setLoadingEmployees(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fecha o `employeeId` sobre o resource genérico — FinanceRecordList
  // não sabe (nem precisa saber) que os registros são de um funcionário
  // específico, igual o padrão já usado em EmployeeDependentsModal.
  const resource = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return {
      list: (params) => performance.list({ ...params, employeeId: selectedEmployeeId }),
      save: (payload) => performance.save({ ...payload, employeeId: selectedEmployeeId }),
      update: (id, payload) => performance.update(id, { ...payload, employeeId: selectedEmployeeId }),
      remove: (id) => performance.remove(id),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployeeId]);

  return (
    <div className={classes.pageRoot}>
      <Typography variant="caption" color="textSecondary" paragraph>
        Avaliações de desempenho, OKRs, feedback 1:1 e matriz de prontidão
        pra promoção. Você só vê os funcionários que gerencia (ou todos,
        se for Admin/Master).
      </Typography>

      <Box className={classes.pickerBox}>
        <FormControl variant="outlined" size="small" fullWidth>
          <InputLabel>Funcionário</InputLabel>
          <Select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            label="Funcionário"
            disabled={loadingEmployees}
          >
            {loadingEmployees ? (
              <MenuItem value="">
                <CircularProgress size={16} />
              </MenuItem>
            ) : employees.length === 0 ? (
              <MenuItem value="" disabled>
                Nenhum funcionário sob sua gestão
              </MenuItem>
            ) : (
              employees.map((emp) => (
                <MenuItem key={emp.id} value={emp.id}>
                  {emp.name}
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>
      </Box>

      {resource && (
        <FinanceRecordList
          title="Registro de Desempenho"
          resource={resource}
          columns={performanceRecordColumns}
          fields={performanceRecordFields}
        />
      )}
    </div>
  );
};

export default PerformancePanel;
