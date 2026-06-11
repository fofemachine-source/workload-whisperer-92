import { Service } from "node-windows";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svc = new Service({
  name: "MineOPS SQL Server Agent",
  description: "Sincroniza dados do SQL Server MineOPS com a Lovable Cloud",
  script: path.resolve(__dirname, "..", "src", "index.js"),
  workingDirectory: path.resolve(__dirname, ".."),
});
svc.on("install", () => { console.log("Serviço instalado, iniciando..."); svc.start(); });
svc.on("alreadyinstalled", () => console.log("Já instalado."));
svc.install();