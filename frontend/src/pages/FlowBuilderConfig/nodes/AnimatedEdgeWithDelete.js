import React from "react";
import { BaseEdge, getBezierPath, EdgeLabelRenderer } from "reactflow";

const foreignObjectSize = 36;

const AnimatedEdgeWithDelete = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  data
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY
  });

  const onDelete = () => {
    try {
      if (data && typeof data.onDelete === "function") {
        data.onDelete(id);
      } else {
        console.warn("Edge sem onDelete configurado:", id);
      }
    } catch (err) {
      console.error("Erro ao deletar edge:", err);
    }
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ display: "none" }} />
      <path
        className="edge-line"
        d={edgePath}
        style={{
          stroke: "#9ca3af",
          strokeWidth: 2,
          strokeDasharray: "10",
          animation: "dash 3.5s linear infinite"
        }}
      />
      <EdgeLabelRenderer>
        <foreignObject
          width={foreignObjectSize}
          height={foreignObjectSize}
          x={labelX - foreignObjectSize / 2}
          y={labelY - foreignObjectSize / 2}
          requiredExtensions="http://www.w3.org/1999/xhtml"
          style={{ overflow: "visible" }}
        >
          <div
            onClick={onDelete}
            style={{
              width: foreignObjectSize,
              height: foreignObjectSize,
              borderRadius: "999px",
              background: "#ffffff",
              border: "1px solid rgba(15, 23, 42, 0.12)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              cursor: "pointer",
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              fill="#ef4444"
              viewBox="0 0 24 24"
            >
              <path d="M9 3V4H4V6H5V20C5 21.1 5.9 22 7 22H17C18.1 22 19 21.1 19 20V6H20V4H15V3H9ZM7 6H17V20H7V6ZM9 8V18H11V8H9ZM13 8V18H15V8H13Z" />
            </svg>
          </div>
        </foreignObject>
      </EdgeLabelRenderer>
    </>
  );
};

export default AnimatedEdgeWithDelete;
