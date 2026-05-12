import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startAutoReload } from "./lib/autoReload";

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

// Mantém a TV sempre na versão mais recente publicada
startAutoReload(60_000);
