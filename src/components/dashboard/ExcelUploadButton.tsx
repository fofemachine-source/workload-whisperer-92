import { useRef } from "react";
import { Upload, FileSpreadsheet, Loader2, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExcelLive } from "@/context/ExcelLiveContext";
import { toast } from "sonner";

export function ExcelUploadButton() {
  const { uploadLocalExcel, clearLocalExcel, localFile, localLoading, localError } = useExcelLive();
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/\.xlsx?$/i.test(file.name)) {
      toast.error("Arquivo inválido", { description: "Envie uma planilha .xlsx ou .xls" });
      return;
    }
    try {
      await uploadLocalExcel(file);
      toast.success("Planilha carregada", { description: file.name });
    } catch (err) {
      toast.error("Erro de leitura", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={onFile}
        className="hidden"
      />
      <Button
        variant="outline"
        onClick={onPick}
        disabled={localLoading}
        className="gap-1.5 h-6 px-2 text-[10px] border-mining-green/40 text-mining-green hover:bg-mining-green/10 bg-transparent"
      >
        {localLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
        <span className="hidden sm:inline">Upload Planilha</span>
      </Button>
      {localError && (
        <div
          title={localError}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-mining-red/40 bg-mining-red/10 text-mining-red text-[10px] font-mono max-w-[420px]"
        >
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span className="truncate">{localError}</span>
        </div>
      )}
    </div>
  );
}