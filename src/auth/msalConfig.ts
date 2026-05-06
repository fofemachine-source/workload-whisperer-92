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
    // Avoid hidden-iframe silent auth — Microsoft blocks login.microsoftonline.com inside iframes (ERR_BLOCKED_BY_RESPONSE)
    windowHashTimeout: 60000,
    iframeHashTimeout: 6000,
    loadFrameTimeout: 0,
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
