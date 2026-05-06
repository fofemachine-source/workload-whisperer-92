import { useExcelLive } from "@/context/ExcelLiveContext";
import { FileSpreadsheet, AlertTriangle, RefreshCw, Loader2, ExternalLink, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function ExcelDiscoveryPanel() {
  const { isAuth, workbookLoading: loading, workbookError: error, file, worksheets, refreshWorkbook: refresh } = useExcelLive();

  if (!isAuth) {
    return (
      <div className="bg-card rounded-lg border border-border p-5">
        <div className="flex items-center gap-2 mb-2">
          <FileSpreadsheet className="h-4 w-4 text-mining-indigo" />
          <h3 className="text-sm font-semibold text-foreground">Integração Microsoft Excel</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Conecte sua conta Microsoft para localizar automaticamente o arquivo
          <span className="font-mono text-foreground"> CONTROLE DE PRODUÇÃO.xlsx</span> no OneDrive/SharePoint.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-lg border border-border p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-mining-green" />
          <h3 className="text-sm font-semibold text-foreground">Workbook OneDrive</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Atualizar
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Localizando arquivo no OneDrive...
        </div>
      )}

      {error && !loading && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-mining-red/10 border border-mining-red/20">
          <AlertTriangle className="h-4 w-4 text-mining-red mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-mining-red">Não foi possível ler o Excel</p>
            <p className="text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      )}

      {file && !loading && !error && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-md bg-mining-surface border border-border">
            <div>
              <p className="text-sm font-mono text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {worksheets.length} aba(s) · atualizado{" "}
                {file.lastModifiedDateTime
                  ? new Date(file.lastModifiedDateTime).toLocaleString("pt-BR")
                  : "—"}
              </p>
            </div>
            {file.webUrl && (
              <Button variant="outline" size="sm" asChild className="gap-2">
                <a href={file.webUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir
                </a>
              </Button>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground uppercase tracking-wider">
              <Layers className="h-3.5 w-3.5" />
              Abas detectadas
            </div>
            <div className="flex flex-wrap gap-1.5">
              {worksheets.map((w) => (
                <span
                  key={w.id}
                  className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-mining-indigo/10 text-mining-indigo border border-mining-indigo/20"
                >
                  {w.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
