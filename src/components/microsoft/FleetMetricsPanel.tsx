import { useIsAuthenticated } from "@azure/msal-react";
import { useExcelWorkbook } from "@/hooks/useExcelWorkbook";
import { useExcelMetrics } from "@/hooks/useExcelMetrics";
import { TARGET_EQUIPMENT } from "@/services/excelParser";
import { Loader2, RefreshCw, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

const fmt = (n: number, d = 1) =>
  n ? n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";
const fmtInt = (n: number) => (n ? Math.round(n).toLocaleString("pt-BR") : "—");

export function FleetMetricsPanel() {
  const isAuth = useIsAuthenticated();
  const { file, worksheets } = useExcelWorkbook(isAuth);
  const { loading, error, metrics, lastUpdated, refresh, debug } = useExcelMetrics(file, worksheets);

  if (!isAuth || !file) return null;

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-mining-green" />
          <h3 className="text-sm font-semibold text-foreground">Métricas da Frota — Excel ao vivo</h3>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground ml-2">
              · atualizado {lastUpdated.toLocaleTimeString("pt-BR")}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Atualizar
        </Button>
      </div>

      {error && (
        <div className="p-4 text-sm text-mining-red">{error}</div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-mining-surface text-xs uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-4 py-3">Equipamento</th>
              <th className="text-right px-4 py-3">H. Trabalhadas</th>
              <th className="text-right px-4 py-3">Produção (t)</th>
              <th className="text-right px-4 py-3">Produtividade (t/h)</th>
              <th className="text-right px-4 py-3">Manutenção</th>
              <th className="text-right px-4 py-3">Preventiva</th>
              <th className="text-right px-4 py-3">DF %</th>
              <th className="text-right px-4 py-3">UT %</th>
            </tr>
          </thead>
          <tbody>
            {TARGET_EQUIPMENT.map((eq) => {
              const m = metrics?.[eq];
              return (
                <tr key={eq} className="border-b border-border/50 hover:bg-mining-card-hover">
                  <td className="px-4 py-3 font-mono font-semibold text-foreground">{eq}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(m?.horasTrabalhadas ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmtInt(m?.producao ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-mono text-mining-indigo">{fmt(m?.produtividade ?? 0, 2)}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(m?.manutencao ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(m?.preventiva ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-mono text-mining-yellow">{fmt(m?.df ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-mono text-mining-green">{fmt(m?.ut ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {debug.length > 0 && (
        <details className="px-5 py-3 border-t border-border text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">Diagnóstico de mapeamento ({debug.length} aba(s))</summary>
          <ul className="mt-2 space-y-1 font-mono">
            {debug.map((d) => (
              <li key={d.sheet}>
                <span className="text-foreground">{d.sheet}</span> — header row {d.headerRow}, {d.matched} linhas mapeadas, colunas: {JSON.stringify(d.map)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}