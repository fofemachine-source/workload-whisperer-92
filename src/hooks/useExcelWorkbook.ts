import { useEffect, useState, useCallback, useRef } from "react";
import { useMsal } from "@azure/msal-react";
import { createGraphClient, findExcelFile, listWorksheets, DriveItem, WorksheetInfo } from "@/services/graphService";
import { EXCEL_FILE_NAME } from "@/auth/msalConfig";

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
      const found = await findExcelFile(client, EXCEL_FILE_NAME);
      if (!found) {
        throw new Error(`Arquivo "${EXCEL_FILE_NAME}" não encontrado no OneDrive nem em itens compartilhados.`);
      }
      setFile((prev) => {
        if (prev && prev.id === found.id && prev.lastModifiedDateTime === found.lastModifiedDateTime) {
          return prev;
        }
        console.log("[graph] arquivo:", found.name, "modified:", found.lastModifiedDateTime);
        return found;
      });

      const driveId = found.parentReference?.driveId ?? "";
      const sheets = await listWorksheets(client, driveId, found.id);
      setWorksheets((prev) => {
        if (prev.length === sheets.length && prev.every((p, i) => p.id === sheets[i].id && p.name === sheets[i].name)) {
          return prev;
        }
        return sheets;
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
