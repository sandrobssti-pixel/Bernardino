import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";
import Box from "@material-ui/core/Box";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Chip from "@material-ui/core/Chip";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import CircularProgress from "@material-ui/core/CircularProgress";
import Divider from "@material-ui/core/Divider";
import WorkOutlineIcon from "@material-ui/icons/WorkOutline";
import PeopleAltIcon from "@material-ui/icons/PeopleAlt";
import RoomIcon from "@material-ui/icons/Room";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";

import useHR from "../../hooks/useHR";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  page: {
    minHeight: "100vh",
    backgroundColor: theme.palette.type === "light" ? "#f4f7fb" : theme.palette.background.default,
    padding: theme.spacing(4, 0),
  },
  hero: {
    marginBottom: theme.spacing(3),
    textAlign: "center",
    padding: theme.spacing(4, 3),
    borderRadius: 16,
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    color: "#fff",
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    margin: "0 auto",
    marginBottom: theme.spacing(1.5),
    "& svg": { fontSize: 28 },
  },
  heroCompany: {
    fontWeight: 700,
    fontSize: "1.4rem",
  },
  heroCount: {
    marginTop: theme.spacing(1),
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.5, 1.5),
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    fontSize: "0.82rem",
    fontWeight: 600,
  },
  jobCard: {
    padding: theme.spacing(2.5),
    borderRadius: 12,
    marginBottom: theme.spacing(2),
    cursor: "pointer",
    transition: "box-shadow 0.15s ease, transform 0.15s ease",
    "&:hover": { boxShadow: theme.shadows[4], transform: "translateY(-2px)" },
  },
  jobTitle: {
    fontWeight: 700,
    fontSize: "1.05rem",
    marginBottom: theme.spacing(0.5),
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    color: theme.palette.text.secondary,
    fontSize: "0.85rem",
  },
  chipsRow: {
    display: "flex",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
    flexWrap: "wrap",
  },
  detailPaper: {
    padding: theme.spacing(3),
    borderRadius: 12,
  },
  emptyState: {
    padding: theme.spacing(6, 2),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
  formSection: {
    marginTop: theme.spacing(3),
  },
}));

