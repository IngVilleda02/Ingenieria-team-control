/** Tipos de archivo permitidos para evidencias (lista blanca). */
export const ALLOWED: Record<string, string[]> = {
  jpg: ["image/jpeg"], jpeg: ["image/jpeg"], png: ["image/png"], webp: ["image/webp"], gif: ["image/gif"],
  pdf: ["application/pdf"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], xls: ["application/vnd.ms-excel"], csv: ["text/csv", "application/vnd.ms-excel", "text/plain"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"], doc: ["application/msword"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  txt: ["text/plain"], md: ["text/markdown", "text/plain"],
  zip: ["application/zip", "application/x-zip-compressed"],
  // Programación de PLC, robots y HMI (se guardan como binario)
  gx3: [], gxw: [], ls: [], tp: [], pe: [], acd: [], l5x: [], rss: [], ap17: [], zap17: [], kpr: [], mnu: [], xml: ["text/xml", "application/xml"], json: ["application/json"], st: [], scl: [], awl: [],
};
export const ACCEPT_ATTR = Object.keys(ALLOWED).map((e) => `.${e}`).join(",");
export const MAX_LOCAL_MB = 50;
export const MAX_CLOUD_MB = 4; // límite de cuerpo de las funciones de Vercel
export const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif"];
