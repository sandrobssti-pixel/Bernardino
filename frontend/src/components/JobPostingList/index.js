import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import Chip from "@material-ui/core/Chip";
import Box from "@material-ui/core/Box";
import Tooltip from "@material-ui/core/Tooltip";

import AddIcon from "@material-ui/icons/Add";
import EditIcon from "@material-ui/icons/Edit";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import FileCopyIcon from "@material-ui/icons/FileCopy";

import TableRowSkeleton from "../TableRowSkeleton";
import ConfirmationModal from "../ConfirmationModal";
import JobPostingModal from "../JobPostingModal";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  root: { width: "100%" },
  mainHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(2),
  },
  tablePaper: {
    borderRadius: 12,
    overflowX: "auto",
  },
}));

const statusChip = (status) => {
  if (status === "open") return <Chip size="small" label="Aberta" style={{ backgroundColor: "#10b981", color: "#fff" }} />;
  if (status === "paused") return <Chip size="small" label="Pausada" style={{ backgroundColor: "#f59e0b", color: "#fff" }} />;
  return <Chip size="small" label="Encerrada" style={{ backgroundColor: "#6b7280", color: "#fff" }} />;
};

// Lista de vagas (Fase 5 — módulo de RH, ver docs/MANUAL_TECNICO.md, seção
// 6.2). O link público da vaga (sem login) é `/vagas/:companyId/:id` — o
// botão "Copiar link" já monta a URL completa pro admin divulgar.
const JobPostingList = ({ hr, companyId }) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  const [jobPostings, setJobPostings] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchJobPostings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hr.jobPostings.list({});
      setJobPostings(data.records || []);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  }, [hr]);

  useEffect(() => {
    fetchJobPostings();
  }, [fetchJobPostings]);

  const handleOpenNew = () => {
    setSelected(null);
    setModalOpen(true);
  };

  const handleEdit = (jobPosting) => {
    setSelected(jobPosting);
    setModalOpen(true);
  };

  const handleSave = async (values) => {
    if (selected?.id) {
      await hr.jobPostings.update(selected.id, values);
      toast.success("Vaga atualizada com sucesso.");
    } else {
      await hr.jobPostings.save(values);
      toast.success("Vaga criada com sucesso.");
    }
    fetchJobPostings();
  };

  const handleDelete = async () => {
    try {
      await hr.jobPostings.remove(deleteTarget.id);
      toast.success("Vaga excluída.");
      fetchJobPostings();
    } catch (err) {
      toastError(err);
    }
    setDeleteTarget(null);
  };

  const handleCopyLink = (jobPosting) => {
    const url = `${window.location.origin}/vagas/${companyId}/${jobPosting.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      toast.success("Link da vaga copiado.");
    } else {
      toast.info(url);
    }
  };

  return (
    <div className={classes.root}>
      <JobPostingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        jobPosting={selected}
      />

      <ConfirmationModal
        title={deleteTarget ? `Excluir vaga "${deleteTarget.title}"?` : ""}
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      >
        Essa ação não pode ser desfeita. Candidaturas já recebidas continuam salvas.
      </ConfirmationModal>

      <Box className={classes.mainHeader}>
        <div />
        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpenNew}>
          Nova vaga
        </Button>
      </Box>

      <Paper className={classes.tablePaper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Título</TableCell>
              <TableCell>Departamento</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Candidaturas</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobPostings.map((jobPosting) => (
              <TableRow key={jobPosting.id}>
                <TableCell>{jobPosting.id}</TableCell>
                <TableCell>{jobPosting.title}</TableCell>
                <TableCell>{jobPosting.department || "—"}</TableCell>
                <TableCell>{statusChip(jobPosting.status)}</TableCell>
                <TableCell align="center">{jobPosting.applicationCount ?? 0}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Copiar link público da vaga">
                    <IconButton size="small" onClick={() => handleCopyLink(jobPosting)}>
                      <FileCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => handleEdit(jobPosting)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Excluir">
                    <IconButton size="small" onClick={() => setDeleteTarget(jobPosting)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {loading && <TableRowSkeleton columns={6} />}
            {!loading && jobPostings.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Nenhuma vaga cadastrada ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </div>
  );
};

export default JobPostingList;
