import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import { loginRequest } from "@/auth/msalConfig";
import { useState } from "react";
import { toast } from "sonner";

export function MicrosoftLoginButton() {
  const { instance, accounts } = useMsal();
  const isAuth = useIsAuthenticated();
  const [busy, setBusy] = useState(false);

  const login = async () => {
    setBusy(true);
    try {
      const res = await instance.loginPopup(loginRequest);
      console.log("[msal] login realizado:", res.account?.username);
      toast.success(`Conectado como ${res.account?.username}`);
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
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
      Conectar Microsoft
    </Button>
  );
}