// Página pública de vagas (Fase 5 — módulo de RH, ver docs/MANUAL_TECNICO.md,
// seção 6.2). Não exige login — candidatos anônimos veem as vagas abertas de
// uma empresa e se candidatam anexando currículo. Uma única rota
// `/vagas/:companyId/:jobId?` cobre tanto a listagem quanto o detalhe +
// formulário de candidatura, decidindo internamente pelo parâmetro `jobId`.
const PublicJobBoard = () => {
  const classes = useStyles();
  const { companyId, jobId } = useParams();
  const hr = useHR();

  const [loading, setLoading] = useState(true);
  const [jobPostings, setJobPostings] = useState([]);
  const [jobPosting, setJobPosting] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ candidateName: "", candidateEmail: "", candidatePhone: "", coverLetter: "" });
  const [resumeFile, setResumeFile] = useState(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hr.publicJobs.list(companyId);
      setJobPostings(data || []);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const data = await hr.publicJobs.show(companyId, jobId);
      setJobPosting(data);
    } catch (err) {
      setNotFound(true);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, jobId]);

  useEffect(() => {
    if (jobId) {
      fetchDetail();
    } else {
      fetchList();
    }
  }, [jobId, fetchDetail, fetchList]);

  const handleFormChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleFileChange = (e) => {
    setResumeFile(e.target.files?.[0] || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.candidateName || !form.candidateEmail) {
      toast.error("Preencha nome e e-mail para se candidatar.");
      return;
    }
    if (!resumeFile) {
      toast.error("Anexe seu currículo (PDF ou Word) para se candidatar.");
      return;
    }

    const formData = new FormData();
    formData.append("candidateName", form.candidateName);
    formData.append("candidateEmail", form.candidateEmail);
    formData.append("candidatePhone", form.candidatePhone);
    formData.append("coverLetter", form.coverLetter);
    formData.append("resume", resumeFile);

    setSubmitting(true);
    try {
      await hr.publicJobs.apply(companyId, jobId, formData);
      setSubmitted(true);
    } catch (err) {
      toastError(err);
    }
    setSubmitting(false);
  };

  const employmentTypeLabel = {
    clt: "CLT", pj: "PJ", estagio: "Estágio", temporario: "Temporário", freelancer: "Freelancer",
  };
  const workModeLabel = { presencial: "Presencial", hibrido: "Híbrido", remoto: "Remoto" };

  // Ao navegar da listagem pro detalhe (client-side, sem reload), esse
  // mesmo componente é reaproveitado: `jobId` muda no primeiro render, mas
  // `jobPosting`/`loading` só são atualizados depois, no efeito. Por isso
  // o guard de loading verifica também "ainda não tenho os dados certos
  // pra esse jobId", não só a flag `loading` isolada — senão dá erro de
  // null (`jobPosting.title`) nesse intervalo.
  const showSpinner = loading || (jobId && !jobPosting && !notFound);
  if (showSpinner) {
    return (
      <div className={classes.page}>
        <Container maxWidth="sm">
          <Box display="flex" justifyContent="center" my={8}>
            <CircularProgress />
          </Box>
        </Container>
      </div>
    );
  }

  // ── Detalhe da vaga + formulário de candidatura ──────────────────────
  if (jobId) {
    if (notFound) {
      return (
        <div className={classes.page}>
          <Container maxWidth="sm">
            <Paper className={classes.detailPaper}>
              <Typography variant="h6" gutterBottom>Vaga não encontrada</Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Essa vaga não existe ou não está mais disponível.
              </Typography>
              <Button
                component={RouterLink}
                to={`/vagas/${companyId}`}
                startIcon={<ArrowBackIcon />}
                style={{ marginTop: 16 }}
              >
                Ver vagas abertas
              </Button>
            </Paper>
          </Container>
        </div>
      );
    }

    return (
      <div className={classes.page}>
        <Container maxWidth="sm">
          <Button
            component={RouterLink}
            to={`/vagas/${companyId}`}
            startIcon={<ArrowBackIcon />}
            style={{ marginBottom: 16 }}
          >
            Voltar para vagas
          </Button>
          <Paper className={classes.detailPaper}>
            {jobPosting.company?.name && (
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {jobPosting.company.name}
              </Typography>
            )}
            <Typography className={classes.jobTitle} variant="h5">{jobPosting.title}</Typography>
            <Box className={classes.chipsRow}>
              {jobPosting.department && <Chip size="small" label={jobPosting.department} />}
              <Chip size="small" label={employmentTypeLabel[jobPosting.employmentType] || jobPosting.employmentType} />
              <Chip size="small" label={workModeLabel[jobPosting.workMode] || jobPosting.workMode} />
              {jobPosting.location && (
                <Chip size="small" icon={<RoomIcon style={{ fontSize: 14 }} />} label={jobPosting.location} />
              )}
            </Box>

            {jobPosting.description && (
              <Box mt={3}>
                <Typography variant="subtitle2" gutterBottom>Descrição</Typography>
                <Typography variant="body2" style={{ whiteSpace: "pre-line" }}>
                  {jobPosting.description}
                </Typography>
              </Box>
            )}

            {jobPosting.requirements && (
              <Box mt={2}>
                <Typography variant="subtitle2" gutterBottom>Requisitos</Typography>
                <Typography variant="body2" style={{ whiteSpace: "pre-line" }}>
                  {jobPosting.requirements}
                </Typography>
              </Box>
            )}

            {jobPosting.salaryRange && (
              <Box mt={2}>
                <Typography variant="subtitle2" gutterBottom>Faixa salarial</Typography>
                <Typography variant="body2">{jobPosting.salaryRange}</Typography>
              </Box>
            )}

            <Divider style={{ margin: "24px 0" }} />

            {submitted ? (
              <Box textAlign="center" py={3}>
                <Typography variant="h6" gutterBottom>Candidatura enviada! 🎉</Typography>
                <Typography variant="body2" color="textSecondary">
                  Obrigado pelo interesse. A empresa vai analisar seu currículo e entrar em contato.
                </Typography>
              </Box>
            ) : (
              <form onSubmit={handleSubmit} className={classes.formSection}>
                <Typography variant="subtitle1" gutterBottom>Candidate-se a esta vaga</Typography>
                <Box display="flex" flexDirection="column" style={{ gap: 12 }}>
                  <TextField
                    fullWidth
                    variant="outlined"
                    size="small"
                    label="Nome completo"
                    required
                    value={form.candidateName}
                    onChange={handleFormChange("candidateName")}
                  />
                  <TextField
                    fullWidth
                    variant="outlined"
                    size="small"
                    label="E-mail"
                    type="email"
                    required
                    value={form.candidateEmail}
                    onChange={handleFormChange("candidateEmail")}
                  />
                  <TextField
                    fullWidth
                    variant="outlined"
                    size="small"
                    label="Telefone"
                    value={form.candidatePhone}
                    onChange={handleFormChange("candidatePhone")}
                  />
                  <TextField
                    fullWidth
                    variant="outlined"
                    size="small"
                    multiline
                    minRows={3}
                    label="Carta de apresentação (opcional)"
                    value={form.coverLetter}
                    onChange={handleFormChange("coverLetter")}
                  />
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<AttachFileIcon />}
                    style={{ alignSelf: "flex-start" }}
                  >
                    {resumeFile ? resumeFile.name : "Anexar currículo (PDF ou Word)"}
                    <input
                      type="file"
                      hidden
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleFileChange}
                    />
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={submitting}
                    style={{ marginTop: 8 }}
                  >
                    {submitting ? <CircularProgress size={20} /> : "Enviar candidatura"}
                  </Button>
                </Box>
              </form>
            )}
          </Paper>
        </Container>
      </div>
    );
  }

  // ── Listagem de vagas abertas ─────────────────────────────────────────
  const companyName = jobPostings[0]?.company?.name;

  return (
    <div className={classes.page}>
      <Container maxWidth="sm">
        <Paper className={classes.hero} elevation={0}>
          <Box className={classes.heroIcon}>
            <WorkOutlineIcon />
          </Box>
          <Typography className={classes.heroCompany}>
            {companyName || "Vagas abertas"}
          </Typography>
          {companyName && (
            <Typography variant="body2" style={{ opacity: 0.9, marginTop: 4 }}>
              Vagas abertas
            </Typography>
          )}
          <Box className={classes.heroCount}>
            <PeopleAltIcon style={{ fontSize: 16 }} />
            {jobPostings.length} {jobPostings.length === 1 ? "vaga aberta" : "vagas abertas"}
          </Box>
        </Paper>

        {jobPostings.length === 0 && (
          <Paper className={classes.emptyState}>
            <Typography variant="body2">Nenhuma vaga aberta no momento.</Typography>
          </Paper>
        )}

        {jobPostings.map((jobPosting) => (
          <Paper
            key={jobPosting.id}
            className={classes.jobCard}
            component={RouterLink}
            to={`/vagas/${companyId}/${jobPosting.id}`}
            style={{ display: "block", textDecoration: "none", color: "inherit" }}
          >
            <Typography className={classes.jobTitle}>{jobPosting.title}</Typography>
            {jobPosting.location && (
              <Box className={classes.metaRow}>
                <RoomIcon style={{ fontSize: 15 }} /> {jobPosting.location}
              </Box>
            )}
            <Box className={classes.chipsRow}>
              {jobPosting.department && <Chip size="small" label={jobPosting.department} />}
              <Chip size="small" label={employmentTypeLabel[jobPosting.employmentType] || jobPosting.employmentType} />
              <Chip size="small" label={workModeLabel[jobPosting.workMode] || jobPosting.workMode} />
            </Box>
          </Paper>
        ))}
      </Container>
    </div>
  );
};

export default PublicJobBoard;
