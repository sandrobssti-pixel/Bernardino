import {
  ArrowForwardIos,
  ContentCopy,
  Delete
} from "@mui/icons-material";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import React, { memo } from "react";
import { Handle } from "react-flow-renderer";
import { useNodeStorage } from "../../../stores/useNodeStorage";
import { useTheme } from "@material-ui/core/styles";

const outputHandles = [
  { id: "success", label: "Sucesso" },
  { id: "customer_not_found", label: "Cliente não encontrado" },
  { id: "no_open_billing", label: "Sem cobrança" },
  { id: "invalid_document", label: "Documento inválido" },
  { id: "integration_error", label: "Erro na integração" }
];

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();
  const theme = useTheme();
  const dark = theme.palette.type === "dark";

  const palette = {
    cardBg: dark ? "#1e293b" : "#ffffff",
    title: dark ? "#f1f5f9" : "#0f172a",
    subtitle: dark ? "rgba(226, 232, 240, 0.65)" : "rgba(15, 23, 42, 0.65)",
    infoText: dark ? "rgba(226, 232, 240, 0.8)" : "rgba(15, 23, 42, 0.8)",
    infoBorder: dark ? "rgba(148, 163, 184, 0.16)" : "rgba(15, 23, 42, 0.08)",
    infoBg: dark ? "rgba(15, 23, 42, 0.55)" : "rgba(248, 250, 252, 0.9)",
    handleLabelBorder: dark ? "rgba(148, 163, 184, 0.16)" : "rgba(15, 23, 42, 0.08)",
    handleLabelBg: dark ? "rgba(15, 23, 42, 0.55)" : "#ffffff",
    handleLabelText: dark ? "rgba(226, 232, 240, 0.8)" : "rgba(15, 23, 42, 0.78)"
  };

  return (
    <div
      style={{
        background: palette.cardBg,
        padding: 12,
        borderRadius: 14,
        position: "relative",
        border: "1px solid rgba(249, 115, 22, 0.22)",
        boxShadow: "0 10px 28px rgba(16, 24, 40, 0.10)",
        width: 250
      }}
    >
      <Handle
        type="target"
        position="left"
        style={{
          background: "#ea580c",
          width: 18,
          height: 18,
          top: 28,
          left: -12,
          cursor: "pointer",
          border: "2px solid #ffffff"
        }}
        isConnectable={isConnectable}
      >
        <ArrowForwardIos
          sx={{
            color: "#ffffff",
            width: 10,
            height: 10,
            marginLeft: "3px",
            marginBottom: "1px",
            pointerEvents: "none"
          }}
        />
      </Handle>

      <div
        style={{
          display: "flex",
          position: "absolute",
          right: 8,
          top: 8,
          cursor: "pointer",
          gap: 8
        }}
      >
        <ContentCopy
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("duplicate");
          }}
          sx={{ width: 16, height: 16, color: "#ea580c" }}
        />
        <Delete
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("delete");
          }}
          sx={{ width: 16, height: 16, color: "#ea580c" }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(249, 115, 22, 0.12)",
            border: "1px solid rgba(249, 115, 22, 0.30)"
          }}
        >
          <ReceiptLongIcon sx={{ width: 16, height: 16, color: "#ea580c" }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: palette.title }}>
            2a via Boleto
          </div>
          <div style={{ fontSize: 11, color: palette.subtitle }}>
            {data?.integration?.name || "Integração não selecionada"}
          </div>
        </div>
      </div>

      <div
        style={{
          fontSize: 12,
          color: palette.infoText,
          padding: "8px 10px",
          borderRadius: 12,
          border: `1px solid ${palette.infoBorder}`,
          background: palette.infoBg,
          marginBottom: 10
        }}
      >
        <div>Provider: {String(data?.integration?.provider || "").toUpperCase() || "-"}</div>
        <div>Identificação: {data?.identifierType || "-"}</div>
      </div>

      {outputHandles.map((handle, index) => (
        <div
          key={handle.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginTop: index === 0 ? 0 : 8,
            position: "relative"
          }}
        >
          <div
            style={{
              fontSize: 11,
              padding: "7px 10px",
              borderRadius: 12,
              border: `1px solid ${palette.handleLabelBorder}`,
              background: palette.handleLabelBg,
              color: palette.handleLabelText,
              width: "100%"
            }}
          >
            {handle.label}
          </div>
          <Handle
            type="source"
            position="right"
            id={handle.id}
            style={{
              background: "#ea580c",
              width: 16,
              height: 16,
              right: -10,
              top: "50%",
              transform: "translateY(-50%)",
              cursor: "pointer",
              border: "2px solid #ffffff"
            }}
            isConnectable={isConnectable}
          />
        </div>
      ))}
    </div>
  );
});
