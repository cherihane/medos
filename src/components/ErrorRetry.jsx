/**
 * ErrorRetry — Bandeau d'erreur avec bouton "Réessayer".
 *
 * Usage :
 *   <ErrorRetry message="Impossible de charger les médicaments." onRetry={refetch} />
 *
 * Props :
 *   message  {string}    Message d'erreur à afficher (doit être en français, sans détail technique)
 *   onRetry  {Function}  Callback appelé au clic sur "Réessayer"
 *   compact  {boolean}   Affichage compact (une seule ligne) — défaut false
 */
export default function ErrorRetry({ message, onRetry, compact = false }) {
  if (compact) {
    return (
      <div style={{
        display:        "flex",
        alignItems:     "center",
        gap:            12,
        padding:        "10px 14px",
        backgroundColor: "#FEF2F2",
        border:         "1px solid #FECACA",
        borderRadius:   8,
        fontSize:       12,
      }}>
        <span style={{ color: "#DC2626", flex: 1 }}>{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding:         "4px 12px",
              backgroundColor: "white",
              border:          "1px solid #FECACA",
              borderRadius:    6,
              fontSize:        11,
              fontWeight:      600,
              color:           "#DC2626",
              cursor:          "pointer",
              whiteSpace:      "nowrap",
              fontFamily:      "inherit",
            }}
          >
            Reessayer
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      justifyContent: "center",
      padding:        "40px 24px",
      textAlign:      "center",
      gap:            16,
    }}>
      {/* Icone croix */}
      <div style={{
        width:           44,
        height:          44,
        borderRadius:    "50%",
        backgroundColor: "#FEF2F2",
        border:          "1px solid #FECACA",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        fontSize:        20,
        color:           "#EF4444",
        flexShrink:      0,
      }}>
        x
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#0A1628", marginBottom: 4 }}>
          Une erreur s'est produite
        </div>
        <div style={{ fontSize: 12, color: "#6B7280", maxWidth: 320 }}>
          {message || "Impossible de charger les donnees. Verifiez votre connexion."}
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding:         "9px 22px",
            backgroundColor: "#0A1628",
            color:           "white",
            border:          "none",
            borderRadius:    8,
            fontSize:        13,
            fontWeight:      600,
            cursor:          "pointer",
            fontFamily:      "inherit",
          }}
        >
          Reessayer
        </button>
      )}
    </div>
  );
}
