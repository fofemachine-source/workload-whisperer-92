import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Database, Clock, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProducaoDiaria, useSincronizacoes } from "@/hooks/useProducaoDiaria";

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h atrás`;
  return `${Math.floor(h / 24)} d atrás`;
}

export default function IntegracaoStatusPage() {
  const { data: producao, isLoading: lp } = useProducaoDiaria(30);
  const { data: syncs, isLoading: ls } = useSincronizacoes(50);

  const ultima = syncs?.[0];
  const ultimoErro = syncs?.find((s) => s.status === "erro");
  const totalRegistros = producao?.length ?? 0;

  const online =
    ultima && Date.now() - new Date(ultima.finalizado_em).getTime() < 10 * 60 * 1000 && ultima.status !== "erro";

  if (lp || ls) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-2">
              <ArrowLeft className="h-3 w-3" /> Voltar ao painel
            </Link>
            <h1 className="text-2xl font-bold">Status da Integração SSRS</h1>
            <p className="text-sm text-muted-foreground">Saúde da sincronização do agente local com o MineOPS.</p>
          </div>
          <Link to="/admin/ssrs">
            <Button variant="outline" size="sm">Configurar</Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Server className="h-3 w-3" /> AGENTE</div>
              <div className="mt-2 flex items-center gap-2">
                {online ? (
                  <Badge className="bg-mining-green/20 text-mining-green border-mining-green/40">ONLINE</Badge>
                ) : (
                  <Badge className="bg-mining-red/20 text-mining-red border-mining-red/40">OFFLINE</Badge>
                )}
              </div>
              {ultima?.agente_host && (
                <div className="text-[10px] text-muted-foreground mt-1 truncate">{ultima.agente_host}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> ÚLTIMA SYNC</div>
              <div className="mt-2 text-lg font-bold">{ultima ? timeAgo(ultima.finalizado_em) : "—"}</div>
              {ultima && (
                <div className="text-[10px] text-muted-foreground">
                  {new Date(ultima.finalizado_em).toLocaleString("pt-BR")}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Database className="h-3 w-3" /> REGISTROS (30d)</div>
              <div className="mt-2 text-lg font-bold">{totalRegistros}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><XCircle className="h-3 w-3" /> ÚLTIMO ERRO</div>
              <div className="mt-2 text-sm font-bold">
                {ultimoErro ? timeAgo(ultimoErro.finalizado_em) : "Nenhum"}
              </div>
              {ultimoErro?.mensagem_erro && (
                <div className="text-[10px] text-mining-red mt-1 truncate" title={ultimoErro.mensagem_erro}>
                  {ultimoErro.mensagem_erro}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de sincronizações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {(syncs ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma sincronização registrada ainda. Inicie o agente local — instruções na documentação.
                </p>
              )}
              {(syncs ?? []).map((s) => (
                <div key={s.id} className="flex items-center justify-between border-b border-border/40 py-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {s.status === "sucesso" ? (
                      <CheckCircle2 className="h-4 w-4 text-mining-green shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-mining-red shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-mono">{s.relatorio}</div>
                      {s.mensagem_erro && (
                        <div className="text-mining-red truncate" title={s.mensagem_erro}>{s.mensagem_erro}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="font-mono">{s.registros_recebidos} reg · {s.duracao_ms ?? 0}ms</div>
                    <div className="text-muted-foreground">{new Date(s.finalizado_em).toLocaleString("pt-BR")}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}