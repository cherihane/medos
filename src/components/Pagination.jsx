/**
 * Pagination — boutons Précédent / Suivant + indicateur "Page X sur Y"
 * Props: page (0-indexed), totalPages, total, onPage(newPage)
 * Ne s'affiche pas si totalPages <= 1.
 */
export default function Pagination({ page, totalPages, total, onPage, pageSize = 20 }) {
  if (totalPages <= 1) return null;

  const from = page * pageSize + 1;
  const to   = Math.min((page + 1) * pageSize, total);

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 20px", borderTop: "1px solid #F3F4F6", marginTop: 4,
    }}>
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 0}
        style={{
          padding: "7px 18px", border: "1.5px solid #E5E7EB", borderRadius: 8,
          fontSize: 13, fontWeight: 600, cursor: page === 0 ? "not-allowed" : "pointer",
          backgroundColor: "white", color: page === 0 ? "#D1D5DB" : "#374151",
        }}
      >
        Precedent
      </button>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "#374151" }}>
          Page <strong>{page + 1}</strong> sur <strong>{totalPages}</strong>
        </div>
        {total > 0 && (
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
            {from}–{to} sur {total}
          </div>
        )}
      </div>

      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages - 1}
        style={{
          padding: "7px 18px", border: "1.5px solid #E5E7EB", borderRadius: 8,
          fontSize: 13, fontWeight: 600, cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
          backgroundColor: "white", color: page >= totalPages - 1 ? "#D1D5DB" : "#374151",
        }}
      >
        Suivant
      </button>
    </div>
  );
}
