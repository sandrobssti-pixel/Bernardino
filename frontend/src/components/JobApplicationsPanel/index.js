import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import Chip from "@material-ui/core/Chip";
import Tooltip from "@material-ui/core/Tooltip";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import Grid from "@material-ui/core/Grid";

import VisibilityIcon from "@material-ui/icons/Visibility";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";

import TableRowSkeleton from "../TableRowSkeleton";
import ConfirmationModal from "../ConfirmationModal";
import JobApplicationDetailModal from "../JobApplicationDetailModal";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  root: { width: "100%" },
  filters: {
    marginBottom: theme.spacing(2),
  },
  tablePaper: {
    borderRadius: 12,
    overflowX: "auto",
  },
}));

const statusChip = (status) => {
  const map = {
    received: { label: "Recebida", color: "#6b7280" },
    screening: { label: "Em triagem", color: "#3b82f6" },
    interview: { label: "Entrevista", color: "#8b5cf6" },
    approved: { label: "Aprovada", color: "#10b981" },
    rejected: { label: "Reprovada", color: "#ef4444" },
  };
  const item = map[status] || map.received;
  return <Chip size="small" label={item.label} style={{ backgroundColor: item.color, color: "#fff" }} />;
};

// Painel de triagem de candidaturas (Fase 5 — módulo de RH, ver
// docs/MANUAL_TECNICO.md, seção 6.2). Filtra por vaga e por status; clicar
// numa linha abre o modal de triagem (status/observações/nota/efetivação).
const JobApplicationsPanel = ({ hr }) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  const [applications, setApplications] = useState([]);
  const [jobPostings, setJobPostings] = useState([]);
  const [jobPostingFilter, setJobPostingFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchJobPostings = useCallback(async () => {
    try {
      const data = await hr.jobPostings.list({});
      setJobPostings(data.records || []);
    } catch (err) {
      toastError(err);
    }
  }, [hr]);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hr.jobApplications.list({
        jobPostingId: jobPostingFilter || undefined,
        status: statusFilter || undefined,
      });
      setApplications(data.records || []);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  }, [hr, jobPostingFilter, statusFilter]);

  useEffect(() => {
    fetchJobPostings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleDelete = async () => {
    try {
      await hr.jobApplications.remove(deleteTarget.id);
      toast.success("Candidatura excluída.");
      fetchApplications();
    } catch (err) {
      toastError(err);
    }
    setDeleteTarget(null);
  };

  return (
    <div className={classes.root}>
      <JobApplicationDetailModal
        open={!!selected}
        onClose={() => setSelected(null)}
        onSaved={fetchApplications}
        application={selected}
        hr={hr}
      />

      <ConfirmationModal
        title={deleteTarget ? `Excluir candidatura de "${deleteTarget.candidateName}"?` : ""}
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      >
        Essa ação não pode ser desfeita.
      </ConfirmationModal>

      <Grid container spacing={2} className={classes.filters}>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            select
            fullWidth
            variant="outlined"
            size="small"
            label="Vaga"
            value={jobPostingFilter}
            onChange={(e) => setJobPostingFilter(e.target.value)}
          >
            <MenuItem value="">Todas as vagas</MenuItem>
            {jobPostings.map((jp) => (
              <MenuItem key={jp.id} value={jp.id}>{jp.title}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            select
            fullWidth
            variant="outlined"
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="">Todos os status</MenuItem>
            <MenuItem value="received">Recebida</MenuItem>
            <MenuItem value="screening">Em triagem</MenuItem>
            <MenuItem value="interview">Entrevista</MenuItem>
            <MenuItem value="approved">Aprovada</MenuItem>
            <MenuItem value="rejected">Reprovada</MenuItem>
          </TextField>
        </Grid>
      </Grid>

      <Paper className={classes.tablePaper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Candidato</TableCell>
              <TableCell>Vaga</TableCell>
              <TableCell>E-mail</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {applications.map((application) => (
              <TableRow key={application.id} hover style={{ cursor: "pointer" }}>
                <TableCell onClick={() => setSelected(application)}>
                  {application.candidateName}
                </TableCell>
                <TableCell onClick={() => setSelected(application)}>
                  {application.jobPosting?.title || "—"}
                </TableCell>
                <TableCell onClick={() => setSelected(application)}>
                  {application.candidateEmail}
                </TableCell>
                <TableCell onClick={() => setSelected(application)}>
                  {statusChip(application.status)}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Ver / triar">
                    <IconButton size="small" onClick={() => setSelected(application)}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Excluir">
                    <IconButton size="small" onClick={() => setDeleteTarget(application)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {loading && <TableRowSkeleton columns={5} />}
            {!loading && applications.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  Nenhuma candidatura recebida ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </div>
  );
};

export default JobApplicationsPanel;
