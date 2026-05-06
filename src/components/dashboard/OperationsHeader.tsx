import { useIsAuthenticated } from "@azure/msal-react";
import { useExcelWorkbook } from "@/hooks/useExcelWorkbook";
import { useExcelMetrics } from "@/hooks/useExcelMetrics";
import { TARGET_EQUIPMENT } from "@/services/excelParser";
import { Activity, Loader2 } from "lucide-react";

const fmt = (n: number, d = 1) =>
  n
    ? n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })
    : "—";
const fmtInt = (n: number) => (n ? Math.round(n).toLocaleString("pt-BR") : "—");

const COLS = [
  "Equipamento",
  "Horas Trabalhadas",
  "Produção",
  "Produtividade",
  "Manutenção",
  "Preventiva",
  "DF",
  "UT",
];

export function OperationsHeader() {
  const isAuth = useIsAuthenticated();
  const { file, worksheets } = useExcelWorkbook(isAuth);
  const { metrics, loading, lastUpdated } = useExcelMetrics(file, worksheets);

  return (
    <section className="rounded-xl border border-mining-purple/30 bg-gradient-to-br from-mining-surface via-card to-mining-surface shadow-[0_0_40px_-15px_hsl(var(--mining-purple)/0.5)] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-mining-purple/20 bg-black/40">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Activity className="h-4 w-4 text-mining-green" />
            <span className="absolute inset-0 animate-ping rounded-full bg-mining-green/40" />
          </div>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground">
            Painel Operacional · Frota
          </h2>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-mining-purple" />}
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
          {file ? (
            <span className="text-mining-green">● ONEDRIVE LIVE</span>
          ) : (
            <span className="text-mining-yellow">○ AGUARDANDO LOGIN</span>
          )}
          {lastUpdated && (
            <span>SYNC {lastUpdated.toLocaleTimeString("pt-BR")}</span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="bg-mining-purple/15 border-b-2 border-mining-purple/40">
              {COLS.map((c) => (
                <th
                  key={c}
                  className="text-left px-4 py-3 text-[11px] uppercase tracking-wider font-bold text-mining-purple-glow whitespace-nowrap"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono">
            {TARGET_EQUIPMENT.map((eq, i) => {
              const m = metrics?.[eq];
              return (
                <tr
                  key={eq}
                  className={`border-b border-mining-purple/10 transition-colors hover:bg-mining-green/5 ${
                    i % 2 === 0 ? "bg-black/20" : "bg-transparent"
                  }`}
                >
                  <td className="px-4 py-3 font-bold text-foreground">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-mining-green shadow-[0_0_8px_hsl(var(--mining-green))]" />
                      {eq}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-mining-green">{fmt(m?.horasTrabalhadas ?? 0)} h</td>
                  <td className="px-4 py-3 text-mining-green">{fmtInt(m?.producao ?? 0)} t</td>
                  <td className="px-4 py-3 text-mining-green-glow font-bold">
                    {fmt(m?.produtividade ?? 0, 2)}
                  </td>
                  <td className="px-4 py-3 text-mining-yellow">{fmt(m?.manutencao ?? 0)}</td>
                  <td className="px-4 py-3 text-mining-purple-glow">{fmt(m?.preventiva ?? 0)}</td>
                  <td className="px-4 py-3 text-mining-green">{fmt(m?.df ?? 0)}%</td>
                  <td className="px-4 py-3 text-mining-green">{fmt(m?.ut ?? 0)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}