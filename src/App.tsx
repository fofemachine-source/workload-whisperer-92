import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { PublicClientApplication, EventType } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { msalConfig } from "@/auth/msalConfig";
import { ExcelLiveProvider } from "@/context/ExcelLiveContext";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();
const msalInstance = new PublicClientApplication(msalConfig);
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
});

const App = () => (
  <MsalProvider instance={msalInstance}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ExcelLiveProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ExcelLiveProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </MsalProvider>
);

export default App;
