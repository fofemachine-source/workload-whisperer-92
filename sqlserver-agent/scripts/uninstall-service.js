import { Service } from "node-windows";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svc = new Service({
  name: "MineOPS SQL Server Agent",
  script: path.resolve(__dirname, "..", "src", "index.js"),
});
svc.on("uninstall", () => console.log("Desinstalado."));
svc.uninstall();