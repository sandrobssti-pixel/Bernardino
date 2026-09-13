import {
  AccessTime,
  ArrowForwardIos,
  ContentCopy,
  Delete
} from "@mui/icons-material";
import React, { memo } from "react";
import { useTheme } from "@material-ui/core/styles";

import { Handle } from "react-flow-renderer";
import { useNodeStorage } from "../../../stores/useNodeStorage";

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();
  const theme = useTheme();
  const dark = theme.palette.type === "dark";

  const palette = {
    cardBg: dark ? "#1e293b" : "#ffffff",
    title: dark ? "#f1f5f9" : "#0f172a",
    boxText: dark ? "rgba(226, 232, 240, 0.75)" : "rgba(15, 23, 42, 0.75)",
    boxBorder: dark ? "rgba(148, 163, 184, 0.16)" : "rgba(15, 23, 42, 0.08)",
    boxBg: dark ? "rgba(15, 23, 42, 0.55)" : "rgba(248, 250, 252, 0.9)"
  };

  return (
    <div
      style={{
        background: palette.cardBg,
        padding: 12,
        borderRadius: 14,
        minWidth: 190,
        position: "relative",
        border: "1px solid rgba(251, 146, 60, 0.35)",
        boxShadow: "0 10px 28px rgba(16, 24, 40, 0.10)",
        transition: "all .2s ease"
      }}
    >
      <Handle
        type="target"
        position="left"
        style={{
          background: "#6366F1",
          width: 18,
          height: 18,
          top: 28,
          left: -12,
          cursor: "pointer",
          border: "2px solid #ffffff",
          boxShadow: "0 10px 22px rgba(99, 102, 241, 0.22)"
        }}
        onConnect={params => console.log("handle onConnect", params)}
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
          gap: 8,
          alignItems: "center"
        }}
      >
        <ContentCopy
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("duplicate");
          }}
          sx={{ width: 16, height: 16, color: "rgba(251, 146, 60, 0.95)" }}
        />

        <Delete
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("delete");
          }}
          sx={{ width: 16, height: 16, color: "rgba(251, 146, 60, 0.95)" }}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingRight: 44,
          marginBottom: 6
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
            background: "rgba(251, 146, 60, 0.12)",
            border: "1px solid rgba(251, 146, 60, 0.35)"
          }}
        >
          <AccessTime sx={{ width: 16, height: 16, color: "#fb923c" }} />
        </div>

        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: palette.title,
            letterSpacing: "-0.01em"
          }}
        >
          Intervalo
        </div>
      </div>

      <div
        style={{
          fontSize: 12,
          color: palette.boxText,
          padding: "8px 10px",
          borderRadius: 12,
          border: `1px solid ${palette.boxBorder}`,
          background: palette.boxBg,
          display: "inline-flex",
          alignItems: "center",
          gap: 6
        }}
      >
        <AccessTime sx={{ width: 14, height: 14 }} />
        {data.sec} segundos
      </div>

      <Handle
        type="source"
        position="right"
        id="a"
        style={{
          background: "#6366F1",
          width: 18,
          height: 18,
          top: "74%",
          right: -12,
          cursor: "pointer",
          border: "2px solid #ffffff",
          boxShadow: "0 10px 22px rgba(99, 102, 241, 0.22)"
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
