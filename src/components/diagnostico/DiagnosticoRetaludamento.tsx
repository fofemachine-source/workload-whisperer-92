import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface FrenteRow {
  id: string;
  data_referencia: string;
  turno: string;
  frente: string;
  toneladas: number;
  relatorio_origem: string;
  atualizado_em: string;
}

const fmt = (n: number) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export default function DiagnosticoRetaludamento() {
  const [rows, setRows] = useState<FrenteRow[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      const res = await supabase
        .from("producao_frente")
        .select("*")
        .order("data_referencia", { ascending: false })
        .order("turno", { ascending: false });
      // eslint-disable-next-line no-console
      console.log("[DIAG RETALUD] producao_frente raw", res);
      if (cancel) return;
      if (res.error) setErro(res.error.message);
      else setRows((res.data ?? []) as FrenteRow[]);
    };
    load();
    const t = setInterval(load, 30_000);
    const ch = supabase
      .channel("diag_retalud_frente")
      .on("postgres_changes", { event: "*", schema: "public", table: "producao_frente" }, () => load())
      .subscribe();
    return () => {
      cancel = true;
      clearInterval(t);
      supabase.removeChannel(ch);
    };
  }, []);

  const ultimaData = rows[0]?.data_referencia ? rows[0].data_referencia.split("-").reverse().join("/") : "—";
  const ultimoTurno = rows[0]?.turno ?? "—";
  const temRetalud = rows.some((r) => /retalud/i.test(r.frente || ""));

  return (
    <Card className="border-mining-yellow/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">🪨 DIAGNÓSTICO FRENTES (temporário)</CardTitle>
      </CardHeader>
      <CardContent className="text-xs font-mono space-y-3">
        {erro && <p className="text-mining-red">Erro: {erro}</p>}

        <div className="space-y-1">
          {rows.length === 0 ? (
            <p className="text-muted-foreground">Sem registros em producao_frente.</p>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="flex justify-between gap-2 border-b border-white/5 pb-1">
                <span className="text-foreground uppercase">{r.frente || "(vazio)"}</span>
                <span className="text-muted-foreground">{r.data_referencia ? r.data_referencia.split("-").reverse().join("/") : "—"} · {r.turno}</span>
                <span className="text-mining-blue">{fmt(Number(r.toneladas))} t</span>
              </div>
            ))
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 pt-2 border-t border-white/5">
          <div>
            <div className="text-muted-foreground uppercase">Total de registros</div>
            <div className="text-foreground">{rows.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground uppercase">Retaludamento encontrado</div>
            <div className={temRetalud ? "text-mining-green" : "text-mining-red"}>
              {temRetalud ? "SIM" : "NÃO"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground uppercase">Último turno</div>
            <div className="text-mining-yellow uppercase">{ultimoTurno}</div>
          </div>
          <div>
            <div className="text-muted-foreground uppercase">Última data</div>
            <div className="text-foreground">{ultimaData}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}