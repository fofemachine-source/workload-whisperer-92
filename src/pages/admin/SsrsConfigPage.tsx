import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, Trash2, Copy, ArrowLeft, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface SsrsConfig {
  id: string;
  ssrs_url: string;
  ssrs_username: string | null;
  caminho_relatorio: string;
  intervalo_sync_segundos: number;
  ativo: boolean;
  observacoes: string | null;
}

interface AgenteToken {
  id: string;
  nome: string;
  token_prefix: string;
  ativo: boolean;
  ultimo_uso_em: string | null;
  created_at: string;
  revogado_em: string | null;
}

export default function SsrsConfigPage() {
  const [config, setConfig] = useState<SsrsConfig | null>(null);
  const [tokens, setTokens] = useState<AgenteToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [creatingToken, setCreatingToken] = useState(false);
  const [revealToken, setRevealToken] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: cfg }, { data: tks }] = await Promise.all([
      supabase.from("ssrs_config").select("*").order("created_at", { ascending: true }).limit(1).maybeSingle(),
      supabase.from("agente_tokens").select("*").order("created_at", { ascending: false }),
    ]);
    setConfig(cfg as SsrsConfig | null);
    setTokens((tks ?? []) as AgenteToken[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase
      .from("ssrs_config")
      .update({
        ssrs_url: config.ssrs_url,
        ssrs_username: config.ssrs_username,
        caminho_relatorio: config.caminho_relatorio,
        intervalo_sync_segundos: config.intervalo_sync_segundos,
        ativo: config.ativo,
        observacoes: config.observacoes,
      })
      .eq("id", config.id);
    setSaving(false);
    if (error) toast.error("Erro ao salvar", { description: error.message });
    else toast.success("Configuração salva");
  };

  const createToken = async () => {
    if (!newTokenName.trim()) {
      toast.error("Informe um nome para o agente");
      return;
    }
    setCreatingToken(true);
    try {
      const { data, error } = await supabase.functions.invoke("agente-token-create", {
        body: { nome: newTokenName.trim() },
      });
      if (error) throw error;
      setRevealToken((data as { token: string }).token);
      setNewTokenName("");
      await load();
    } catch (e) {
      toast.error("Falha ao criar token", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setCreatingToken(false);
    }
  };

  const revoke = async (id: string) => {
    const { error } = await supabase
      .from("agente_tokens")
      .update({ ativo: false, revogado_em: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error("Erro ao revogar");
    else {
      toast.success("Token revogado");
      load();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-2">
              <ArrowLeft className="h-3 w-3" /> Voltar ao painel
            </Link>
            <h1 className="text-2xl font-bold">Configuração SSRS · MineOPS</h1>
            <p className="text-sm text-muted-foreground">Endpoint do agente local e tokens de autenticação.</p>
          </div>
          <Link to="/admin/integracao">
            <Button variant="outline" size="sm">Ver status</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Servidor SSRS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {config && (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>URL do ReportServer</Label>
                    <Input
                      value={config.ssrs_url}
                      onChange={(e) => setConfig({ ...config, ssrs_url: e.target.value })}
                      placeholder="http://192.168.17.15/ReportServer"
                    />
                  </div>
                  <div>
                    <Label>Usuário (somente leitura, para referência)</Label>
                    <Input
                      value={config.ssrs_username ?? ""}
                      onChange={(e) => setConfig({ ...config, ssrs_username: e.target.value })}
                      placeholder="DOMINIO\\usuario"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Caminho do relatório</Label>
                    <Input
                      value={config.caminho_relatorio}
                      onChange={(e) => setConfig({ ...config, caminho_relatorio: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Intervalo de sincronização (segundos)</Label>
                    <Input
                      type="number"
                      min={60}
                      value={config.intervalo_sync_segundos}
                      onChange={(e) => setConfig({ ...config, intervalo_sync_segundos: Number(e.target.value) || 300 })}
                    />
                  </div>
                  <div className="flex items-end">
                    <Label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.ativo}
                        onChange={(e) => setConfig({ ...config, ativo: e.target.checked })}
                      />
                      Integração ativa
                    </Label>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Observações</Label>
                    <Textarea
                      value={config.observacoes ?? ""}
                      onChange={(e) => setConfig({ ...config, observacoes: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  A <strong>senha</strong> do SSRS fica apenas no arquivo <code>.env</code> do agente local — nunca trafega pelo navegador.
                </p>
                <Button onClick={saveConfig} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar configuração
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Tokens do Agente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nome (ex: agente-servidor-mina-01)"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
              />
              <Button onClick={createToken} disabled={creatingToken}>
                {creatingToken ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Gerar token
              </Button>
            </div>

            {revealToken && (
              <div className="border border-mining-yellow/40 bg-mining-yellow/5 p-3 rounded-md space-y-2">
                <p className="text-xs font-semibold text-mining-yellow">
                  Copie este token AGORA. Ele não será exibido novamente.
                </p>
                <div className="flex gap-2">
                  <code className="flex-1 bg-black/40 p-2 rounded text-xs break-all">{revealToken}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(revealToken);
                      toast.success("Copiado");
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setRevealToken(null)}>
                  Esconder
                </Button>
              </div>
            )}

            <div className="space-y-2">
              {tokens.length === 0 && <p className="text-sm text-muted-foreground">Nenhum token gerado.</p>}
              {tokens.map((t) => (
                <div key={t.id} className="flex items-center justify-between border border-border rounded-md p-3">
                  <div className="text-sm">
                    <div className="font-medium">{t.nome}</div>
                    <div className="text-xs font-mono text-muted-foreground">
                      {t.token_prefix}…
                      {t.ultimo_uso_em && (
                        <> · usado em {new Date(t.ultimo_uso_em).toLocaleString("pt-BR")}</>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.ativo ? (
                      <Badge variant="outline" className="border-mining-green/40 text-mining-green">ativo</Badge>
                    ) : (
                      <Badge variant="outline" className="border-mining-red/40 text-mining-red">revogado</Badge>
                    )}
                    {t.ativo && (
                      <Button size="sm" variant="ghost" onClick={() => revoke(t.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
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