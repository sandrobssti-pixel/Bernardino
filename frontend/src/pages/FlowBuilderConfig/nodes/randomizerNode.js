import {
  ArrowForwardIos,
  CallSplit,
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
    percentText: dark ? "rgba(226, 232, 240, 0.80)" : "rgba(15, 23, 42, 0.80)"
  };

  return (
    <div
      style={{
        background: palette.cardBg,
        padding: 12,
        borderRadius: 14,
        width: 210,
        position: "relative",
        border: "1px solid rgba(31, 186, 220, 0.30)",
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
          gap: 8
        }}
      >
        <ContentCopy
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("duplicate");
          }}
          sx={{ width: 16, height: 16, color: "#22b3cf" }}
        />

        <Delete
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("delete");
          }}
          sx={{ width: 16, height: 16, color: "#22b3cf" }}
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
            background: "rgba(31, 186, 220, 0.12)",
            border: "1px solid rgba(31, 186, 220, 0.35)"
          }}
        >
          <CallSplit sx={{ width: 16, height: 16, color: "#1FBADC" }} />
        </div>

        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: palette.title,
            letterSpacing: "-0.01em"
          }}
        >
          Randomizador
        </div>
      </div>

      {/* Primeira saída */}
      <div
        style={{
          position: "relative",
          paddingRight: 18,
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: palette.percentText,
            fontWeight: 600
          }}
        >
          {data.percent}%
        </div>

        <Handle
          type="source"
          position="right"
          id="a"
          style={{
            top: "50%",
            transform: "translateY(-50%)",
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
      </div>

      {/* Segunda saída */}
      <div
        style={{
          position: "relative",
          paddingRight: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: palette.percentText,
            fontWeight: 600
          }}
        >
          {100 - data.percent}%
        </div>

        <Handle
          type="source"
          position="right"
          id="b"
          style={{
            top: "50%",
            transform: "translateY(-50%)",
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
      </div>
    </div>
  );
});
