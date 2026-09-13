import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery
} from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import Pagination from "@material-ui/lab/Pagination";
import Autocomplete, { createFilterOptions } from "@material-ui/lab/Autocomplete";
import * as XLSX from "xlsx";
import {
  ExpandMore,
  FilterList,
  Forward,
  History,
  LocalOffer,
  SaveAlt,
  ViewModule as ViewKanban,
} from "@material-ui/icons";
import { blue, green } from "@material-ui/core/colors";
import moment from "moment";

import api from "../../services/api";
import useDashboard from "../../hooks/useDashboard";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ShowTicketLogModal from "../../components/ShowTicketLogModal";
import { UsersFilter } from "../../components/UsersFilter";
import { WhatsappsFilter } from "../../components/WhatsappsFilter";
import { StatusFilter } from "../../components/StatusFilter";
import QueueSelectCustom from "../../components/QueueSelectCustom";

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    width: "100%",
    minHeight: "calc(100vh - 110px)",
    padding: theme.spacing(2),
    gap: theme.spacing(1.25),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1)
    }
  },
  filtersAccordion: {
    borderRadius: "14px !important",
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.07)",
    overflow: "hidden",
    "&:before": {
      display: "none"
    }
  },
  filtersHeader: {
    minHeight: "58px !important",
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(15, 23, 42, 0.025)",
    "& .MuiAccordionSummary-content": {
      margin: "10px 0 !important"
    }
  },
  filtersTitle: {
    fontWeight: 700,
    fontSize: "0.92rem"
  },
  filtersBody: {
    padding: theme.spacing(2),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1.2)
    }
  },
  filtersGrid: {
    width: "100%",
    margin: 0
  },
  filterField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 10,
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.02)"
          : "rgba(248,250,252,0.9)"
    },
    "& .MuiInputBase-input": {
      fontSize: "0.83rem"
    },
    "& .MuiInputLabel-outlined": {
      fontSize: "0.82rem"
    }
  },
  externalFilterSlot: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 10,
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.02)"
          : "rgba(248,250,252,0.9)"
    },
    "& .MuiInputBase-input": {
      fontSize: "0.83rem"
    },
    "& .MuiInputLabel-outlined": {
      fontSize: "0.82rem"
    }
  },
  queueFieldWrap: {
    marginTop: 0,
    "& .MuiFormControl-root": {
      marginTop: "0 !important",
      marginBottom: "0 !important"
    }
  },
  dateRow: {
    display: "flex",
    gap: theme.spacing(1),
    [theme.breakpoints.down("xs")]: {
      flexDirection: "column"
    }
  },
  filterActions: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing(1),
    marginTop: theme.spacing(0.4),
    borderTop: `1px dashed ${theme.palette.divider}`,
    paddingTop: theme.spacing(1.2)
  },
  perPageControl: {
    minWidth: 180,
    marginLeft: "auto",
    "& .MuiOutlinedInput-root": {
      borderRadius: 10,
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.02)"
          : "rgba(248,250,252,0.9)"
    },
    "& .MuiInputBase-input": {
      fontSize: "0.83rem"
    },
    "& .MuiInputLabel-outlined": {
      fontSize: "0.82rem"
    },
    [theme.breakpoints.down("sm")]: {
      marginLeft: 0,
      width: "100%"
    }
  },
  tableWrap: {
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
    overflow: "hidden"
  },
  tableScroller: {
    overflowX: "auto",
    ...theme.scrollbarStylesSoft
  },
  tableHeadCell: {
    fontWeight: 700,
    fontSize: "0.75rem",
    whiteSpace: "nowrap",
    background: theme.palette.type === "light" ? "#f8fafc" : "#1f2937",
    padding: "6px 8px"
  },
  tableRow: {
    "&:nth-of-type(even)": {
      backgroundColor:
        theme.palette.type === "light" ? "#fcfdff" : "rgba(30,41,59,0.3)"
    }
  },
  compactText: {
    fontSize: "0.75rem",
    color: theme.palette.text.primary,
    maxWidth: 210,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    padding: "6px 8px !important",
    lineHeight: 1.25
  },
  chipsInline: {
    display: "flex",
    flexWrap: "wrap",
    gap: 3,
    minWidth: 130
  },
  actionIcons: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    whiteSpace: "nowrap"
  },
  paginationWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1)
  },
  mobileList: {
    display: "grid",
    gap: theme.spacing(1)
  },
  mobileCard: {
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`
  },
  mobileRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.5)
  },
  mobileLabel: {
    fontSize: "0.72rem",
    color: theme.palette.text.secondary
  },
  mobileValue: {
    fontSize: "0.82rem",
    fontWeight: 600,
    color: theme.palette.text.primary,
    textAlign: "right"
  }
}));

const filter = createFilterOptions({ trim: true });

const splitCommaList = (value) =>
  String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

const Reports = () => {
  const classes = useStyles();
  const history = useHistory();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { getReport } = useDashboard();

  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [searchParam, setSearchParam] = useState("");
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [selectedWhatsapp, setSelectedWhatsapp] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedKanbanTags, setSelectedKanbanTags] = useState([]);
  const [includeGroups, setIncludeGroups] = useState(true);
  const [queueIds, setQueueIds] = useState([]);
  const [userIds, setUserIds] = useState([]);
  const [options, setOptions] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);
  const [kanbanTagOptions, setKanbanTagOptions] = useState([]);

  const [dateFrom, setDateFrom] = useState(moment("1", "D").format("YYYY-MM-DD"));
  const [dateTo, setDateTo] = useState(moment().format("YYYY-MM-DD"));
  const [onlyRated, setOnlyRated] = useState(false);
  const [totalTickets, setTotalTickets] = useState(0);
  const [tickets, setTickets] = useState([]);

  const [openTicketMessageDialog, setOpenTicketMessageDialog] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(null);
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [tagsResp, kanbanResp] = await Promise.all([
          api.get("/tags/list", { params: { kanban: 0 } }),
          api.get("/tags/list", { params: { kanban: 1 } })
        ]);

        setTagOptions(Array.isArray(tagsResp.data) ? tagsResp.data : []);
        setKanbanTagOptions(Array.isArray(kanbanResp.data) ? kanbanResp.data : []);
      } catch (err) {
        toastError(err);
      }
    };

    loadFilterOptions();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        if (!searchParam || searchParam.length < 2) {
          setOptions([]);
          return;
        }

        setLoadingContacts(true);
        try {
          const { data } = await api.get("contacts", {
            params: { searchParam }
          });
          setOptions(data.contacts || []);
        } catch (err) {
          toastError(err);
        } finally {
          setLoadingContacts(false);
        }
      };

      fetchContacts();
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [searchParam]);

  const buildReportParams = (targetPage) => {
    return {
      searchParam,
      contactId: selectedContactId,
      whatsappId: JSON.stringify(selectedWhatsapp),
      users: JSON.stringify(userIds),
      queueIds: JSON.stringify(queueIds),
      status: JSON.stringify(selectedStatus),
      tags: JSON.stringify(selectedTags),
      kanbanTags: JSON.stringify(selectedKanbanTags),
      dateFrom,
      dateTo,
      page: targetPage,
      pageSize,
      onlyRated: onlyRated ? "true" : "false",
      includeGroups: includeGroups ? "true" : "false"
    };
  };

  const handleFilter = async (targetPage = 1) => {
    setLoadingReport(true);

    try {
      const data = await getReport(buildReportParams(targetPage));
      setTotalTickets(Number(data?.totalTickets?.total || 0));
      setTickets(Array.isArray(data?.tickets) ? data.tickets : []);
      setPageNumber(targetPage);
    } catch (error) {
      toastError(error);
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    handleFilter(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  useEffect(() => {
    handleFilter(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportarGridParaExcel = async () => {
    setLoadingReport(true);

    try {
      const data = await getReport({
        ...buildReportParams(1),
        pageSize: 9999999
      });

      const ticketsData = (data.tickets || []).map(ticket => ({
        id: ticket.id,
        Conexao: ticket.whatsappName,
        Contato: ticket.contactName,
        Telefone: ticket.contactNumber || "",
        Usuario: ticket.userName,
        Fila: ticket.queueName,
        Status: ticket.status,
        UltimaMensagem: ticket.lastMessage,
        DataAbertura: ticket.createdAt,
        DataFechamento: ticket.closedAt,
        TempoDeAtendimento: ticket.supportTime,
        Tags: ticket.tags || "",
        Kanban: ticket.kanban || ""
      }));

      const ws = XLSX.utils.json_to_sheet(ticketsData);
      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(wb, ws, "RelatorioDeAtendimentos");
      XLSX.writeFile(wb, "relatorio-de-atendimentos.xlsx");
    } catch (error) {
      toastError(error);
    } finally {
      setLoadingReport(false);
    }
  };

  const handleSelectedUsers = (selecteds) => {
    setUserIds(selecteds.map(item => item.id));
  };

  const handleSelectedWhatsapps = (selecteds) => {
    setSelectedWhatsapp(selecteds.map(item => item.id));
  };

  const handleSelectedStatus = (selecteds) => {
    setSelectedStatus(selecteds.map(item => item.status));
  };

  const handleClearFilters = () => {
    setSelectedContactId(null);
    setSearchParam("");
    setSelectedWhatsapp([]);
    setSelectedStatus([]);
    setSelectedTags([]);
    setSelectedKanbanTags([]);
    setIncludeGroups(true);
    setQueueIds([]);
    setUserIds([]);
    setDateFrom(moment("1", "D").format("YYYY-MM-DD"));
    setDateTo(moment().format("YYYY-MM-DD"));
    setOnlyRated(false);
    setPageNumber(1);
    setOptions([]);

    setTimeout(() => {
      handleFilter(1);
    }, 0);
  };

  const renderContactOption = (option) => {
    if (option.number) {
      return `${option.name} - ${option.number}`;
    }
    return option.name || "";
  };

  const createAddContactOption = (filterOptions, params) => {
    const filtered = filter(filterOptions, params);

    if (params.inputValue !== "" && !loadingContacts && searchParam.length >= 3) {
      filtered.push({ name: `${params.inputValue}` });
    }

    return filtered;
  };

  const totalPages = Math.max(1, Math.ceil((Number(totalTickets) || 0) / pageSize));

  return (
    <div className={classes.pageRoot}>
      {openTicketMessageDialog && ticketOpen && (
        <ShowTicketLogModal
          isOpen={openTicketMessageDialog}
          handleClose={() => setOpenTicketMessageDialog(false)}
          ticketId={ticketOpen.id}
        />
      )}

      <Accordion
        expanded={filtersExpanded}
        onChange={() => setFiltersExpanded(prev => !prev)}
        className={classes.filtersAccordion}
      >
        <AccordionSummary expandIcon={<ExpandMore />} className={classes.filtersHeader}>
          <Grid container alignItems="center" spacing={1}>
            <Grid item>
              <FilterList color="primary" />
            </Grid>
            <Grid item>
              <Typography className={classes.filtersTitle}>Filtros de Relatório</Typography>
            </Grid>
          </Grid>
        </AccordionSummary>

        <AccordionDetails className={classes.filtersBody}>
          <Grid container spacing={2} className={classes.filtersGrid}>
            <Grid item xs={12} md={3}>
              <Autocomplete
                className={classes.filterField}
                fullWidth
                options={options}
                loading={loadingContacts}
                clearOnBlur
                autoHighlight
                freeSolo
                size="small"
                clearOnEscape
                value={options.find(item => item.id === selectedContactId) || null}
                getOptionLabel={renderContactOption}
                filterOptions={createAddContactOption}
                onChange={(e, newValue) => {
                  setSelectedContactId(newValue?.id || null);
                  setSearchParam("");
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={i18n.t("newTicketModal.fieldLabel")}
                    variant="outlined"
                    onChange={e => setSearchParam(e.target.value)}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loadingContacts ? <CircularProgress color="inherit" size={18} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      )
                    }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <WhatsappsFilter
                onFiltered={handleSelectedWhatsapps}
                className={classes.externalFilterSlot}
                containerStyle={{ padding: 0 }}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <StatusFilter
                onFiltered={handleSelectedStatus}
                className={classes.externalFilterSlot}
                containerStyle={{ padding: 0 }}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <UsersFilter
                onFiltered={handleSelectedUsers}
                className={classes.externalFilterSlot}
                containerStyle={{ padding: 0 }}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <QueueSelectCustom
                selectedQueueIds={queueIds}
                onChange={values => setQueueIds(values)}
                containerStyle={{ marginTop: 0 }}
                formControlClassName={`${classes.externalFilterSlot} ${classes.queueFieldWrap}`}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <Autocomplete
                className={classes.filterField}
                multiple
                size="small"
                options={tagOptions}
                value={tagOptions.filter(tag => selectedTags.includes(tag.id))}
                getOptionLabel={(option) => option.name}
                onChange={(e, value) => setSelectedTags(value.map(item => item.id))}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      size="small"
                      label={option.name}
                      style={{
                        backgroundColor: option.color || "#e2e8f0",
                        color: "#fff",
                        textShadow: "0 1px 2px rgba(0,0,0,0.35)"
                      }}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField {...params} label="Tags" variant="outlined" placeholder="Filtrar por tags" />
                )}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <Autocomplete
                className={classes.filterField}
                multiple
                size="small"
                options={kanbanTagOptions}
                value={kanbanTagOptions.filter(tag => selectedKanbanTags.includes(tag.id))}
                getOptionLabel={(option) => option.name}
                onChange={(e, value) => setSelectedKanbanTags(value.map(item => item.id))}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      size="small"
                      icon={<ViewKanban style={{ color: "#fff" }} />}
                      label={option.name}
                      style={{
                        backgroundColor: option.color || "#334155",
                        color: "#fff"
                      }}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Kanban"
                    variant="outlined"
                    placeholder="Etapas Kanban"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <div className={classes.dateRow}>
                <TextField
                  className={classes.filterField}
                  label="Data Inicial"
                  type="date"
                  value={dateFrom}
                  variant="outlined"
                  fullWidth
                  size="small"
                  onChange={(e) => setDateFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  className={classes.filterField}
                  label="Data Final"
                  type="date"
                  value={dateTo}
                  variant="outlined"
                  fullWidth
                  size="small"
                  onChange={(e) => setDateTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </div>
            </Grid>

            <Grid item xs={12}>
              <div className={classes.filterActions}>
                <FormControlLabel
                  control={
                    <Switch
                      color="primary"
                      checked={onlyRated}
                      onChange={() => setOnlyRated(prev => !prev)}
                    />
                  }
                  label={i18n.t("reports.buttons.onlyRated")}
                />

                <FormControlLabel
                  control={
                    <Switch
                      color="primary"
                      checked={includeGroups}
                      onChange={() => setIncludeGroups(prev => !prev)}
                    />
                  }
                  label="Incluir grupos"
                />

                <Tooltip title="Exportar para Excel">
                  <span>
                    <IconButton
                      onClick={exportarGridParaExcel}
                      aria-label="Exportar para Excel"
                      disabled={loadingReport}
                    >
                      <SaveAlt />
                    </IconButton>
                  </span>
                </Tooltip>

                <Button
                  variant="outlined"
                  onClick={handleClearFilters}
                  style={{ textTransform: "none", borderRadius: 10 }}
                >
                  Limpar filtros
                </Button>

                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => handleFilter(1)}
                  style={{ textTransform: "none", borderRadius: 10, fontWeight: 700 }}
                  disabled={loadingReport}
                >
                  {loadingReport ? "Filtrando..." : i18n.t("reports.buttons.filter")}
                </Button>

                <FormControl margin="dense" variant="outlined" className={classes.perPageControl}>
                  <InputLabel>{i18n.t("tickets.search.ticketsPerPage")}</InputLabel>
                  <Select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    label={i18n.t("tickets.search.ticketsPerPage")}
                  >
                    <MenuItem value={20}>20</MenuItem>
                    <MenuItem value={50}>50</MenuItem>
                    <MenuItem value={100}>100</MenuItem>
                  </Select>
                </FormControl>
              </div>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Paper className={classes.tableWrap}>
        <div className={classes.tableScroller}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell align="center" className={classes.tableHeadCell}>ID</TableCell>
                <TableCell align="left" className={classes.tableHeadCell}>{i18n.t("reports.table.whatsapp")}</TableCell>
                <TableCell align="left" className={classes.tableHeadCell}>{i18n.t("reports.table.contact")}</TableCell>
                <TableCell align="left" className={classes.tableHeadCell}>{i18n.t("reports.table.user")}</TableCell>
                <TableCell align="left" className={classes.tableHeadCell}>{i18n.t("reports.table.queue")}</TableCell>
                <TableCell align="center" className={classes.tableHeadCell}>{i18n.t("reports.table.status")}</TableCell>
                <TableCell align="left" className={classes.tableHeadCell}>{i18n.t("reports.table.lastMessage")}</TableCell>
                <TableCell align="center" className={classes.tableHeadCell}>{i18n.t("reports.table.dateOpen")}</TableCell>
                <TableCell align="center" className={classes.tableHeadCell}>{i18n.t("reports.table.dateClose")}</TableCell>
                <TableCell align="center" className={classes.tableHeadCell}>{i18n.t("reports.table.supportTime")}</TableCell>
                <TableCell align="left" className={classes.tableHeadCell}>Tags</TableCell>
                <TableCell align="left" className={classes.tableHeadCell}>Kanban</TableCell>
                <TableCell align="center" className={classes.tableHeadCell}>{i18n.t("reports.table.actions")}</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {tickets.map(ticket => (
                <TableRow key={ticket.id} className={classes.tableRow}>
                  <TableCell align="center" className={classes.compactText}>{ticket.id}</TableCell>
                  <TableCell align="left" className={classes.compactText}>{ticket.whatsappName || "-"}</TableCell>
                  <TableCell align="left" className={classes.compactText}>{ticket.contactName || "-"}</TableCell>
                  <TableCell align="left" className={classes.compactText}>{ticket.userName || "-"}</TableCell>
                  <TableCell align="left" className={classes.compactText}>{ticket.queueName || "-"}</TableCell>
                  <TableCell align="center" className={classes.compactText}>{ticket.status || "-"}</TableCell>
                  <TableCell align="left" className={classes.compactText}>{ticket.lastMessage || "-"}</TableCell>
                  <TableCell align="center" className={classes.compactText}>{ticket.createdAt || "-"}</TableCell>
                  <TableCell align="center" className={classes.compactText}>{ticket.closedAt || "-"}</TableCell>
                  <TableCell align="center" className={classes.compactText}>{ticket.supportTime || "0"}</TableCell>
                  <TableCell align="left">
                    <div className={classes.chipsInline}>
                      {splitCommaList(ticket.tags).length > 0 ? (
                        splitCommaList(ticket.tags).map(name => (
                          <Chip key={`${ticket.id}-tag-${name}`} size="small" icon={<LocalOffer />} label={name} />
                        ))
                      ) : (
                        <Typography variant="caption" color="textSecondary">-</Typography>
                      )}
                    </div>
                  </TableCell>

                  <TableCell align="left">
                    <div className={classes.chipsInline}>
                      {splitCommaList(ticket.kanban).length > 0 ? (
                        splitCommaList(ticket.kanban).map(name => (
                          <Chip
                            key={`${ticket.id}-kanban-${name}`}
                            size="small"
                            icon={<ViewKanban />}
                            label={name}
                            style={{ background: "#e6f0ff" }}
                          />
                        ))
                      ) : (
                        <Typography variant="caption" color="textSecondary">-</Typography>
                      )}
                    </div>
                  </TableCell>

                  <TableCell align="center">
                    <div className={classes.actionIcons}>
                      <Tooltip title="Logs do Ticket">
                        <History
                          onClick={() => {
                            setOpenTicketMessageDialog(true);
                            setTicketOpen(ticket);
                          }}
                          fontSize="small"
                          style={{ color: blue[700], cursor: "pointer" }}
                        />
                      </Tooltip>
                      <Tooltip title="Acessar Ticket">
                        <Forward
                          onClick={() => {
                            history.push(`/tickets/${ticket.uuid}`);
                          }}
                          fontSize="small"
                          style={{ color: green[700], cursor: "pointer" }}
                        />
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {loadingReport && <TableRowSkeleton avatar columns={3} />}
            </TableBody>
          </Table>
        </div>
      </Paper>

      <div className={classes.paginationWrap}>
        <Pagination
          count={totalPages}
          page={pageNumber}
          onChange={(event, value) => handleFilter(value)}
          color="primary"
          size={isMobile ? "small" : "medium"}
        />
      </div>
    </div>
  );
};

export default Reports;
