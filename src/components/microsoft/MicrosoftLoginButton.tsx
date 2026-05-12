import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, Loader2, ExternalLink } from "lucide-react";
import { loginRequest } from "@/auth/msalConfig";
import { useState } from "react";
import { toast } from "sonner";

const LOCAL_EXCEL_STORAGE_KEYS = ["lovable.localExcel.v1", "lovable.localExcel.v2", "lovable.localExcel.v3"];

export function MicrosoftLoginButton() {
  const { instance, accounts } = useMsal();
  const isAuth = useIsAuthenticated();
  const [busy, setBusy] = useState(false);

  const inIframe = typeof window !== "undefined" && window.self !== window.top;
  const PUBLISHED_URL = "https://workload-whisperer-92.lovable.app";
  const isPublishedHost =
    typeof window !== "undefined" && window.location.origin === PUBLISHED_URL;
  const needsRedirect = inIframe || !isPublishedHost;

  const goToPublished = () => {
    const url = `${PUBLISHED_URL}/?mslogin=1`;
    toast.message("Redirecionando para login Microsoft...", {
      description: "Faça login com despacho.ca@uem.com.br",
    });
    // Navegação top-level (sai do iframe do preview) — evita ERR_BLOCKED_BY_RESPONSE
    try {
      if (window.top) {
        window.top.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch {
      // bloqueado pelo iframe? abre em nova aba como fallback
      window.open(url, "_blank");
    }
  };

  const login = async () => {
    if (needsRedirect) {
      goToPublished();
      return;
    }
    setBusy(true);
    try {
      // Sempre usa redirect de página inteira — evita ERR_BLOCKED_BY_RESPONSE em popups
      await instance.loginRedirect(loginRequest);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[msal] erro de login:", msg);
      toast.error("Erro no login Microsoft", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      LOCAL_EXCEL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      await instance.logoutPopup({ postLogoutRedirectUri: window.location.origin, mainWindowRedirectUri: window.location.origin });
    } finally {
      setBusy(false);
    }
  };

  if (isAuth) {
    return (
      <Button variant="outline" size="sm" onClick={logout} disabled={busy} className="gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        <span className="hidden md:inline">{accounts[0]?.username}</span>
        <span className="md:hidden">Sair</span>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={login}
      disabled={busy}
      className="gap-1.5 h-6 px-2 text-[10px] border-mining-indigo/40 text-mining-indigo hover:bg-mining-indigo/10 bg-transparent"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : needsRedirect ? <ExternalLink className="h-3 w-3" /> : <LogIn className="h-3 w-3" />}
      Conectar Microsoft
    </Button>
  );
}
