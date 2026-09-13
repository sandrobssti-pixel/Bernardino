import React from "react";
import {
  getBezierPath,
  getEdgeCenter,
  getMarkerEnd
} from "react-flow-renderer";

import "./css/buttonedge.css";
import { Delete } from "@mui/icons-material";

export default function removeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  arrowHeadType,
  markerEndId,
  data
}) {
  const edgePath = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });

  const markerEnd = getMarkerEnd(arrowHeadType, markerEndId);

  const [edgeCenterX, edgeCenterY] = getEdgeCenter({
    sourceX,
    sourceY,
    targetX,
    targetY
  });

  const foreignObjectSize = 36;

  return (
    <>
      <path
        id={id}
        style={{
          ...style,
          strokeWidth: 2
        }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />

      <foreignObject
        width={foreignObjectSize}
        height={foreignObjectSize}
        x={edgeCenterX - foreignObjectSize / 2}
        y={edgeCenterY - foreignObjectSize / 2}
        className="edgebutton-foreignobject"
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <div
          style={{
            width: foreignObjectSize,
            height: foreignObjectSize,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <button
            className="edgebutton"
            onClick={() => data?.onDelete?.(id)}
            style={{
              width: foreignObjectSize,
              height: foreignObjectSize,
              borderRadius: "999px",
              background: "#ffffff",
              border: "1px solid rgba(15, 23, 42, 0.12)",
              boxShadow: "0 8px 24px rgba(16, 24, 40, 0.12)",
              transition: "all .15s ease"
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow =
                "0 12px 32px rgba(16, 24, 40, 0.18)";
              e.currentTarget.style.borderColor = "#ef4444";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow =
                "0 8px 24px rgba(16, 24, 40, 0.12)";
              e.currentTarget.style.borderColor =
                "rgba(15, 23, 42, 0.12)";
            }}
          >
            <Delete sx={{ width: 16, height: 16, color: "#ef4444" }} />
          </button>
        </div>
      </foreignObject>
    </>
  );
}
