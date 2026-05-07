import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, Loader2, ExternalLink } from "lucide-react";
import { loginRequest } from "@/auth/msalConfig";
import { useState } from "react";
import { toast } from "sonner";

export function MicrosoftLoginButton() {
  const { instance, accounts } = useMsal();
  const isAuth = useIsAuthenticated();
  const [busy, setBusy] = useState(false);

  const inIframe = typeof window !== "undefined" && window.self !== window.top;
  const isPreviewHost = typeof window !== "undefined" && /id-preview--/.test(window.location.host);
  const PUBLISHED_URL = "https://workload-whisperer-92.lovable.app";

  const openInNewTab = () => {
    // Sempre abre na URL PUBLICADA (a preview não está registrada como redirectUri no Azure)
    const base = isPreviewHost ? PUBLISHED_URL : window.location.origin;
    const url = `${base}/?mslogin=1`;
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      toast.error("Popup bloqueado pelo navegador", {
        description: "Permita pop-ups deste site ou abra manualmente: " + url,
        duration: 8000,
      });
      // copia URL pra área de transferência se possível
      try { navigator.clipboard?.writeText(url); } catch {}
      return;
    }
    toast.message("Abrindo nova aba para login Microsoft", {
      description: "Faça login com despacho.ca@uem.com.br e volte aqui.",
    });
  };

  const login = async () => {
    if (inIframe) {
      openInNewTab();
      return;
    }
    setBusy(true);
    try {
      try {
        const res = await instance.loginPopup(loginRequest);
        console.log("[msal] login realizado:", res.account?.username);
        toast.success(`Conectado como ${res.account?.username}`);
      } catch (popupErr) {
        const m = popupErr instanceof Error ? popupErr.message : String(popupErr);
        console.warn("[msal] popup falhou, tentando redirect:", m);
        if (/timed_out|popup_window_error|user_cancelled|block/i.test(m)) {
          toast.message("Abrindo login no navegador...", { description: "Você será redirecionado." });
          await instance.loginRedirect(loginRequest);
          return;
        }
        throw popupErr;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[msal] erro de login:", msg);
      if (/redirect_in_iframe/i.test(msg)) {
        openInNewTab();
      } else {
        toast.error("Erro no login Microsoft", { description: msg });
      }
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
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
    <Button size="sm" onClick={login} disabled={busy} className="gap-2 bg-mining-indigo hover:bg-mining-indigo/90">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : inIframe ? <ExternalLink className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
      {inIframe ? "Conectar Microsoft (nova aba)" : "Conectar Microsoft"}
    </Button>
  );
}
