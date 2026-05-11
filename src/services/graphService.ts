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

/**
 * Codifica uma URL de compartilhamento do OneDrive/SharePoint no formato
 * "u!<base64url>" exigido pelo endpoint /shares/{shareId}/driveItem do Graph.
 */
export function encodeShareUrl(url: string): string {
  const b64 = typeof window !== "undefined" ? window.btoa(url) : Buffer.from(url).toString("base64");
  return "u!" + b64.replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
}

/**
 * Resolve uma URL de compartilhamento (SharePoint/OneDrive) para um DriveItem
 * completo (com driveId), permitindo acessar planilhas que não estão na
 * conta logada nem em sharedWithMe.
 */
export async function resolveSharedFile(client: Client, shareUrl: string): Promise<DriveItem | null> {
  try {
    const shareId = encodeShareUrl(shareUrl);
    // expand driveItem para já trazer parentReference (driveId)
    const res = await client
      .api(`/shares/${shareId}/driveItem`)
      .select("id,name,webUrl,size,lastModifiedDateTime,parentReference")
      .get();
    return res as DriveItem;
  } catch (err) {
    console.warn("[graph] resolveSharedFile falhou:", err);
    return null;
  }
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
