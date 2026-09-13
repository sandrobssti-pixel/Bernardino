import {
  ArrowForwardIos,
  ContentCopy,
  Delete,
  DynamicFeed
} from "@mui/icons-material";
import React, { memo } from "react";
import { useTheme } from "@material-ui/core/styles";

import { Handle } from "react-flow-renderer";
import { useNodeStorage } from "../../../stores/useNodeStorage";

const FONT_FAMILY =
  '"DM Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

const handleStyle = {
  background: "#6366f1",
  width: 16,
  height: 16,
  cursor: "pointer",
  border: "2px solid #ffffff",
  boxShadow: "0 4px 10px rgba(99, 102, 241, 0.28)"
};

const handleArrow = {
  color: "#fff",
  width: 9,
  height: 9,
  pointerEvents: "none"
};

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();
  const theme = useTheme();
  const dark = theme.palette.type === "dark";

  const palette = {
    cardBg: dark ? "#1e293b" : "#ffffff",
    cardBorder: dark ? "rgba(148, 163, 184, 0.16)" : "rgba(15, 23, 42, 0.08)",
    title: dark ? "#f1f5f9" : "#0f172a",
    iconAction: dark ? "rgba(148, 163, 184, 0.85)" : "rgba(100, 116, 139, 0.85)",
    body: dark ? "rgba(226, 232, 240, 0.72)" : "rgba(15, 23, 42, 0.72)",
    optionBg: dark ? "rgba(15, 23, 42, 0.55)" : "#f8fafc",
    optionBorder: dark ? "rgba(148, 163, 184, 0.16)" : "rgba(15, 23, 42, 0.08)",
    optionText: dark ? "rgba(226, 232, 240, 0.8)" : "rgba(15, 23, 42, 0.75)",
    badgeBg: dark ? "rgba(99, 102, 241, 0.22)" : "rgba(99, 102, 241, 0.12)",
    badgeText: dark ? "#a5b4fc" : "#4f46e5",
    mainMenuBg: dark ? "rgba(37, 99, 235, 0.16)" : "rgba(239, 246, 255, 0.7)",
    mainMenuText: dark ? "#93c5fd" : "rgba(30, 64, 175, 0.9)",
    mainMenuBadgeBg: dark ? "rgba(37, 99, 235, 0.28)" : "rgba(37, 99, 235, 0.12)",
    mainMenuBadgeText: dark ? "#bfdbfe" : "#1e40af",
    exitBg: dark ? "rgba(239, 68, 68, 0.16)" : "rgba(254, 242, 242, 0.7)",
    exitText: dark ? "#fca5a5" : "rgba(127, 29, 29, 0.9)",
    exitBadgeBg: dark ? "rgba(239, 68, 68, 0.28)" : "rgba(239, 68, 68, 0.12)",
    exitBadgeText: dark ? "#fecaca" : "#b91c1c"
  };

  return (
    <div
      style={{
        background: palette.cardBg,
        padding: 10,
        width: 208,
        position: "relative",
        border: `1px solid ${palette.cardBorder}`,
        fontFamily: FONT_FAMILY,
        fontSize: 12
      }}
    >
      <Handle
        type="target"
        position="left"
        style={{ ...handleStyle, top: 24, left: -11 }}
        isConnectable={isConnectable}
      >
        <ArrowForwardIos sx={handleArrow} />
      </Handle>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 40 }}>
        <div
          style={{
            width: 24,
            height: 24,
            minWidth: 24,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(99, 102, 241, 0.10)"
          }}
        >
          <DynamicFeed sx={{ width: 14, height: 14, color: "#6366f1" }} />
        </div>

        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: palette.title,
            letterSpacing: "-0.01em"
          }}
        >
          Menu
        </div>

        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <ContentCopy
            onClick={() => {
              storageItems.setNodesStorage(id);
              storageItems.setAct("duplicate");
            }}
            sx={{ width: 14, height: 14, color: palette.iconAction, cursor: "pointer" }}
          />
          <Delete
            onClick={() => {
              storageItems.setNodesStorage(id);
              storageItems.setAct("delete");
            }}
            sx={{ width: 14, height: 14, color: palette.iconAction, cursor: "pointer" }}
          />
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          marginTop: 8,
          color: palette.body,
          fontSize: 12,
          lineHeight: "16px",
          padding: "6px 2px",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden"
        }}
      >
        {data.message}
      </div>

      {/* Options */}
      <div style={{ marginTop: 2, display: "flex", flexDirection: "column", gap: 6 }}>
        {data.arrayOption.map((option) => (
          <div key={option.number} style={{ position: "relative", paddingRight: 14 }}>
            <div
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "6px 8px",
                borderRadius: 8,
                border: `1px solid ${palette.optionBorder}`,
                background: palette.optionBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6
              }}
            >
              <div
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontSize: 11.5,
                  color: palette.optionText
                }}
              >
                {option.value}
              </div>

              <div
                style={{
                  fontSize: 10,
                  minWidth: 16,
                  height: 16,
                  padding: "0 5px",
                  borderRadius: 999,
                  background: palette.badgeBg,
                  color: palette.badgeText,
                  fontWeight: 700,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {option.number}
              </div>
            </div>

            <Handle
              type="source"
              position="right"
              id={"a" + option.number}
              style={{ ...handleStyle, top: "50%", transform: "translateY(-50%)", right: -11 }}
              isConnectable={isConnectable}
            >
              <ArrowForwardIos sx={handleArrow} />
            </Handle>
          </div>
        ))}

        {data.includeMainMenuOption && (
          <div style={{ position: "relative", paddingRight: 14 }}>
            <div
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "6px 8px",
                borderRadius: 8,
                border: "1px dashed rgba(37, 99, 235, 0.3)",
                background: palette.mainMenuBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6
              }}
            >
              <div
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontSize: 11.5,
                  color: palette.mainMenuText
                }}
              >
                {data.mainMenuOptionText || "Retornar ao Menu Principal"}
              </div>
              <div
                style={{
                  fontSize: 10,
                  minWidth: 16,
                  height: 16,
                  padding: "0 5px",
                  borderRadius: 999,
                  background: palette.mainMenuBadgeBg,
                  color: palette.mainMenuBadgeText,
                  fontWeight: 700,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                #
              </div>
            </div>
          </div>
        )}

        {data.includeExitOption && (
          <div style={{ position: "relative", paddingRight: 14 }}>
            <div
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "6px 8px",
                borderRadius: 8,
                border: "1px dashed rgba(239, 68, 68, 0.3)",
                background: palette.exitBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6
              }}
            >
              <div
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontSize: 11.5,
                  color: palette.exitText
                }}
              >
                {data.exitOptionText || "Encerrar atendimento"}
              </div>
              <div
                style={{
                  fontSize: 10,
                  minWidth: 16,
                  height: 16,
                  padding: "0 5px",
                  borderRadius: 999,
                  background: palette.exitBadgeBg,
                  color: palette.exitBadgeText,
                  fontWeight: 700,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                Sair
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
