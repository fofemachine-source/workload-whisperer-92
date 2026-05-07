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
        size="sm"
        onClick={onPick}
        disabled={localLoading}
        className="gap-2 bg-mining-green hover:bg-mining-green/90 text-black font-bold shadow-[0_0_24px_-4px_hsl(var(--mining-green))]"
      >
        {localLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        <span className="hidden sm:inline">Upload Planilha</span>
      </Button>
      {localFile && (
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-mining-green/30 bg-mining-green/5 text-mining-green text-[10px] font-mono">
          <CheckCircle2 className="h-3 w-3" />
          <FileSpreadsheet className="h-3 w-3" />
          <span className="max-w-[180px] truncate">{localFile.name}</span>
          <button
            onClick={clearLocalExcel}
            className="opacity-60 hover:opacity-100 hover:text-mining-red transition"
            title="Remover planilha"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {localError && (
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-mining-red/30 bg-mining-red/5 text-mining-red text-[10px] font-mono">
          <AlertTriangle className="h-3 w-3" />
          Erro de leitura
        </div>
      )}
    </div>
  );
}