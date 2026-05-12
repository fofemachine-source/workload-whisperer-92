import { useEffect, useState, useCallback, useRef } from "react";
import { useMsal } from "@azure/msal-react";
import { createGraphClient, findExcelFile, resolveSharedFile, listWorksheets, DriveItem, WorksheetInfo } from "@/services/graphService";
import { EXCEL_FILE_NAME, EXCEL_SHARE_URL } from "@/auth/msalConfig";

const FILE_POLL_MS = 30_000;

export interface ExcelWorkbookState {
  loading: boolean;
  error: string | null;
  file: DriveItem | null;
  worksheets: WorksheetInfo[];
  refresh: () => Promise<void>;
}

export function useExcelWorkbook(enabled: boolean): ExcelWorkbookState {
  const { instance, accounts } = useMsal();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<DriveItem | null>(null);
  const [worksheets, setWorksheets] = useState<WorksheetInfo[]>([]);
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!enabled || accounts.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const client = createGraphClient(instance, accounts[0]);
      let found = await findExcelFile(client, EXCEL_FILE_NAME);
      const tryListSheets = async (item: typeof found) => {
        if (!item) throw new Error("Arquivo nulo");
        const driveId = item.parentReference?.driveId ?? "";
        return await listWorksheets(client, driveId, item.id);
      };
      let sheets: Awaited<ReturnType<typeof listWorksheets>> | null = null;
      if (found) {
        try {
          sheets = await tryListSheets(found);
        } catch (err) {
          console.warn("[graph] listWorksheets falhou para o item encontrado, tentando link compartilhado…", (err as Error)?.message);
          found = null;
        }
      }
      if (!found && EXCEL_SHARE_URL) {
        console.log("[graph] tentando resolver via URL de compartilhamento…");
        found = await resolveSharedFile(client, EXCEL_SHARE_URL);
        if (found) sheets = await tryListSheets(found);
      }
      if (!found || !sheets) {
        throw new Error(
          `Arquivo "${EXCEL_FILE_NAME}" não encontrado no OneDrive da conta logada nem via link compartilhado.`,
        );
      }
      const resolvedFound = found;
      setFile((prev) => {
        if (prev && prev.id === resolvedFound.id && prev.lastModifiedDateTime === resolvedFound.lastModifiedDateTime) {
          return prev;
        }
        console.log("[graph] arquivo:", resolvedFound.name, "modified:", resolvedFound.lastModifiedDateTime);
        return resolvedFound;
      });
      const finalSheets = sheets;
      setWorksheets((prev) => {
        if (prev.length === finalSheets.length && prev.every((p, i) => p.id === finalSheets[i].id && p.name === finalSheets[i].name)) {
          return prev;
        }
        return finalSheets;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[graph] erro:", msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [enabled, instance, accounts]);

  useEffect(() => {
    load();
    if (timer.current) window.clearInterval(timer.current);
    if (enabled) {
      timer.current = window.setInterval(() => {
        if (document.visibilityState === "visible") load();
      }, FILE_POLL_MS);
    }
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, enabled]);

  return { loading, error, file, worksheets, refresh: load };
}
