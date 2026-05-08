import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startAutoReload } from "./lib/autoReload";

createRoot(document.getElementById("root")!).render(<App />);

// Mantém a TV sempre na versão mais recente publicada
startAutoReload(60_000);
