import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface FrenteRow {
  id: string;
  data_referencia: string;
  turno: string;
  frente: string;
  toneladas: number;
  relatorio_origem?: string;
  atualizado_em?: string;
  created_at?: string;
}

const fmt = (n: number) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export default function FrentesBrutas() {
  const [rows, setRows] = useState<FrenteRow[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<string>("");

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      setCarregando(true);
      const res = await supabase
        .from("producao_frente")
        .select("*")
        .order("data_referencia", { ascending: false });

      // eslint-disable-next-line no-console
      console.log("[FRENTES BRUTAS] producao_frente raw", res);

      if (cancel) return;
      if (res.error) {
        setErro(res.error.message);
      } else {
        const dados = (res.data ?? []) as FrenteRow[];
        setRows(dados);
        setAtualizadoEm(new Date().toLocaleTimeString("pt-BR"));
      }
      setCarregando(false);
    };

    load();

    const t = setInterval(load, 30_000);

    const ch = supabase
      .channel("frentes_brutas")
      .on("postgres_changes", { event: "*", schema: "public", table: "producao_frente" }, () => load())
      .subscribe();

    return () => {
      cancel = true;
      clearInterval(t);
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <Card className="border-mining-yellow/40">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">📋 FRENTES BRUTAS (temporário)</CardTitle>
        <div className="flex items-center gap-2">
          {carregando && <Badge variant="outline" className="text-xs animate-pulse">atualizando…</Badge>}
          {atualizadoEm && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              sinc: {atualizadoEm}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="text-xs font-mono space-y-3">
        {erro && <p className="text-mining-red">Erro: {erro}</p>}

        {rows.length === 0 && !carregando ? (
          <p className="text-muted-foreground">Sem registros em producao_frente.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-muted-foreground border-b border-white/10 text-left">
                  <th className="py-1 pr-4">data_referencia</th>
                  <th className="py-1 pr-4">turno</th>
                  <th className="py-1 pr-4">frente</th>
                  <th className="py-1 pr-4 text-right">toneladas</th>
                  <th className="py-1 pr-4">origem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-1 pr-4 text-foreground">{r.data_referencia || "—"}</td>
                    <td className="py-1 pr-4 text-mining-yellow uppercase">{r.turno || "—"}</td>
                    <td className="py-1 pr-4 text-foreground uppercase">{r.frente || "(vazio)"}</td>
                    <td className="py-1 pr-4 text-right text-mining-blue">{fmt(Number(r.toneladas))} t</td>
                    <td className="py-1 pr-4 text-muted-foreground">{r.relatorio_origem || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pt-2 border-t border-white/5 text-muted-foreground">
          Total de registros: <span className="text-foreground font-bold">{rows.length}</span>
        </div>
      </CardContent>
    </Card>
  );
}
