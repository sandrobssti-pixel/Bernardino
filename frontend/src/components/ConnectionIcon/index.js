import React from "react";

import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import InstagramIcon from "@material-ui/icons/Instagram";
import FacebookIcon from "@material-ui/icons/Facebook";

const CONNECTION_TYPE_ICON_PATHS = {
    whatsapp_baileys: "/connection-icons/whatsapp-baileys.png",
    whatsapp_wuzapi: "/connection-icons/whatsapp-wuzapi.png",
    whatsapp_oficial: "/connection-icons/whatsapp-oficial.png",
};

const normalize = (value) => String(value || "").trim().toLowerCase();
const resolveSize = (value, fallback) => {
    if (typeof value === "number") return `${value}px`;

    const parsed = Number.parseInt(String(value || "").trim(), 10);
    if (Number.isNaN(parsed)) return `${fallback}px`;

    return `${parsed}px`;
};

const resolveConnectionType = ({ connectionType, connection, channel, provider }) => {
    const normalizedConnectionType = normalize(connectionType);
    const normalizedChannel = normalize(channel || connection?.channel || connectionType);
    const normalizedProvider = normalize(provider || connection?.provider);

    if (normalizedConnectionType === "whatsapp_oficial" || normalizedChannel === "whatsapp_oficial") {
        return "whatsapp_oficial";
    }

    if (normalizedConnectionType === "whatsappapi") {
        return "whatsapp_oficial";
    }

    if (normalizedConnectionType === "whatsapp_wuzapi") {
        return "whatsapp_wuzapi";
    }

    if (normalizedConnectionType === "whatsapp_baileys") {
        return "whatsapp_baileys";
    }

    if (normalizedChannel === "whatsapp" || normalizedConnectionType === "whatsapp") {
        return normalizedProvider === "wuzapi" ? "whatsapp_wuzapi" : "whatsapp_baileys";
    }

    if (normalizedConnectionType) return normalizedConnectionType;
    return normalizedChannel;
};

const ConnectionIcon = ({ connectionType, connection, channel, provider, width, height, className, style }) => {
    const resolvedType = resolveConnectionType({ connectionType, connection, channel, provider });
    const customTypeIcon = CONNECTION_TYPE_ICON_PATHS[resolvedType];

    if (customTypeIcon) {
        return (
            <img
                src={customTypeIcon}
                alt={resolvedType}
                className={className}
                style={{
                    width: resolveSize(width, 18),
                    height: resolveSize(height, 18),
                    objectFit: "contain",
                    verticalAlign: "middle",
                    ...style,
                }}
            />
        );
    }

    const iconStyle = { marginBottom: "-5px", ...style };

    return (
        <React.Fragment>
            {resolvedType === "whatsapp" && <WhatsAppIcon fontSize="small" className={className} style={{ ...iconStyle, color: "#25D366" }} />}
            {resolvedType === "instagram" && <InstagramIcon fontSize="small" className={className} style={{ ...iconStyle, color: "#e1306c" }} />}
            {resolvedType === "facebook" && <FacebookIcon fontSize="small" className={className} style={{ ...iconStyle, color: "#3b5998" }} />}
        </React.Fragment>
    );
};

export default ConnectionIcon;
