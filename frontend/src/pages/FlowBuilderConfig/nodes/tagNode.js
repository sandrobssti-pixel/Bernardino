import {
  ArrowForwardIos,
  ContentCopy,
  Delete,
  LocalOffer
} from "@mui/icons-material";
import React, { memo } from "react";
import { useNodeStorage } from "../../../stores/useNodeStorage";
import { Handle } from "react-flow-renderer";
import { useTheme } from "@material-ui/core/styles";

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();
  const tagName = data?.name || data?.data?.name || "Tag";
  const tagColor = data?.color || data?.data?.color || "#0ea5e9";
  const theme = useTheme();
  const dark = theme.palette.type === "dark";

  const palette = {
    cardBg: dark ? "#1e293b" : "#ffffff",
    title: dark ? "#f1f5f9" : "#0f172a",
    boxText: dark ? "rgba(226, 232, 240, 0.75)" : "rgba(15, 23, 42, 0.75)",
    boxBorder: dark ? "rgba(148, 163, 184, 0.16)" : "rgba(15, 23, 42, 0.08)",
    boxBg: dark ? "rgba(15, 23, 42, 0.55)" : "rgba(248, 250, 252, 0.9)",
    dotBorder: dark ? "rgba(148, 163, 184, 0.3)" : "rgba(15, 23, 42, 0.18)"
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
        width: 220,
        transition: "all .2s ease"
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
          <LocalOffer sx={{ width: 16, height: 16, color: "#0ea5e9" }} />
        </div>

        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: palette.title,
            letterSpacing: "-0.01em"
          }}
        >
          Tag
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
          textAlign: "center",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            backgroundColor: tagColor,
            border: `1px solid ${palette.dotBorder}`,
            display: "inline-block"
          }}
        />
        <span
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 150
          }}
        >
          {tagName}
        </span>
      </div>

      <Handle
        type="source"
        position="right"
        id="a"
        style={{
          background: "#0ea5e9",
          width: 18,
          height: 18,
          top: "74%",
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
