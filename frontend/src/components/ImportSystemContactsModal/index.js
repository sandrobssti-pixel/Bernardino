import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  TextField,
  Typography
} from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import InputAdornment from "@material-ui/core/InputAdornment";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const ImportSystemContactsModal = ({ open, onClose, contactList }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [contacts, setContacts] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    const loadContacts = async () => {
      if (!open) return;
      setLoading(true);
      try {
        let pageNumber = 1;
        let hasMore = true;
        const merged = [];

        while (hasMore) {
          const { data } = await api.get("/contacts", {
            params: { pageNumber, searchParam: "", isGroup: "false" }
          });
          const current = Array.isArray(data?.contacts) ? data.contacts : [];
          merged.push(...current);
          hasMore = !!data?.hasMore;
          pageNumber += 1;
        }

        setContacts(merged);
        setSelectedIds(new Set(merged.map(c => c.id)));
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    };

    loadContacts();
  }, [open]);

  const filteredContacts = useMemo(() => {
    const term = String(searchParam || "").toLowerCase().trim();
    if (!term) return contacts;
    return contacts.filter(contact => {
      const name = String(contact?.name || "").toLowerCase();
      const number = String(contact?.number || "").toLowerCase();
      return name.includes(term) || number.includes(term);
    });
  }, [contacts, searchParam]);

  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = (checked) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      filteredContacts.forEach(contact => {
        if (checked) {
          next.add(contact.id);
        } else {
          next.delete(contact.id);
        }
      });
      return next;
    });
  };

  const allFilteredSelected =
    filteredContacts.length > 0 &&
    filteredContacts.every(contact => selectedIds.has(contact.id));

  const handleImport = async () => {
    if (!contactList?.id) return;
    setSaving(true);
    try {
      const selectedArray = Array.from(selectedIds);
      const { data } = await api.post(
        `/contact-lists/${contactList.id}/import-system-contacts`,
        { contactIds: selectedArray }
      );
      toast.success(
        i18n.t("contactLists.importSystem.toasts.success", {
          imported: data?.imported || 0,
          duplicates: data?.duplicates || 0,
          invalid: data?.invalid || 0
        })
      );
      onClose(true);
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose(false)} fullWidth maxWidth="md">
      <DialogTitle>
        {i18n.t("contactLists.importSystem.title", {
          name: contactList?.name || ""
        })}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              value={searchParam}
              onChange={(e) => setSearchParam(e.target.value)}
              placeholder={i18n.t("contactLists.importSystem.searchPlaceholder")}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon style={{ color: "gray" }} />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  color="primary"
                  checked={allFilteredSelected}
                  onChange={(e) => toggleSelectAllFiltered(e.target.checked)}
                />
              }
              label={i18n.t("contactLists.importSystem.selectAllFiltered")}
            />
            <Typography variant="body2" color="textSecondary">
              {i18n.t("contactLists.importSystem.selectedCount", {
                selected: selectedIds.size,
                total: contacts.length
              })}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid #e0e0e0", borderRadius: 8, padding: 8 }}>
              {loading && (
                <Typography variant="body2" color="textSecondary">
                  {i18n.t("contactLists.importSystem.loading")}
                </Typography>
              )}
              {!loading && filteredContacts.length === 0 && (
                <Typography variant="body2" color="textSecondary">
                  {i18n.t("contactLists.importSystem.empty")}
                </Typography>
              )}
              {!loading && (
                <Grid container spacing={1}>
                  {filteredContacts.map(contact => (
                    <Grid item xs={12} sm={6} key={contact.id}>
                      <div
                        style={{
                          border: "1px solid #e8e8e8",
                          borderRadius: 8,
                          padding: "2px 8px"
                        }}
                      >
                        <FormControlLabel
                          control={
                            <Checkbox
                              color="primary"
                              checked={selectedIds.has(contact.id)}
                              onChange={() => toggleSelection(contact.id)}
                            />
                          }
                          label={`${contact.name || "-"} (${contact.number || "-"})`}
                        />
                      </div>
                    </Grid>
                  ))}
                </Grid>
              )}
            </div>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)} disabled={saving}>
          {i18n.t("contactLists.dialog.cancel")}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleImport}
          disabled={saving || loading}
        >
          {i18n.t("contactLists.importSystem.importButton")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportSystemContactsModal;
