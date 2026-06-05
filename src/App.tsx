import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { PublicClientApplication, EventType } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { msalConfig } from "@/auth/msalConfig";
import { ExcelLiveProvider } from "@/context/ExcelLiveContext";
import { isMicrosoftAuthSupported } from "@/lib/browserSupport";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import SsrsConfigPage from "./pages/admin/SsrsConfigPage";
import IntegracaoStatusPage from "./pages/admin/IntegracaoStatusPage";

const queryClient = new QueryClient();
const msalSupported = isMicrosoftAuthSupported();
const msalInstance = msalSupported ? new PublicClientApplication(msalConfig) : null;
let msalInitPromise: Promise<boolean> | null = null;
let msalEventBound = false;

async function initializeMsal() {
  if (!msalInstance) return false;

  try {
    await msalInstance.initialize();
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

    if (!msalEventBound) {
      msalInstance.addEventCallback((event) => {
        if (event.eventType === EventType.LOGIN_SUCCESS && (event.payload as { account?: unknown })?.account) {
          msalInstance.setActiveAccount((event.payload as { account: Parameters<typeof msalInstance.setActiveAccount>[0] }).account);
        }
      });
      msalEventBound = true;
    }

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

    return true;
  } catch (e) {
    console.error("[msal] inicialização indisponível neste navegador:", e);
    return false;
  }
}

if (!msalInstance) {
  console.warn("[msal] desabilitado neste navegador por compatibilidade");
}

function AppBootScreen() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="flex items-center gap-3 text-sm md:text-base">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div>
          <p className="font-medium">Carregando painel...</p>
          <p className="text-muted-foreground">Preparando o acesso Microsoft com segurança.</p>
        </div>
      </div>
    </div>
  );
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
            <Route path="/admin/ssrs" element={<SsrsConfigPage />} />
            <Route path="/admin/integracao" element={<IntegracaoStatusPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ExcelLiveProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

const App = () => {
  const [msalReady, setMsalReady] = useState(!msalInstance);
  const [msalEnabled, setMsalEnabled] = useState(Boolean(msalInstance));

  useEffect(() => {
    let active = true;

    if (!msalInstance) return;

    if (!msalInitPromise) {
      msalInitPromise = initializeMsal();
    }

    void msalInitPromise.then((ok) => {
      if (!active) return;
      setMsalEnabled(ok);
      setMsalReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  if (!msalReady) return <AppBootScreen />;

  return msalEnabled && msalInstance ? (
    <MsalProvider instance={msalInstance}>
      <AppContent />
    </MsalProvider>
  ) : (
    <AppContent />
  );
};

export default App;
