import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Modo TV/Kiosk: detecta telas grandes e adiciona classe para reduzir
// animações, sombras e blur (alivia GPU em Smart TVs antigas).
function applyTvMode() {
  if (typeof window === "undefined") return;
  const isTv = window.innerWidth >= 1920;
  document.documentElement.classList.toggle("tv-mode", isTv);
}
if (typeof window !== "undefined") {
  applyTvMode();
  window.addEventListener("resize", applyTvMode);
}

// Patch defensivo contra extensões (Google Tradutor, etc.) que removem nós do DOM
// e fazem o React quebrar com NotFoundError em removeChild/insertBefore.
if (typeof Node !== "undefined") {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      console.warn("[dom-guard] removeChild ignorado (nó já removido)");
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  } as typeof Node.prototype.removeChild;

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      console.warn("[dom-guard] insertBefore -> appendChild fallback");
      return this.appendChild(newNode) as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  } as typeof Node.prototype.insertBefore;
}

createRoot(document.getElementById("root")!).render(<App />);
