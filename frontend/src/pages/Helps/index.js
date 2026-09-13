import React, { useState, useEffect, useCallback } from "react";
import {
  makeStyles,
  Typography,
  Modal,
  Backdrop,
  Fade,
  InputBase,
  IconButton,
  TextField,
  InputAdornment,
} from "@material-ui/core";
import {
  Search as SearchIcon,
  Close as CloseIcon,
  PlayArrow as PlayArrowIcon,
  OndemandVideo as OndemandVideoIcon,
  Clear as ClearIcon,
} from "@material-ui/icons";
import { i18n } from "../../translate/i18n";
import useHelps from "../../hooks/useHelps";

const useStyles = makeStyles((theme) => ({
  // ── Page wrapper ─────────────────────────────────────────────────────────
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
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1.5),
    },
  },

  // ── Search bar ────────────────────────────────────────────────────────────
  searchRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2.5),
  },
  searchField: {
    flex: 1,
    "& .MuiOutlinedInput-root": {
      borderRadius: 10,
      backgroundColor: theme.palette.background.paper,
      border: `1px solid ${theme.palette.divider}`,
      "& fieldset": { border: "none" },
      "&:focus-within": {
        borderColor: theme.palette.primary.main,
        boxShadow: `0 0 0 3px ${
          theme.palette.type === "light"
            ? "rgba(99,102,241,0.12)"
            : "rgba(99,102,241,0.2)"
        }`,
      },
    },
    "& .MuiInputBase-input": {
      fontSize: "0.82rem",
      paddingTop: 11,
      paddingBottom: 11,
    },
  },
  resultsMeta: {
    fontSize: "0.75rem",
    color: theme.palette.text.disabled,
    fontWeight: 600,
    letterSpacing: "0.04em",
    marginBottom: theme.spacing(2),
  },

  // ── Cards grid ────────────────────────────────────────────────────────────
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: theme.spacing(2.5),
    [theme.breakpoints.down("xs")]: {
      gridTemplateColumns: "1fr",
    },
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: theme.palette.background.paper,
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
    boxShadow:
      theme.palette.type === "dark"
        ? "0 1px 3px rgba(0,0,0,0.4)"
        : "0 1px 3px rgba(15,23,42,0.08)",
    "&:hover": {
      transform: "translateY(-3px)",
      boxShadow:
        theme.palette.type === "light"
          ? "0 12px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)"
          : "0 12px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)",
      borderColor:
        theme.palette.type === "light"
          ? "rgba(99,102,241,0.35)"
          : "rgba(99,102,241,0.4)",
      "& $thumbOverlay": { opacity: 1 },
      "& $playBtn": { transform: "scale(1.08)" },
    },
    "&:active": {
      transform: "translateY(-1px)",
    },
  },

  // ── Thumbnail area ────────────────────────────────────────────────────────
  thumbWrap: {
    position: "relative",
    width: "100%",
    paddingTop: "56.25%",
    backgroundColor:
      theme.palette.type === "light" ? "#e8eef6" : "#111827",
    overflow: "hidden",
  },
  thumb: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  thumbOverlay: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(135deg, rgba(99,102,241,0.55) 0%, rgba(16,16,40,0.72) 100%)",
    opacity: 0,
    transition: "opacity 0.2s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    backgroundColor: "rgba(255,255,255,0.95)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
    transition: "transform 0.18s ease",
    "& svg": {
      fontSize: 24,
      color: "#4f46e5",
      marginLeft: 3,
    },
  },
  thumbPlaceholder: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    "& svg": {
      fontSize: 40,
      color:
        theme.palette.type === "light"
          ? "rgba(0,0,0,0.12)"
          : "rgba(255,255,255,0.08)",
    },
  },

  // ── Card body ─────────────────────────────────────────────────────────────
  cardBody: {
    padding: theme.spacing(1.75, 2, 2, 2),
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(0.5),
  },
  cardTitle: {
    fontWeight: 700,
    fontSize: "0.88rem",
    color: theme.palette.type === "dark" ? "#f1f5f9" : "#0f172a",
    lineHeight: 1.4,
    letterSpacing: "-0.01em",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  cardDesc: {
    fontSize: "0.78rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    lineHeight: 1.5,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    marginTop: theme.spacing(0.25),
  },
  cardFooter: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: theme.spacing(1),
  },
  cardBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 12,
    fontSize: "0.68rem",
    fontWeight: 600,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(99,102,241,0.15)"
        : "rgba(99,102,241,0.08)",
    color: "#6366f1",
    border: "1px solid rgba(99,102,241,0.2)",
  },

  // ── Skeleton loading ──────────────────────────────────────────────────────
  skeletonCard: {
    backgroundColor: theme.palette.background.paper,
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
  },
  skeletonThumb: {
    width: "100%",
    paddingTop: "56.25%",
    backgroundColor:
      theme.palette.type === "light" ? "#e8eef6" : "#1a2236",
    animation: "$shimmer 1.5s infinite",
    position: "relative",
    overflow: "hidden",
    "&::after": {
      content: '""',
      position: "absolute",
      inset: 0,
      background:
        theme.palette.type === "light"
          ? "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)"
          : "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
      animation: "$shimmerSlide 1.5s infinite",
    },
  },
  skeletonBody: {
    padding: theme.spacing(1.75, 2, 2, 2),
  },
  skeletonLine: {
    borderRadius: 6,
    backgroundColor:
      theme.palette.type === "light" ? "#e8eef6" : "#1a2236",
    animation: "$shimmer 1.5s infinite",
    marginBottom: theme.spacing(1),
  },
  "@keyframes shimmer": {
    "0%": { opacity: 1 },
    "50%": { opacity: 0.6 },
    "100%": { opacity: 1 },
  },
  "@keyframes shimmerSlide": {
    "0%": { transform: "translateX(-100%)" },
    "100%": { transform: "translateX(100%)" },
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(8, 2),
    textAlign: "center",
    gap: theme.spacing(1.5),
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.05)"
        : "rgba(15,23,42,0.04)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing(1),
    color: theme.palette.type === "dark" ? "#475569" : "#94a3b8",
  },
  emptyTitle: {
    fontWeight: 600,
    fontSize: "0.95rem",
    color: theme.palette.type === "dark" ? "#cbd5e1" : "#334155",
  },
  emptySubtitle: {
    fontSize: "0.8rem",
    color: theme.palette.type === "dark" ? "#64748b" : "#94a3b8",
    maxWidth: 320,
    lineHeight: 1.5,
  },

  // ── Video Modal ───────────────────────────────────────────────────────────
  modalBackdrop: {
    backdropFilter: "blur(6px)",
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  modalWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(2),
    outline: "none",
    height: "100%",
  },
  modalBox: {
    outline: "none",
    width: "min(900px, 96vw)",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
    animation: "$fadeSlideUp 0.22s ease",
  },
  "@keyframes fadeSlideUp": {
    "0%": { opacity: 0, transform: "translateY(16px) scale(0.98)" },
    "100%": { opacity: 1, transform: "translateY(0) scale(1)" },
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1.5),
    paddingLeft: 2,
  },
  modalTitle: {
    fontWeight: 700,
    fontSize: "1rem",
    color: "#fff",
    lineHeight: 1.35,
    flex: 1,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
    transition: "background 0.15s",
    "&:hover": { backgroundColor: "rgba(255,255,255,0.18)" },
    "& svg": { fontSize: 18, color: "#fff" },
  },
  modalVideo: {
    width: "100%",
    aspectRatio: "16/9",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 8px 32px rgba(0,0,0,0.4)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
}));

