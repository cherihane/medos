import { useState } from "react";

/**
 * Tooltip avec icone "?" au survol.
 *
 * Usage :
 *   <Tooltip text="Le numéro de licence est délivré par le Ministère de la Santé." />
 *
 * Props :
 *   text      {string}  Contenu du tooltip
 *   position  {"top"|"bottom"|"right"}  Défaut : "top"
 */
export default function Tooltip({ text, position = "top" }) {
  const [visible, setVisible] = useState(false);

  const boxStyle = {
    position:    "absolute",
    zIndex:      9999,
    width:       220,
    padding:     "8px 12px",
    backgroundColor: "#0A1628",
    color:       "white",
    fontSize:    11,
    lineHeight:  1.6,
    borderRadius: 8,
    boxShadow:   "0 4px 16px rgba(0,0,0,0.25)",
    pointerEvents: "none",
    whiteSpace:  "normal",
  };

  const positions = {
    top: {
      bottom:    "calc(100% + 6px)",
      left:      "50%",
      transform: "translateX(-50%)",
    },
    bottom: {
      top:       "calc(100% + 6px)",
      left:      "50%",
      transform: "translateX(-50%)",
    },
    right: {
      top:       "50%",
      left:      "calc(100% + 8px)",
      transform: "translateY(-50%)",
    },
  };

  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center", marginLeft: 5 }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {/* Icone point d'interrogation */}
      <span
        style={{
          display:         "inline-flex",
          alignItems:      "center",
          justifyContent:  "center",
          width:           16,
          height:          16,
          borderRadius:    "50%",
          backgroundColor: "#E5E7EB",
          color:           "#6B7280",
          fontSize:        10,
          fontWeight:      700,
          cursor:          "help",
          flexShrink:      0,
          lineHeight:      1,
        }}
      >
        ?
      </span>

      {/* Bulle */}
      {visible && (
        <span style={{ ...boxStyle, ...positions[position] }}>
          {text}
        </span>
      )}
    </span>
  );
}
