import { ArrowForwardIos, RocketLaunch } from "@mui/icons-material";
import React, { memo } from "react";
import { Handle } from "react-flow-renderer";
import { useTheme } from "@material-ui/core/styles";

export default memo(({ data, isConnectable }) => {
  const theme = useTheme();
  const dark = theme.palette.type === "dark";

  const palette = {
    cardBg: dark ? "#1e293b" : "#ffffff",
    title: dark ? "#f1f5f9" : "#0f172a",
    body: dark ? "rgba(226, 232, 240, 0.70)" : "rgba(15, 23, 42, 0.70)"
  };

  return (
    <div
      style={{
        background: palette.cardBg,
        padding: 12,
        borderRadius: 14,
        border: "1px solid rgba(34, 197, 94, 0.30)",
        boxShadow: "0 10px 28px rgba(16, 24, 40, 0.10)",
        width: 210,
        position: "relative",
        transition: "all .2s ease"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
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
            background: "rgba(34, 197, 94, 0.12)",
            border: "1px solid rgba(34, 197, 94, 0.35)"
          }}
        >
          <RocketLaunch sx={{ width: 16, height: 16, color: "#22c55e" }} />
        </div>

        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: palette.title,
            letterSpacing: "-0.01em"
          }}
        >
          Início do fluxo
        </div>
      </div>

      <div
        style={{
          fontSize: 12,
          color: palette.body,
          lineHeight: "16px",
          paddingRight: 20
        }}
      >
        Este bloco marca o início do seu fluxo
      </div>

      <Handle
        type="source"
        position="right"
        id="a"
        style={{
          background: "#6366F1",
          width: 18,
          height: 18,
          top: "72%",
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
