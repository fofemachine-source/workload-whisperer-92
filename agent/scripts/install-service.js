import { Service } from "node-windows";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const svc = new Service({
  name: "MineOPS SSRS Agent",
  description: "Sincroniza relatórios do SSRS MineOPS com a Lovable Cloud",
  script: path.resolve(__dirname, "..", "src", "index.js"),
  nodeOptions: [],
  workingDirectory: path.resolve(__dirname, ".."),
});

svc.on("install", () => {
  console.log("Serviço instalado. Iniciando...");
  svc.start();
});
svc.on("alreadyinstalled", () => console.log("Serviço já estava instalado."));
svc.on("start", () => console.log("Serviço MineOPS SSRS Agent iniciado."));
svc.install();