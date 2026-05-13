import { Configuration, PopupRequest, BrowserCacheLocation, LogLevel } from "@azure/msal-browser";

const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID || "1c50359e-dcb8-4dd7-9aaf-0935d9ab3cab";
const tenantId = import.meta.env.VITE_MICROSOFT_TENANT_ID || "e0fe3529-0cdf-4ffd-886b-c9b54b0f34d0";

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: typeof window !== "undefined" ? window.location.origin : "/",
    postLogoutRedirectUri: typeof window !== "undefined" ? window.location.origin : "/",

  },
  cache: {
    cacheLocation: BrowserCacheLocation.LocalStorage,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      piiLoggingEnabled: false,
      loggerCallback: () => {},
    },
  },
};

export const loginRequest: PopupRequest = {
  scopes: ["User.Read", "Files.Read.All", "Sites.Read.All"],
};

export const graphScopes = {
  scopes: ["Files.Read.All", "Sites.Read.All"],
};

export const SHAREPOINT_URL =
  import.meta.env.VITE_SHAREPOINT_URL || "https://uemmineracao-my.sharepoint.com";

export const EXCEL_FILE_NAME = "CONTROLE DE PRODUÇÃO.xlsx";

// URLs compartilhadas candidatas da planilha operacional.
// A primeira é a fonte oficial atual; a segunda mantém compatibilidade com o link legado.
const DEFAULT_EXCEL_SHARE_URL =
  "https://uemmineracao-my.sharepoint.com/:x:/r/personal/despacho_ca_uem_com_br/_layouts/15/Doc.aspx?sourcedoc=%7B2CB2F393-A68D-43E7-A9FE-5D59033B0DBD%7D&file=CONTROLE%20DE%20PRODU%C3%87%C3%83O.xlsx&action=default&mobileredirect=true&DefaultItemOpen=1";

const LEGACY_EXCEL_SHARE_URL =
  "https://uemmineracao-my.sharepoint.com/:x:/g/personal/despacho_ca_uem_com_br/IQCT87IsjabnQ6n-XVkDOw29AQyRKhI9W6MDjvgZSG_Mo2o?e=0n59dp";

export const EXCEL_SHARE_URL = import.meta.env.VITE_EXCEL_SHARE_URL || DEFAULT_EXCEL_SHARE_URL;

export const EXCEL_SHARE_URLS = Array.from(
  new Set([EXCEL_SHARE_URL, DEFAULT_EXCEL_SHARE_URL, LEGACY_EXCEL_SHARE_URL].filter(Boolean)),
);
