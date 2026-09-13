import {
  ArrowForwardIos,
  ContentCopy,
  Delete
} from "@mui/icons-material";
import HttpIcon from "@mui/icons-material/Http";
import React, { memo } from "react";
import { useNodeStorage } from "../../../stores/useNodeStorage";
import { Handle } from "react-flow-renderer";
import { useTheme } from "@material-ui/core/styles";

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();
  const method = String(data?.method || "GET").toUpperCase();
  const mappedVars = Array.isArray(data?.responseVariables)
    ? data.responseVariables.length
    : 0;
  const theme = useTheme();
  const dark = theme.palette.type === "dark";

  const palette = {
    cardBg: dark ? "#1e293b" : "#ffffff",
    title: dark ? "#f1f5f9" : "#0f172a",
    methodText: dark ? "rgba(226, 232, 240, 0.8)" : "rgba(15, 23, 42, 0.8)",
    boxBorder: dark ? "rgba(148, 163, 184, 0.16)" : "rgba(15, 23, 42, 0.08)",
    boxBg: dark ? "rgba(15, 23, 42, 0.55)" : "rgba(248, 250, 252, 0.9)",
    infoText: dark ? "rgba(226, 232, 240, 0.72)" : "rgba(15, 23, 42, 0.72)"
  };

  return (
    <div
      style={{
        background: palette.cardBg,
        padding: 12,
        borderRadius: 14,
        position: "relative",
        border: "1px solid rgba(14, 165, 233, 0.25)",
        boxShadow: "0 10px 28px rgba(16, 24, 40, 0.10)",
        width: 230
      }}
    >
      <Handle
        type="target"
        position="left"
        style={{
          background: "#0ea5e9",
          width: 18,
          height: 18,
          top: 28,
          left: -12,
          cursor: "pointer",
          border: "2px solid #ffffff",
          boxShadow: "0 10px 22px rgba(14, 165, 233, 0.25)"
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
          sx={{ width: 16, height: 16, color: "#0ea5e9" }}
        />
        <Delete
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("delete");
          }}
          sx={{ width: 16, height: 16, color: "#0ea5e9" }}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          paddingRight: 44
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(14, 165, 233, 0.12)",
            border: "1px solid rgba(14, 165, 233, 0.35)"
          }}
        >
          <HttpIcon sx={{ width: 16, height: 16, color: "#0ea5e9" }} />
        </div>

        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: palette.title,
            letterSpacing: "-0.01em"
          }}
        >
          HTTP Request
        </div>
      </div>

      <div
        style={{
          fontSize: 12,
          color: palette.methodText,
          padding: "8px 10px",
          borderRadius: 12,
          border: `1px solid ${palette.boxBorder}`,
          background: palette.boxBg,
          textAlign: "center",
          fontWeight: 600,
          marginBottom: 8
        }}
      >
        {method}
      </div>

      <div
        style={{
          fontSize: 11,
          color: palette.infoText,
          lineHeight: "15px"
        }}
      >
        <div
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginBottom: 6
          }}
        >
          {data?.url || "Sem URL configurada"}
        </div>
        <div>{mappedVars} variavel(is) mapeada(s)</div>
      </div>

      <Handle
        type="source"
        position="right"
        id="a"
        style={{
          background: "#0ea5e9",
          width: 18,
          height: 18,
          top: "80%",
          right: -12,
          cursor: "pointer",
          border: "2px solid #ffffff",
          boxShadow: "0 10px 22px rgba(14, 165, 233, 0.25)"
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
    </div>
  );
});
