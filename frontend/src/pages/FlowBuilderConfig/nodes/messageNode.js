import {
  ArrowForwardIos,
  ContentCopy,
  Delete,
  Message
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
    cardBorder: dark ? "rgba(148, 163, 184, 0.16)" : "rgba(15, 23, 42, 0.10)",
    title: dark ? "#f1f5f9" : "#0f172a",
    bodyText: dark ? "rgba(226, 232, 240, 0.75)" : "rgba(15, 23, 42, 0.75)",
    bodyBorder: dark ? "rgba(148, 163, 184, 0.16)" : "rgba(15, 23, 42, 0.08)",
    bodyBg: dark ? "rgba(15, 23, 42, 0.55)" : "rgba(248, 250, 252, 0.9)"
  };

  return (
    <div
      className="fb-node fb-node--message"
      style={{
        background: palette.cardBg,
        borderRadius: 14,
        border: `1px solid ${palette.cardBorder}`,
        boxShadow: "0 10px 28px rgba(16, 24, 40, 0.10)",
        padding: 12,
        width: 210,
        position: "relative",
        transition: "all .2s ease"
      }}
    >
      <Handle
        type="target"
        position="left"
        className="fb-handle fb-handle--target"
        style={{
          top: 26,
          left: -12,
          width: 18,
          height: 18,
          background: "#6366F1",
          border: "2px solid #ffffff",
          boxShadow: "0 10px 22px rgba(99, 102, 241, 0.22)",
          cursor: "pointer"
        }}
        onConnect={(params) => console.log("handle onConnect", params)}
        isConnectable={isConnectable}
      >
        <ArrowForwardIos
          style={{
            color: "#ffffff",
            width: 10,
            height: 10,
            marginLeft: 3,
            marginBottom: 1,
            pointerEvents: "none"
          }}
        />
      </Handle>

      <div
        className="fb-node__actions"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          display: "flex",
          gap: 8
        }}
      >
        <button
          type="button"
          className="fb-iconbtn"
          title="Duplicar"
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("duplicate");
          }}
        >
          <ContentCopy style={{ width: 16, height: 16 }} />
        </button>

        <button
          type="button"
          className="fb-iconbtn"
          title="Excluir"
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("delete");
          }}
        >
          <Delete style={{ width: 16, height: 16 }} />
        </button>
      </div>

      <div
        className="fb-node__header"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8
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
          <Message sx={{ width: 16, height: 16, color: "#6366F1" }} />
        </div>

        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: palette.title,
            letterSpacing: "-0.01em"
          }}
        >
          Mensagem
        </div>
      </div>

      <div
        className="fb-node__body"
        style={{
          fontSize: 12,
          color: palette.bodyText,
          padding: 10,
          borderRadius: 12,
          border: `1px solid ${palette.bodyBorder}`,
          background: palette.bodyBg,
          minHeight: 44,
          overflow: "hidden"
        }}
      >
        {data.label}
      </div>

      <Handle
        type="source"
        position="right"
        id="a"
        className="fb-handle fb-handle--source"
        style={{
          top: "74%",
          right: -12,
          width: 18,
          height: 18,
          background: "#6366F1",
          border: "2px solid #ffffff",
          boxShadow: "0 10px 22px rgba(99, 102, 241, 0.22)",
          cursor: "pointer"
        }}
        isConnectable={isConnectable}
      >
        <ArrowForwardIos
          style={{
            color: "#ffffff",
            width: 10,
            height: 10,
            marginLeft: 3,
            marginBottom: 1,
            pointerEvents: "none"
          }}
        />
      </Handle>
    </div>
  );
});
