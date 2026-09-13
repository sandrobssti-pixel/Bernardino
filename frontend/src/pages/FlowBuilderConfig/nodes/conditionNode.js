import {
  ArrowForwardIos,
  ContentCopy,
  Delete,
  ImportExport
} from "@mui/icons-material";
import React, { memo } from "react";
import { Handle } from "react-flow-renderer";
import { useNodeStorage } from "../../../stores/useNodeStorage";
import { useTheme } from "@material-ui/core/styles";

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();
  const theme = useTheme();
  const dark = theme.palette.type === "dark";

  const palette = {
    cardBg: dark ? "#1e293b" : "#ffffff",
    title: dark ? "#f1f5f9" : "#0f172a",
    bodyText: dark ? "rgba(226, 232, 240, 0.80)" : "rgba(15, 23, 42, 0.80)",
    boxBorder: dark ? "rgba(148, 163, 184, 0.16)" : "rgba(15, 23, 42, 0.08)",
    boxBg: dark ? "rgba(15, 23, 42, 0.55)" : "rgba(248, 250, 252, 0.9)",
    exitLabel: dark ? "rgba(148, 163, 184, 0.85)" : "rgba(71, 85, 105, 0.9)"
  };

  const typeCondition = (value) => {
    if (value === 1) return "==";
    if (value === 2) return ">=";
    if (value === 3) return "<=";
    if (value === 4) return "<";
    if (value === 5) return ">";
  };

  return (
    <div
      style={{
        background: palette.cardBg,
        padding: 12,
        borderRadius: 14,
        border: "1px solid rgba(99, 102, 241, 0.25)",
        boxShadow: "0 10px 28px rgba(16, 24, 40, 0.10)",
        width: 210,
        position: "relative",
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
          left: -12,
          top: 28,
          cursor: "pointer",
          border: "2px solid #ffffff",
          boxShadow: "0 10px 22px rgba(99, 102, 241, 0.22)"
        }}
        onConnect={(params) => console.log("handle onConnect", params)}
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
          sx={{
            width: 16,
            height: 16,
            color: "rgba(99, 102, 241, 0.95)"
          }}
        />

        <Delete
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("delete");
          }}
          sx={{
            width: 16,
            height: 16,
            color: "rgba(99, 102, 241, 0.95)"
          }}
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
            background: "rgba(99, 102, 241, 0.10)",
            border: "1px solid rgba(99, 102, 241, 0.25)"
          }}
        >
          <ImportExport sx={{ width: 16, height: 16, color: "#6366F1" }} />
        </div>

        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: palette.title,
            letterSpacing: "-0.01em"
          }}
        >
          Condição
        </div>
      </div>

      <div
        style={{
          fontSize: 12,
          color: palette.bodyText,
          display: "flex",
          flexDirection: "column",
          gap: 6
        }}
      >
        <div
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: `1px solid ${palette.boxBorder}`,
            background: palette.boxBg
          }}
        >
          {data.key}
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            width: "fit-content",
            border: "1px solid rgba(99, 102, 241, 0.25)",
            background: "rgba(99, 102, 241, 0.10)",
            fontWeight: 700,
            color: "#6366F1"
          }}
        >
          {typeCondition(data.condition)}
        </div>

        <div
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: `1px solid ${palette.boxBorder}`,
            background: palette.boxBg
          }}
        >
          {data.value}
        </div>
      </div>

      <Handle
        type="source"
        position="right"
        id="a"
        style={{
          top: 18,
          background: "#6366F1",
          width: 18,
          height: 18,
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

      <div
        style={{
          position: "absolute",
          right: -42,
          top: 21,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: palette.exitLabel,
          whiteSpace: "nowrap",
          pointerEvents: "none"
        }}
      >
        sim
      </div>

      <Handle
        type="source"
        position="right"
        id="b"
        style={{
          bottom: 18,
          top: "auto",
          background: "#6366F1",
          width: 18,
          height: 18,
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

      <div
        style={{
          position: "absolute",
          right: -42,
          bottom: 21,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: palette.exitLabel,
          whiteSpace: "nowrap",
          pointerEvents: "none"
        }}
      >
        não
      </div>
    </div>
  );
});
