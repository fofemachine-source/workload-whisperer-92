import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, WifiOff, CheckCircle2 } from "lucide-react";
import { useProducaoDiaria } from "@/hooks/useProducaoDiaria";

/**
 * Cartão "Comunicação Hexagon".
 *
 * Fluxo: Hexagon/JMineOps → SQL Server (192.168.17.15) → agente Node.js local
 *        → Supabase → Lovable. O frontend lê apenas do Supabase.
 *
 * - <= 5 min:  verde  (Comunicação OK)
 * - 5–15 min:  amarelo (Comunicação atrasada com Hexagon)
 * - > 15 min:  vermelho (Comunicação parada — verificar agente local)
 */
export default function AlertaSincronizacaoHexagon() {
  const { data } = useProducaoDiaria(7);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const ultimo = useMemo(() => {
    if (!data || data.length === 0) return null;
    return [...data].sort(
      (a, b) => new Date(b.atualizado_em).getTime() - new Date(a.atualizado_em).getTime(),
    )[0];
  }, [data]);

  if (!ultimo) return null;

  const updated = new Date(ultimo.atualizado_em);
  const diffMin = (Date.now() - updated.getTime()) / 60000;
  const fmtData = updated.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let cor = "border-mining-green/40 bg-mining-green/10 text-mining-green";
  let Icon = CheckCircle2;
  let titulo = "COMUNICAÇÃO HEXAGON: OK";

  if (diffMin > 15) {
    cor = "border-mining-red/50 bg-mining-red/10 text-mining-red";
    Icon = WifiOff;
    titulo = "COMUNICAÇÃO HEXAGON: PARADA — verificar agente local no servidor SQL";
  } else if (diffMin > 5) {
    cor = "border-mining-yellow/50 bg-mining-yellow/10 text-mining-yellow";
    Icon = AlertTriangle;
    titulo = "COMUNICAÇÃO HEXAGON: ATRASADA";
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 px-3 py-2 border rounded-md font-mono text-xs ${cor}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="uppercase tracking-[0.12em] font-bold">{titulo}</span>
      {diffMin > 5 && (
        <span className="text-muted-foreground normal-case">
          Dado desatualizado desde <span className="text-foreground">{fmtData}</span> ({Math.floor(diffMin)} min atrás)
        </span>
      )}
      {diffMin <= 5 && (
        <span className="text-muted-foreground normal-case">
          última sincronização <span className="text-foreground">{fmtData}</span>
        </span>
      )}
      <span className="ml-auto text-muted-foreground normal-case">
        origem: <span className="text-foreground">agente-sqlserver</span>
      </span>
    </div>
  );
}