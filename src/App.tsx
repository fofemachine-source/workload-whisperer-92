import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { PublicClientApplication, EventType } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { msalConfig } from "@/auth/msalConfig";
import { ExcelLiveProvider } from "@/context/ExcelLiveContext";
import { isMicrosoftAuthSupported } from "@/lib/browserSupport";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();
const msalSupported = isMicrosoftAuthSupported();
const msalInstance = msalSupported ? new PublicClientApplication(msalConfig) : null;

if (msalInstance) {
  msalInstance.initialize().then(async () => {
    try {
      const redirectRes = await msalInstance.handleRedirectPromise();
      if (redirectRes?.account) {
        msalInstance.setActiveAccount(redirectRes.account);
        console.log("[msal] login via redirect:", redirectRes.account.username);
      }
    } catch (e) {
      console.error("[msal] handleRedirectPromise erro:", e);
    }
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) msalInstance.setActiveAccount(accounts[0]);
    msalInstance.addEventCallback((event) => {
      if (event.eventType === EventType.LOGIN_SUCCESS && (event.payload as { account?: unknown })?.account) {
        msalInstance.setActiveAccount((event.payload as { account: Parameters<typeof msalInstance.setActiveAccount>[0] }).account);
      }
    });
    try {
      const params = new URLSearchParams(window.location.search);
      const inIframe = window.self !== window.top;
      if (params.get("mslogin") === "1" && !inIframe && msalInstance.getAllAccounts().length === 0) {
        const { loginRequest } = await import("@/auth/msalConfig");
        await msalInstance.loginRedirect(loginRequest);
      }
    } catch (e) {
      console.error("[msal] auto-login erro:", e);
    }
  }).catch((e) => {
    console.error("[msal] inicialização indisponível neste navegador:", e);
  });
} else {
  console.warn("[msal] desabilitado neste navegador por compatibilidade");
}

const AppContent = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ExcelLiveProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ExcelLiveProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

const App = () => (msalInstance ? <MsalProvider instance={msalInstance}><AppContent /></MsalProvider> : <AppContent />);

export default App;