// ── Skeleton card ──────────────────────────────────────────────────────────────

const SkeletonCard = ({ classes }) => (
  <div className={classes.skeletonCard}>
    <div className={classes.skeletonThumb} />
    <div className={classes.skeletonBody}>
      <div className={classes.skeletonLine} style={{ height: 14, width: "75%" }} />
      <div className={classes.skeletonLine} style={{ height: 12, width: "50%", opacity: 0.6 }} />
    </div>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────

const Helps = () => {
  const classes = useStyles();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedTitle, setSelectedTitle] = useState("");
  const { list } = useHelps();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const helps = await list();
      setRecords(helps);
      setLoading(false);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openVideoModal = useCallback((video, title) => {
    setSelectedVideo(video);
    setSelectedTitle(title || "");
  }, []);

  const closeVideoModal = useCallback(() => {
    setSelectedVideo(null);
    setSelectedTitle("");
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") closeVideoModal();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [closeVideoModal]);

  const filtered = records.filter((r) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (r.title || "").toLowerCase().includes(term) ||
      (r.description || "").toLowerCase().includes(term)
    );
  });

  const renderSkeletons = () =>
    Array.from({ length: 6 }).map((_, i) => (
      <SkeletonCard key={i} classes={classes} />
    ));

  const renderEmpty = () => (
    <div className={classes.emptyWrap}>
      <div className={classes.emptyIcon}>
        <OndemandVideoIcon style={{ fontSize: 28 }} />
      </div>
      <Typography className={classes.emptyTitle}>
        {search ? "Nenhum resultado encontrado" : "Nenhum vídeo disponível"}
      </Typography>
      <Typography className={classes.emptySubtitle}>
        {search
          ? `Nenhum vídeo para "${search}". Tente outros termos.`
          : "Os vídeos de ajuda aparecerão aqui quando forem adicionados."}
      </Typography>
    </div>
  );

  const renderCards = () =>
    filtered.map((record, idx) => (
      <div
        key={record.id || idx}
        className={classes.card}
        role="button"
        tabIndex={0}
        onClick={() => openVideoModal(record.video, record.title)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openVideoModal(record.video, record.title);
          }
        }}
      >
        <div className={classes.thumbWrap}>
          {record.video ? (
            <img
              src={`https://img.youtube.com/vi/${record.video}/mqdefault.jpg`}
              alt={record.title || "Video thumbnail"}
              className={classes.thumb}
              loading="lazy"
            />
          ) : (
            <div className={classes.thumbPlaceholder}>
              <OndemandVideoIcon />
            </div>
          )}
          <div className={classes.thumbOverlay}>
            <div className={classes.playBtn}>
              <PlayArrowIcon />
            </div>
          </div>
        </div>
        <div className={classes.cardBody}>
          <Typography className={classes.cardTitle}>
            {record.title || "Sem título"}
          </Typography>
          {record.description && (
            <Typography className={classes.cardDesc}>
              {record.description}
            </Typography>
          )}
          <div className={classes.cardFooter}>
            <span className={classes.cardBadge}>
              <PlayArrowIcon style={{ fontSize: 10 }} />
              Assistir
            </span>
          </div>
        </div>
      </div>
    ));

  return (
    <div className={classes.pageRoot}>
      {/* ── Search row ── */}
      <div className={classes.searchRow}>
        <TextField
          fullWidth
          placeholder="Buscar vídeos…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          variant="outlined"
          size="small"
          className={classes.searchField}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon style={{ fontSize: 18, color: "#94a3b8" }} />
              </InputAdornment>
            ),
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setSearch("")}
                  style={{ padding: 2 }}
                >
                  <ClearIcon style={{ fontSize: 16, color: "#94a3b8" }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
      </div>

      {/* ── Results meta ── */}
      {!loading && search && filtered.length > 0 && (
        <Typography className={classes.resultsMeta}>
          {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} para &ldquo;{search}&rdquo;
        </Typography>
      )}

      {/* ── Grid ── */}
      {loading ? (
        <div className={classes.grid}>{renderSkeletons()}</div>
      ) : filtered.length === 0 ? (
        renderEmpty()
      ) : (
        <div className={classes.grid}>{renderCards()}</div>
      )}

      {/* ── Video Modal ── */}
      <Modal
        open={Boolean(selectedVideo)}
        onClose={closeVideoModal}
        closeAfterTransition
        BackdropComponent={Backdrop}
        BackdropProps={{ className: classes.modalBackdrop, timeout: 200 }}
      >
        <Fade in={Boolean(selectedVideo)}>
          <div className={classes.modalWrap} onClick={closeVideoModal}>
            <div
              className={classes.modalBox}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={classes.modalHeader}>
                <Typography className={classes.modalTitle} noWrap>
                  {selectedTitle || "Vídeo de ajuda"}
                </Typography>
                <div
                  className={classes.modalClose}
                  role="button"
                  tabIndex={0}
                  onClick={closeVideoModal}
                  onKeyDown={(e) => e.key === "Enter" && closeVideoModal()}
                  aria-label="fechar"
                >
                  <CloseIcon />
                </div>
              </div>
              <div className={classes.modalVideo}>
                {selectedVideo && (
                  <iframe
                    style={{
                      display: "block",
                      width: "100%",
                      height: "100%",
                      border: "none",
                    }}
                    src={`https://www.youtube.com/embed/${selectedVideo}?autoplay=1&rel=0`}
                    title={selectedTitle || "YouTube video player"}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
              </div>
            </div>
          </div>
        </Fade>
      </Modal>
    </div>
  );
};

export default Helps;
