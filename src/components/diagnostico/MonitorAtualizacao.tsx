import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Radio } from "lucide-react";
import { useProducaoDiaria } from "@/hooks/useProducaoDiaria";

const fmtNum = (n: number | null | undefined) =>
  Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });

function formatDataRef(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

export default function MonitorAtualizacao() {
  const { data, dataUpdatedAt, isFetching } = useProducaoDiaria(7);
  const ultimo = data?.[0];

  const [agora, setAgora] = useState(Date.now());
  const [recebidaEm, setRecebidaEm] = useState<string>("—");
  const [aplicadaEm, setAplicadaEm] = useState<string>("—");
  const lastUpdatedRef = useRef<number>(0);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (dataUpdatedAt && dataUpdatedAt !== lastUpdatedRef.current) {
      lastUpdatedRef.current = dataUpdatedAt;
      const recebida = new Date(dataUpdatedAt);
      setRecebidaEm(recebida.toLocaleTimeString("pt-BR"));
      // Atualização parcial aplicada no próximo tick (sem remontar nada)
      const aplicada = new Date(dataUpdatedAt + 1000);
      setAplicadaEm(aplicada.toLocaleTimeString("pt-BR"));
    }
  }, [dataUpdatedAt]);

  const segDesde = dataUpdatedAt ? Math.max(0, Math.floor((agora - dataUpdatedAt) / 1000)) : 0;
  const proxima = Math.max(0, 30 - (segDesde % 30));

  return (
    <Card className="border-mining-blue/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Radio className={`h-4 w-4 text-mining-blue ${isFetching ? "animate-pulse" : ""}`} />
          STATUS SINCRONIZAÇÃO
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs font-mono">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
          <div>
            <div className="text-muted-foreground uppercase">Última leitura</div>
            <div className="text-foreground">{formatDataRef(ultimo?.data_referencia)}</div>
          </div>
          <div>
            <div className="text-muted-foreground uppercase">Turno</div>
            <div className="text-mining-yellow uppercase">{ultimo?.turno ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground uppercase">Toneladas</div>
            <div className="text-mining-blue">{fmtNum(ultimo?.toneladas_total)} t</div>
          </div>
          <div>
            <div className="text-muted-foreground uppercase">Atualização</div>
            <div className="text-foreground">há {segDesde} segundos</div>
          </div>
          <div>
            <div className="text-muted-foreground uppercase">Próxima consulta</div>
            <div className="text-mining-green">{proxima} segundos</div>
          </div>
          <div>
            <div className="text-muted-foreground uppercase">Horário do navegador</div>
            <div className="text-foreground">{new Date(agora).toLocaleTimeString("pt-BR")}</div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
          <div>
            <span className="text-muted-foreground uppercase">Última sincronização recebida: </span>
            <span className="text-foreground">{recebidaEm}</span>
          </div>
          <div>
            <span className="text-muted-foreground uppercase">Última sincronização aplicada: </span>
            <span className="text-foreground">{aplicadaEm}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}