import { useEffect, useState, useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { createGraphClient, findExcelFile, listWorksheets, DriveItem, WorksheetInfo } from "@/services/graphService";
import { EXCEL_FILE_NAME } from "@/auth/msalConfig";

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

  const load = useCallback(async () => {
    if (!enabled || accounts.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const client = createGraphClient(instance, accounts[0]);
      console.log("[graph] procurando arquivo:", EXCEL_FILE_NAME);
      const found = await findExcelFile(client, EXCEL_FILE_NAME);
      if (!found) {
        throw new Error(`Arquivo "${EXCEL_FILE_NAME}" não encontrado no OneDrive nem em itens compartilhados.`);
      }
      console.log("[graph] arquivo encontrado:", found.name, found.webUrl);
      setFile(found);

      const driveId = found.parentReference?.driveId ?? "";
      const sheets = await listWorksheets(client, driveId, found.id);
      console.log("[graph] worksheets:", sheets.map((s) => s.name));
      setWorksheets(sheets);
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
  }, [load]);

  return { loading, error, file, worksheets, refresh: load };
}
