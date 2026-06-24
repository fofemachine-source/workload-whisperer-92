import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, WifiOff, CheckCircle2 } from "lucide-react";
import { useProducaoDiaria } from "@/hooks/useProducaoDiaria";

/**
 * Banner de alerta de comunicação com o agente Hexagon/JMineOps.
 *
 * - <= 10 min: verde (OK)
 * - 10–30 min: amarelo ("Comunicação atrasada com Hexagon")
 * - > 30 min: vermelho ("Comunicação parada. Verificar agente local no servidor SQL.")
 *
 * Mantém o último dado disponível e mostra "Dado desatualizado desde DD/MM/AAAA HH:mm".
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
  let titulo = "Comunicação OK com Hexagon/JMineOps";

  if (diffMin > 30) {
    cor = "border-mining-red/50 bg-mining-red/10 text-mining-red";
    Icon = WifiOff;
    titulo = "Comunicação parada. Verificar agente local no servidor SQL.";
  } else if (diffMin > 10) {
    cor = "border-mining-yellow/50 bg-mining-yellow/10 text-mining-yellow";
    Icon = AlertTriangle;
    titulo = "Comunicação atrasada com Hexagon";
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 px-3 py-2 border rounded-md font-mono text-xs ${cor}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="uppercase tracking-[0.12em] font-bold">{titulo}</span>
      {diffMin > 10 && (
        <span className="text-muted-foreground normal-case">
          Dado desatualizado desde <span className="text-foreground">{fmtData}</span> ({Math.floor(diffMin)} min atrás)
        </span>
      )}
      {diffMin <= 10 && (
        <span className="text-muted-foreground normal-case">
          última sincronização <span className="text-foreground">{fmtData}</span>
        </span>
      )}
    </div>
  );
}