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
          const result = await msalInstance.ssoSilent({
            ...graphScopes,
            loginHint: account.username,
          });
          if (result.account) {
            msalInstance.setActiveAccount(result.account);
          }
          done(null, result.accessToken);
        } catch (e) {
          const fallback = e instanceof Error ? e : err instanceof Error ? err : new Error("Falha ao renovar sessão Microsoft");
          done(
            new Error(
              /interaction|login|required|consent/i.test(fallback.message)
                ? "Sessão Microsoft expirada. Clique em Conectar Microsoft para retomar a atualização automática."
                : fallback.message,
            ),
            null,
          );
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
  shareId?: string;
}

const normalizeName = (s: string) =>
  (s ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/**
 * Search for a file by name across the user's OneDrive (including SharePoint shared items).
 */
export async function findExcelFile(client: Client, fileName: string): Promise<DriveItem | null> {
  const target = normalizeName(fileName);

  // 1) Direct path lookup at OneDrive root — most reliable when the user owns the file.
  try {
    const direct = await client
      .api(`/me/drive/root:/${encodeURIComponent(fileName)}`)
      .select("id,name,webUrl,size,lastModifiedDateTime,parentReference")
      .get();
    if (direct?.id) {
      console.log("[graph] arquivo encontrado em /me/drive/root:", direct.name);
      return direct as DriveItem;
    }
  } catch (err) {
    console.warn("[graph] direct path lookup falhou (vai cair na busca):", (err as Error)?.message);
  }

  // 2) Search by name and pick only an exact (Unicode-normalized) match.
  try {
    const encoded = encodeURIComponent(`'${fileName}'`);
    const res = await client.api(`/me/drive/root/search(q=${encoded})`).get();
    const list = (res.value ?? []) as DriveItem[];
    const match = list.find((i) => normalizeName(i.name ?? "") === target);
    if (match) {
      console.log("[graph] arquivo encontrado via search exato:", match.name);
      return match;
    }
    // Fallback de busca: contém "controle de produ" e termina com .xlsx
    const loose = list.find((i) => {
      const n = normalizeName(i.name ?? "");
      return n.includes("controle de produ") && n.endsWith(".xlsx");
    });
    if (loose) {
      console.log("[graph] arquivo encontrado via search loose:", loose.name);
      return loose;
    }
    console.warn("[graph] search retornou", list.length, "resultados, nenhum bate com", fileName);
  } catch (err) {
    console.warn("[graph] /me/drive search failed", err);
  }

  // 3) sharedWithMe — para quando a planilha mora em outra conta.
  try {
    const shared = await client.api("/me/drive/sharedWithMe").get();
    const list = (shared.value ?? []) as DriveItem[];
    const match =
      list.find((i) => normalizeName(i.name ?? "") === target) ||
      list.find((i) => normalizeName(i.name ?? "").includes("controle de produ"));
    if (match) {
      console.log("[graph] arquivo encontrado em sharedWithMe:", match.name);
      return match;
    }
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

function getShareUrlCandidates(url: string): string[] {
  const trimmed = url.trim();
  if (!trimmed) return [];
  const withoutQuery = trimmed.split("?")[0];
  return Array.from(new Set([trimmed, withoutQuery]));
}

/**
 * Resolve uma URL de compartilhamento (SharePoint/OneDrive) para um DriveItem
 * completo (com driveId), permitindo acessar planilhas que não estão na
 * conta logada nem em sharedWithMe.
 */
export async function resolveSharedFile(client: Client, shareUrl: string): Promise<DriveItem | null> {
  for (const candidate of getShareUrlCandidates(shareUrl)) {
    try {
      const shareId = encodeShareUrl(candidate);
      const res = await client
        .api(`/shares/${shareId}/driveItem`)
        .select("id,name,webUrl,size,lastModifiedDateTime,parentReference")
        .get();
      console.log("[graph] arquivo resolvido via link compartilhado:", res?.name);
      return { ...(res as DriveItem), shareId };
    } catch (err) {
      console.warn("[graph] resolveSharedFile falhou para candidato:", candidate, err);
    }
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
  shareId?: string,
): Promise<WorksheetInfo[]> {
  const path = shareId
    ? `/shares/${shareId}/driveItem/workbook/worksheets`
    : driveId
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
  shareId?: string,
): Promise<{ values: unknown[][]; address: string; rowCount: number; columnCount: number }> {
  const path = shareId
    ? `/shares/${shareId}/driveItem/workbook/worksheets('${encodeURIComponent(worksheetName)}')/usedRange(valuesOnly=true)`
    : driveId
    ? `/drives/${driveId}/items/${itemId}/workbook/worksheets('${encodeURIComponent(worksheetName)}')/usedRange(valuesOnly=true)`
    : `/me/drive/items/${itemId}/workbook/worksheets('${encodeURIComponent(worksheetName)}')/usedRange(valuesOnly=true)`;
  return await client.api(path).get();
}

/**
 * Baixa o conteúdo binário do arquivo (.xlsx) via Microsoft Graph Drive API.
 * Funciona tanto para arquivos próprios (drives/items) quanto para
 * arquivos compartilhados (shares/{shareId}/driveItem/content).
 */
export async function downloadDriveItemContent(
  client: Client,
  driveId: string,
  itemId: string,
  shareId?: string,
): Promise<ArrayBuffer> {
  const path = shareId
    ? `/shares/${shareId}/driveItem/content`
    : driveId
    ? `/drives/${driveId}/items/${itemId}/content`
    : `/me/drive/items/${itemId}/content`;
  // Cache-bust: o endpoint /content redireciona para uma URL pré-assinada que
  // pode ficar em cache (browser/CDN). Adicionamos um query param volátil e
  // headers no-cache para garantir conteúdo fresco a cada sync.
  const bust = `nocache=${Date.now()}`;
  const pathWithBust = path.includes("?") ? `${path}&${bust}` : `${path}?${bust}`;
  const res = (await client
    .api(pathWithBust)
    .header("Cache-Control", "no-cache, no-store, must-revalidate")
    .header("Pragma", "no-cache")
    .responseType("arraybuffer" as never)
    .get()) as ArrayBuffer | Blob;
  if (res instanceof ArrayBuffer) return res;
  if (res instanceof Blob) return await res.arrayBuffer();
  // Alguns ambientes retornam Uint8Array
  // @ts-expect-error fallback runtime
  if (res?.buffer) return (res as Uint8Array).buffer;
  throw new Error("Resposta inesperada ao baixar conteúdo do arquivo via Graph");
}
