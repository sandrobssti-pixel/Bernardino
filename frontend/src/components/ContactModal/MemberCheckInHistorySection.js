import React, { useState, useEffect, useRef, useCallback } from "react";

import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import RoomIcon from "@material-ui/icons/Room";
import Chip from "@material-ui/core/Chip";

import useMembers from "../../hooks/useMembers";
import toastError from "../../errors/toastError";

const VALIDATION_LABELS = {
  pending: "Pendente",
  valid: "Válida",
  invalid: "Rejeitada",
};

const VALIDATION_COLORS = {
  pending: "default",
  valid: "primary",
  invalid: "secondary",
};

// Histórico de presenças/check-ins deste associado (Controle de
// Acesso) — mesmos registros do kiosk (pages/MemberCheckIn) e do
// Portal do Associado, filtrados por memberId. Ver
// docs/MANUAL_TECNICO.md.
const MemberCheckInHistorySection = ({ memberId }) => {
  const members = useMembers();
  const isMounted = useRef(true);
  const [loading, setLoading] = useState(true);
  const [checkIns, setCheckIns] = useState([]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchCheckIns = useCallback(async () => {
    setLoading(true);
    try {
      const data = await members.listCheckIns({ memberId, pageNumber: 1 });
      if (isMounted.current) setCheckIns(data.records || []);
    } catch (err) {
      toastError(err);
    }
    if (isMounted.current) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  useEffect(() => {
    if (memberId) fetchCheckIns();
  }, [memberId, fetchCheckIns]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle2" style={{ fontWeight: 700, marginBottom: 8 }}>
        Histórico de presenças
      </Typography>
      {checkIns.length === 0 ? (
        <Typography variant="body2" color="textSecondary">
          Nenhum check-in registrado ainda.
        </Typography>
      ) : (
        <List dense>
          {checkIns.map((checkIn) => (
            <ListItem key={checkIn.id} divider>
              <ListItemIcon>
                <CheckCircleIcon fontSize="small" style={{ color: "#2e7d32" }} />
              </ListItemIcon>
              <ListItemText
                primary={new Date(checkIn.checkedInAt).toLocaleString("pt-BR")}
                secondary={
                  checkIn.source === "portal"
                    ? `Pelo Portal do Associado${checkIn.logbookPhotoUrl ? " — com foto do livro" : ""}`
                    : "Kiosk (Controle de Acesso)"
                }
              />
              {checkIn.logbookPhotoUrl && (
                <Chip
                  size="small"
                  icon={<RoomIcon fontSize="small" />}
                  label={VALIDATION_LABELS[checkIn.validationStatus] || checkIn.validationStatus}
                  color={VALIDATION_COLORS[checkIn.validationStatus] || "default"}
                />
              )}
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default MemberCheckInHistorySection;
