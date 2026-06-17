import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Radio, Database } from "lucide-react";
import { useProducaoDiaria } from "@/hooks/useProducaoDiaria";
import { useProducaoFrente, useProducaoEquipamento } from "@/hooks/useProducaoKpis";

const fmt = (n: number | null | undefined, d = 0) =>
  Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function ValidacaoHexagonCard() {
  const diaria = useProducaoDiaria(7);
  const frente = useProducaoFrente(7);
  const equip = useProducaoEquipamento(7);

  const ultimo = diaria.data?.[0];
  const supabaseOk = !diaria.isError && !frente.isError && !equip.isError;
  const fonteOk = ultimo?.relatorio_origem === "sqlserver-agent";

  const [agora, setAgora] = useState(Date.now());
  const [proxima, setProxima] = useState(30);

  useEffect(() => {
    const t = setInterval(() => {
      setAgora(Date.now());
      setProxima((p) => (p <= 1 ? 30 : p - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setProxima(30);
  }, [diaria.dataUpdatedAt, frente.dataUpdatedAt, equip.dataUpdatedAt]);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[VALIDAÇÃO] producao_diaria", diaria.data);
    // eslint-disable-next-line no-console
    console.log("[VALIDAÇÃO] producao_frente", frente.data);
    // eslint-disable-next-line no-console
    console.log("[VALIDAÇÃO] producao_equipamento", equip.data);
    // eslint-disable-next-line no-console
    console.log("[VALIDAÇÃO] último registro", ultimo);
  }, [diaria.data, frente.data, equip.data, ultimo]);

  const horaUpdate = useMemo(
    () => new Date(Math.max(diaria.dataUpdatedAt || 0, frente.dataUpdatedAt || 0, equip.dataUpdatedAt || 0) || agora).toLocaleTimeString("pt-BR"),
    [diaria.dataUpdatedAt, frente.dataUpdatedAt, equip.dataUpdatedAt, agora],
  );

  return (
    <Card className="border-mining-yellow/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          🔎 VALIDAÇÃO HEXAGON/JMINEOPS → SUPABASE → LOVABLE
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-2">
          {supabaseOk ? (
            <Badge className="bg-mining-green/20 text-mining-green border-mining-green/40 gap-1">
              <Database className="h-3 w-3" /> Supabase: Conectado
            </Badge>
          ) : (
            <Badge className="bg-mining-red/20 text-mining-red border-mining-red/40 gap-1">
              <Database className="h-3 w-3" /> Supabase: Erro
            </Badge>
          )}
          <Badge className="bg-mining-blue/20 text-mining-blue border-mining-blue/40 gap-1">
            <Radio className="h-3 w-3 animate-pulse" /> Realtime ativo
          </Badge>
          {fonteOk ? (
            <Badge className="bg-mining-green/20 text-mining-green border-mining-green/40 gap-1">
              <CheckCircle2 className="h-3 w-3" /> Fonte confirmada: Hexagon/JMineOps via SQL Server
            </Badge>
          ) : (
            <Badge className="bg-mining-yellow/20 text-mining-yellow border-mining-yellow/40 gap-1">
              <AlertTriangle className="h-3 w-3" /> Fonte não confirmada
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="text-muted-foreground uppercase">Última leitura</div>
            {ultimo ? (
              <ul className="space-y-0.5">
                <li>data_referencia: <span className="text-foreground">{ultimo.data_referencia}</span></li>
                <li>turno: <span className="text-foreground">{ultimo.turno ?? "—"}</span></li>
                <li>relatorio_origem: <span className="text-foreground">{ultimo.relatorio_origem}</span></li>
                <li>toneladas_total: <span className="text-mining-blue">{fmt(ultimo.toneladas_total)} t</span></li>
                <li>producao_hora: <span className="text-mining-green">{fmt(ultimo.producao_hora)} t/h</span></li>
                <li>atualizado_em: <span className="text-foreground">{ultimo.atualizado_em ? new Date(ultimo.atualizado_em).toLocaleString("pt-BR") : "—"}</span></li>
              </ul>
            ) : (
              <p className="text-muted-foreground">aguardando dados…</p>
            )}
          </div>

          <div className="space-y-1">
            <div className="text-muted-foreground uppercase">Contagem de registros</div>
            <ul className="space-y-0.5">
              <li>producao_diaria: <span className="text-foreground">{diaria.data?.length ?? 0}</span> linhas</li>
              <li>producao_frente: <span className="text-foreground">{frente.data?.length ?? 0}</span> linhas</li>
              <li>producao_equipamento: <span className="text-foreground">{equip.data?.length ?? 0}</span> linhas</li>
            </ul>
            <div className="text-muted-foreground uppercase pt-2">Atualização</div>
            <ul className="space-y-0.5">
              <li>última no frontend: <span className="text-foreground">{horaUpdate}</span></li>
              <li>próxima busca em: <span className="text-mining-yellow">{proxima}s</span></li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}