// Auto-reload: monitora mudanças no build (index.html) e recarrega a TV
// automaticamente quando uma nova versão do site for publicada.

async function fetchIndexHash(): Promise<string | null> {
  try {
    const res = await fetch(`/?_v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const text = await res.text();
    // Extrai apenas as referências de scripts/css (que mudam de hash a cada build)
    const match = text.match(/<script[^>]*src="[^"]+"[^>]*>|<link[^>]*href="[^"]+\.css"[^>]*>/g);
    return match ? match.join("|") : text.length.toString();
  } catch {
    return null;
  }
}

export function startAutoReload(intervalMs = 60_000) {
  if (typeof window === "undefined") return;
  if (import.meta.env.DEV) return; // só em produção

  let baseline: string | null = null;

  const tick = async () => {
    const current = await fetchIndexHash();
    if (!current) return;
    if (baseline === null) {
      baseline = current;
      return;
    }
    if (current !== baseline) {
      console.log("[autoReload] nova versão detectada — recarregando…");
      window.location.reload();
    }
  };

  // primeira leitura imediata para fixar baseline
  tick();
  setInterval(tick, intervalMs);

  // também recarrega quando a aba volta a ficar visível depois de muito tempo
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tick();
  });
}