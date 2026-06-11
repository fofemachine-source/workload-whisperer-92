import sql from "mssql";
import "dotenv/config";

const config = {
  server: process.env.SQL_SERVER,
  port: Number(process.env.SQL_PORT ?? 1433),
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: String(process.env.SQL_ENCRYPT ?? "false") === "true",
    trustServerCertificate: String(process.env.SQL_TRUST_SERVER_CERTIFICATE ?? "true") === "true",
    enableArithAbort: true,
  },
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
  requestTimeout: 60000,
  connectionTimeout: 15000,
};

let poolPromise = null;
export function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config).catch((e) => {
      poolPromise = null;
      throw e;
    });
  }
  return poolPromise;
}

export { sql };