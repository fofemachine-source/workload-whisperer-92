import { OpsCenter } from "@/components/ops/OpsCenter";
import FrentesBrutas from "@/components/diagnostico/FrentesBrutas";

export default function Dashboard() {
  return (
    <div>
      <div style={{ border: "2px solid red", padding: 12, margin: 12 }}>
        <p style={{ color: "red", fontWeight: "bold", fontFamily: "monospace" }}>
          TESTE DE RENDERIZAÇÃO
        </p>
        <FrentesBrutas />
      </div>
      <OpsCenter />
    </div>
  );
}
