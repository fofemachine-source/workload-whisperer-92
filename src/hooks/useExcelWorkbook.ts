import { useEffect, useState, useCallback, useRef } from "react";
import { useMsal } from "@azure/msal-react";
import * as XLSX from "xlsx";
import {
  createGraphClient,
  findExcelFile,
  resolveSharedFile,
  downloadDriveItemContent,
  DriveItem,
  WorksheetInfo,
} from "@/services/graphService";
import { EXCEL_FILE_NAME, EXCEL_SHARE_URLS } from "@/auth/msalConfig";
import { SheetValues } from "@/services/excelParser";

// Atualização automática a cada 30 segundos para refletir edições recentes na planilha.
const FILE_POLL_MS = 30_000;
// Tempo máximo de uma sincronização antes de considerar travada e liberar o lock.
const SYNC_WATCHDOG_MS = 45_000;

export interface ExcelWorkbookState {
  loading: boolean;
  error: string | null;
  file: DriveItem | null;
  worksheets: WorksheetInfo[];
  sheetValues: SheetValues[];
  lastSyncMs: number | null;
  lastSyncAt: Date | null;
  hasLoadedOnce: boolean;
  refresh: () => Promise<void>;
}

function parseWorkbookBuffer(buffer: ArrayBuffer): { sheets: SheetValues[]; names: string[] } {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheets: SheetValues[] = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const values = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: "",
      raw: true,
      blankrows: false,
    }) as unknown[][];
    return { name, values };
  });
  return { sheets, names: wb.SheetNames };
}

export function useExcelWorkbook(enabled: boolean): ExcelWorkbookState {
  const { instance, accounts } = useMsal();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<DriveItem | null>(null);
  const [worksheets, setWorksheets] = useState<WorksheetInfo[]>([]);
  const [sheetValues, setSheetValues] = useState<SheetValues[]>([]);
  const [lastSyncMs, setLastSyncMs] = useState<number | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const timer = useRef<number | null>(null);
  const inFlight = useRef(false);
  const inFlightStartedAt = useRef<number>(0);
  const account = accounts[0] ?? instance.getActiveAccount() ?? instance.getAllAccounts()[0] ?? null;

  const load = useCallback(async () => {
    if (!enabled || !account) return;
    // Watchdog: se um sync anterior travou (>45s), libera o lock para permitir nova tentativa.
    if (inFlight.current) {
      const elapsed = performance.now() - inFlightStartedAt.current;
      if (elapsed < SYNC_WATCHDOG_MS) return;
      console.warn(`[ExcelLive] sync anterior travado há ${Math.round(elapsed)}ms — forçando nova tentativa`);
    }
    inFlight.current = true;
    inFlightStartedAt.current = performance.now();
    setLoading(true);
    setError(null);
    const startedAt = performance.now();
    try {
      const client = createGraphClient(instance, account);

      // 1) Resolve metadados do arquivo: prioriza o link compartilhado oficial
      //    (planilha mora em outra conta) e usa busca em /me/drive como fallback.
      let resolved: DriveItem | null = null;
      for (const shareUrl of EXCEL_SHARE_URLS) {
        if (resolved) break;
        try {
          resolved = await resolveSharedFile(client, shareUrl);
        } catch (err) {
          console.warn("[graph] resolveSharedFile falhou:", shareUrl, (err as Error)?.message);
        }
      }
      if (!resolved) {
        resolved = await findExcelFile(client, EXCEL_FILE_NAME);
      }
      if (!resolved) {
        throw new Error(
          `Arquivo "${EXCEL_FILE_NAME}" não encontrado no OneDrive nem via link compartilhado.`,
        );
      }

      // 2) Baixa o conteúdo binário (.xlsx) via Drive API — sem usar
      //    /workbook/worksheets, que não funciona em planilhas compartilhadas
      //    fora da conta logada.
      const driveId = resolved.parentReference?.driveId ?? "";
      const buffer = await downloadDriveItemContent(client, driveId, resolved.id, resolved.shareId);
      const { sheets, names } = parseWorkbookBuffer(buffer);

      const synthesizedWorksheets: WorksheetInfo[] = names.map((name, idx) => ({
        id: `local-${idx}`,
        name,
        position: idx,
        visibility: "Visible",
      }));

      setFile((prev) =>
        prev && prev.id === resolved!.id && prev.lastModifiedDateTime === resolved!.lastModifiedDateTime
          ? prev
          : resolved!,
      );
      setWorksheets(synthesizedWorksheets);
      setSheetValues(sheets);

      const durationMs = Math.round(performance.now() - startedAt);
      setLastSyncMs(durationMs);
      setLastSyncAt(new Date());
      console.log(
        "[ExcelLive] fonte ativa: ONEDRIVE",
        resolved.name,
        `(${names.length} aba(s)) lastModified=${resolved.lastModifiedDateTime ?? "?"}`,
      );
      console.log(`[ExcelLive] sincronização concluída em ${durationMs}ms`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[graph] erro ao baixar/parsear workbook:", msg);
      setError(msg);
    } finally {
      inFlight.current = false;
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }, [enabled, instance, account]);

  useEffect(() => {
    void load();
    if (timer.current) window.clearInterval(timer.current);
    if (enabled) {
      timer.current = window.setInterval(() => {
        void load();
      }, FILE_POLL_MS);
    }
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, enabled]);

  return { loading, error, file, worksheets, sheetValues, lastSyncMs, lastSyncAt, hasLoadedOnce, refresh: load };
}
