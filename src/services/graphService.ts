import { Client } from "@microsoft/microsoft-graph-client";
import { IPublicClientApplication, AccountInfo } from "@azure/msal-browser";
import { graphScopes } from "@/auth/msalConfig";

export function createGraphClient(msalInstance: IPublicClientApplication, account: AccountInfo): Client {
  return Client.init({
    authProvider: async (done) => {
      try {
        const result = await msalInstance.acquireTokenSilent({ ...graphScopes, account });
        done(null, result.accessToken);
      } catch (err) {
        try {
          const result = await msalInstance.acquireTokenPopup(graphScopes);
          done(null, result.accessToken);
        } catch (e) {
          done(e as Error, null);
        }
      }
    },
  });
}

export interface DriveItem {
  id: string;
  name: string;
  webUrl?: string;
  parentReference?: { driveId?: string; path?: string };
  size?: number;
  lastModifiedDateTime?: string;
}

/**
 * Search for a file by name across the user's OneDrive (including SharePoint shared items).
 */
export async function findExcelFile(client: Client, fileName: string): Promise<DriveItem | null> {
  // Strategy: search /me/drive first, then sharedWithMe
  const encoded = encodeURIComponent(`'${fileName}'`);
  try {
    const res = await client.api(`/me/drive/root/search(q=${encoded})`).get();
    const match = (res.value as DriveItem[]).find(
      (i) => i.name?.toLowerCase() === fileName.toLowerCase(),
    );
    if (match) return match;
    if (res.value?.length) return res.value[0] as DriveItem;
  } catch (err) {
    console.warn("[graph] /me/drive search failed", err);
  }

  try {
    const shared = await client.api("/me/drive/sharedWithMe").get();
    const match = (shared.value as DriveItem[]).find((i) =>
      i.name?.toLowerCase().includes("controle de produ"),
    );
    if (match) return match;
  } catch (err) {
    console.warn("[graph] sharedWithMe failed", err);
  }

  return null;
}

export interface WorksheetInfo {
  id: string;
  name: string;
  position: number;
  visibility: string;
}

export async function listWorksheets(
  client: Client,
  driveId: string,
  itemId: string,
): Promise<WorksheetInfo[]> {
  const path = driveId
    ? `/drives/${driveId}/items/${itemId}/workbook/worksheets`
    : `/me/drive/items/${itemId}/workbook/worksheets`;
  const res = await client.api(path).get();
  return res.value as WorksheetInfo[];
}

export async function getUsedRange(
  client: Client,
  driveId: string,
  itemId: string,
  worksheetName: string,
): Promise<{ values: unknown[][]; address: string; rowCount: number; columnCount: number }> {
  const path = driveId
    ? `/drives/${driveId}/items/${itemId}/workbook/worksheets('${encodeURIComponent(worksheetName)}')/usedRange(valuesOnly=true)`
    : `/me/drive/items/${itemId}/workbook/worksheets('${encodeURIComponent(worksheetName)}')/usedRange(valuesOnly=true)`;
  return await client.api(path).get();
}
