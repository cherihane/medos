import { render, screen } from "@testing-library/react";
import KpiCard from "./components/KpiCard";

// ── KpiCard : affichage valeur et label ───────────────────────────────────────

test("KpiCard affiche la valeur et le label", () => {
  render(<KpiCard label="Ventes du jour" value="12 500 FCFA" color="#10B981" />);
  expect(screen.getByText("Ventes du jour")).toBeInTheDocument();
  expect(screen.getByText("12 500 FCFA")).toBeInTheDocument();
});

// ── KpiCard : badge change masqué si absent ───────────────────────────────────

test("KpiCard n'affiche aucun badge quand change est absent", () => {
  render(<KpiCard label="Stock critique" value={3} color="#EF4444" />);
  // Un badge avec un signe + ou - ne doit pas apparaître dans le DOM
  expect(screen.queryByText(/[+-]/)).toBeNull();
});

test("KpiCard affiche le badge change quand fourni", () => {
  render(<KpiCard label="Ruptures" value={5} color="#EF4444" change="+2" />);
  expect(screen.getByText("+2")).toBeInTheDocument();
});
