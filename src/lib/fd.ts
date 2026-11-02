/** Lectura tipada de FormData (los formularios envían texto). */
export const fdStr = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};
export const fdOpt = (fd: FormData, k: string) => fdStr(fd, k) || null;
export const fdNum = (fd: FormData, k: string) => {
  const v = fdStr(fd, k).replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
export const fdBool = (fd: FormData, k: string) => ["on", "true", "1", "si"].includes(fdStr(fd, k).toLowerCase());
export const fdAll = (fd: FormData, k: string) => fd.getAll(k).filter((v): v is string => typeof v === "string" && v.trim() !== "");
