// Abre la app sobre la base de demostración (puerto 3001), sin tocar tus datos reales.
import { spawn } from "node:child_process";
import path from "node:path";
const env = { ...process.env, PGLITE_DIR: path.join(process.cwd(), "data", "demo"), EVIDENCE_DIR: path.join(process.cwd(), "data", "demo-evidence"), DATABASE_URL: "" };
spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "start", "-p", "3001"], { stdio: "inherit", env, shell: process.platform === "win32" });
