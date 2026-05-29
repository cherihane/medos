import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import Layout from "../../components/Layout";

const epiData = [
  { semaine: "S1", paludisme: 320, grippe: 180, cholera: 12 },
  { semaine: "S2", paludisme: 380, grippe: 210, cholera: 8 },
  { semaine: "S3", paludisme: 290, grippe: 340, cholera: 5 },
  { semaine: "S4", paludisme: 410, grippe: 280, cholera: 15 },
  { semaine: "S5", paludisme: 360, grippe: 190, cholera: 3 },
];

const maladies = [
  { nom: "Paludisme", cas: 1760, tendance: "+8%", niveau: "surveillance", region: "National" },
  { nom: "Grippe saisonnière", cas: 1200, tendance: "+34%", niveau: "alerte", region: "Abidjan, Bouaké" },
  { nom: "Choléra", cas: 43, tendance: "-22%", niveau: "déclin", region: "Daloa" },
  { nom: "Tuberculose", cas: 87, tendance: "+2%", niveau: "stable", region: "National" },
  { nom: "Rougeole", cas: 12, tendance: "-65%", niveau: "contrôlé", region: "National" },
];

const niveauStyle = {
  alerte: { bg: "#FEF2F2", color: "#EF4444" },
  surveillance: { bg: "#FFFBEB", color: "#D97706" },
  déclin: { bg: "#DCFCE7", color: "#16A34A" },
  stable: { bg: "#EFF6FF", color: "#2563EB" },
  contrôlé: { bg: "#DCFCE7", color: "#16A34A" },
};

export default function Epidemiologie() {
  return (
    <Layout title="Épidémiologie" subtitle="Surveillance épidémiologique et besoins médicamenteux">
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Maladies surveillées", value: "24", color: "#8B5CF6" },
          { label: "Cas total (semaine)", value: "3 102", color: "#EF4444" },
          { label: "Alertes épidémiques", value: "2", color: "#F59E0B" },
          { label: "Régions sous surveillance", value: "6", color: "#3B82F6" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20, minWidth: 0 }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Tendance hebdomadaire — 5 dernières semaines</h3>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={epiData}>
              <XAxis dataKey="semaine" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="paludisme" stroke="#EF4444" strokeWidth={2.5} dot={{ r: 4 }} name="Paludisme" />
              <Line type="monotone" dataKey="grippe" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 4 }} name="Grippe" />
              <Line type="monotone" dataKey="cholera" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} name="Choléra" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Maladies sous surveillance</h3>
          {maladies.map((m) => {
            const n = niveauStyle[m.niveau];
            return (
              <div key={m.nom} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid #F3F4F6" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628" }}>{m.nom}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>{m.region}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#374151" }}>{m.cas.toLocaleString()} cas</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", marginTop: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: m.tendance.startsWith("+") ? "#EF4444" : "#10B981" }}>{m.tendance}</span>
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, backgroundColor: n.bg, color: n.color, fontWeight: 700 }}>{m.niveau}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Besoins médicamenteux estimés</h3>
          {[
            { medicament: "Artemether/Luméfantrine", qte: "45 000 doses", urgence: "haute" },
            { medicament: "Antiviraux grippe", qte: "12 000 boîtes", urgence: "haute" },
            { medicament: "Sels de réhydratation", qte: "8 000 sachets", urgence: "normale" },
            { medicament: "Vaccin rougeole", qte: "2 000 doses", urgence: "faible" },
          ].map((b) => (
            <div key={b.medicament} style={{ padding: "12px 14px", backgroundColor: b.urgence === "haute" ? "#FEF2F2" : b.urgence === "normale" ? "#FFFBEB" : "#F8FAFC", borderRadius: 10, marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#0A1628" }}>{b.medicament}</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 12, color: "#6B7280" }}>{b.qte}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: b.urgence === "haute" ? "#EF4444" : b.urgence === "normale" ? "#D97706" : "#6B7280" }}>Urgence {b.urgence}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
