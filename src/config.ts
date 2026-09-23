import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

/*
 * Setelah build:
 *
 * __dirname = /project/dist
 * APP_ROOT  = /project
 */
export const APP_ROOT =
  path.resolve(
    __dirname,
    ".."
  );

const parsedPort =
  Number.parseInt(
    process.env.PORT ?? "3000",
    10
  );

export const PORT =
  Number.isFinite(parsedPort) &&
  parsedPort > 0
    ? parsedPort
    : 3000;

export const NODE_ENV =
  process.env.NODE_ENV ??
  "development";

export const APP_URL =
  process.env.APP_URL ??
  `http://localhost:${PORT}`;

/*
 * Local:
 *   /project/data/absensi.sqlite
 *
 * Production:
 *   bisa diarahkan ke lokasi di luar folder aplikasi.
 */
export const DB_FILE =
  process.env.DB_FILE
    ? path.resolve(
        process.env.DB_FILE
      )
    : path.join(
        APP_ROOT,
        "data",
        "absensi.sqlite"
      );

export const SQLJS_DIR =
  path.join(
    APP_ROOT,
    "node_modules",
    "sql.js",
    "dist"
  );