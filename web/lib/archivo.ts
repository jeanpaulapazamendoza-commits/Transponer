/**
 * Lectura y escritura de archivos en el navegador. Nada se sube a ningún
 * servidor: SheetJS lee y escribe los bytes aquí mismo.
 */

import * as XLSX from "xlsx";
import JSZip from "jszip";
import { aMatriz, aTexto, desdeMatriz, esVacio, type Celda, type Tabla } from "./tabla";
import { nombreSeguro, nombresHojaUnicos } from "./herramientas/dividir";

export interface LibroCargado {
  nombre: string;
  hojas: string[];
  libro: XLSX.WorkBook;
  /** CSV/TXT: todo llegó como texto y los números se reconocen al leer la hoja. */
  esTexto: boolean;
}

export const EXTENSIONES = ".xlsx,.xlsm,.xls,.xlsb,.ods,.csv,.tsv,.txt";

/** Los CSV llegan en UTF-8, en Latin-1 (los que guarda Excel en Windows) o en UTF-16 ("Texto Unicode"). */
function decodificarTexto(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(buf);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

const NO_ES_EXCEL = "no parece un archivo de Excel válido. Puede estar dañado o tener la extensión cambiada.";

/**
 * Lo que SheetJS no rechaza solo: un PDF o una imagen renombrados a .xlsx los
 * lee como texto y devuelve una tabla de basura. Se mira la firma del archivo.
 */
function revisarFirma(buf: ArrayBuffer, extension: string) {
  const b = new Uint8Array(buf, 0, Math.min(512, buf.byteLength));
  const zip = b[0] === 0x50 && b[1] === 0x4b; // "PK": xlsx, xlsm, xlsb, ods
  const cfb = b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0; // xls, o xlsx con contraseña
  if (["xlsx", "xlsm", "xlsb", "ods"].includes(extension) && !zip && !cfb) throw new Error(NO_ES_EXCEL);
  // Un .xls puede ser en realidad HTML o XML (lo exportan muchos sistemas), pero no binario cualquiera.
  if (extension === "xls" && !cfb && !zip && b.includes(0)) throw new Error(NO_ES_EXCEL);
}

/** Traduce los errores de SheetJS a algo que el usuario pueda resolver. */
function errorDeLectura(e: unknown): Error {
  const m = e instanceof Error ? e.message : String(e);
  if (/password|encrypt/i.test(m))
    return new Error("está protegido con contraseña. Ábrelo en Excel, quítale la contraseña y vuelve a subirlo.");
  if (/unsupported|corrupt|zip|cfb|end of central|header signature/i.test(m)) return new Error(NO_ES_EXCEL);
  return new Error(m);
}

export async function leerArchivo(archivo: File): Promise<LibroCargado> {
  const extension = /\.([^.]+)$/.exec(archivo.name)?.[1].toLowerCase() ?? "";
  if (!EXTENSIONES.split(",").includes(`.${extension}`))
    throw new Error("no es un formato admitido. Sube un Excel (.xlsx, .xls, .xlsb, .ods) o un CSV.");
  if (archivo.size === 0) throw new Error("está vacío (0 bytes).");
  const buf = await archivo.arrayBuffer();
  const esTexto = ["csv", "tsv", "txt"].includes(extension);
  if (!esTexto) revisarFirma(buf, extension);
  // XLSX.read bloquea la página (un Excel de 20 MB tarda segundos): antes se
  // deja pintar el «Leyendo…» para que no parezca colgada.
  await new Promise((r) => setTimeout(r, 30));
  let libro: XLSX.WorkBook;
  try {
    libro = esTexto
      ? // raw: no adivinar tipos. Así "00123" no pierde ceros ni "05/06" se vuelve fecha gringa.
        XLSX.read(decodificarTexto(buf).replace(/^\uFEFF/, ""), { type: "string", raw: true })
      : XLSX.read(buf, { type: "array", cellDates: true });
  } catch (e) {
    throw errorDeLectura(e);
  }
  if (!libro.SheetNames.length) throw new Error("no tiene hojas.");
  return { nombre: archivo.name, hojas: libro.SheetNames, libro, esTexto };
}

/**
 * La hoja como matriz, tal como se ve en Excel:
 *  - las celdas combinadas repiten su valor en todo el rango (un encabezado
 *    "Ventas" sobre tres columnas, o una zona combinada sobre cinco filas);
 *  - los errores de fórmula (#N/A, #DIV/0!) quedan como texto, porque
 *    sheet_to_json los deja vacíos y se perderían sin aviso.
 */
function matrizDeHoja(ws: XLSX.WorkSheet): unknown[][] {
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
    raw: true,
    // Con las filas en blanco incluidas, "fila N" es la fila N que se ve en Excel.
    blankrows: true,
  });
  if (!ws["!ref"]) return matriz;
  const rango = XLSX.utils.decode_range(ws["!ref"]);
  const poner = (r: number, c: number, v: unknown) => {
    if (r < rango.s.r || r > rango.e.r || c < rango.s.c || c > rango.e.c) return;
    const fila = (matriz[r - rango.s.r] ??= []);
    if (esVacio(fila[c - rango.s.c])) fila[c - rango.s.c] = v;
  };

  for (const dir of Object.keys(ws)) {
    if (dir[0] === "!") continue;
    const celda = ws[dir] as XLSX.CellObject;
    if (celda.t !== "e") continue;
    const { r, c } = XLSX.utils.decode_cell(dir);
    poner(r, c, celda.w ?? "#ERROR");
  }

  for (const m of ws["!merges"] ?? []) {
    const v = matriz[m.s.r - rango.s.r]?.[m.s.c - rango.s.c];
    if (esVacio(v)) continue;
    const hastaR = Math.min(m.e.r, rango.e.r);
    const hastaC = Math.min(m.e.c, rango.e.c);
    for (let r = m.s.r; r <= hastaR; r++) for (let c = m.s.c; c <= hastaC; c++) poner(r, c, v);
  }
  return matriz;
}

/** Leer una hoja grande cuesta; las herramientas la piden varias veces con lo mismo. */
const hojasLeidas = new WeakMap<XLSX.WorkBook, Map<string, Tabla>>();

/**
 * Convierte una hoja en tabla. `filaEncabezado` es 1-based: hay Excel con
 * títulos o logos arriba y el encabezado real empieza más abajo.
 */
export function leerHoja(cargado: LibroCargado, hoja: string, filaEncabezado = 1): Tabla {
  const ws = cargado.libro.Sheets[hoja];
  if (!ws) return { columnas: [], filas: [] };
  let cache = hojasLeidas.get(cargado.libro);
  if (!cache) hojasLeidas.set(cargado.libro, (cache = new Map()));
  const clave = `${hoja}\u0000${filaEncabezado}`;
  const guardada = cache.get(clave);
  if (guardada) return guardada;

  const matriz = matrizDeHoja(ws);
  const [encabezado = [], ...resto] = matriz.slice(Math.max(0, filaEncabezado - 1));
  const tabla = desdeMatriz([encabezado, ...resto.filter((f) => f.some((v) => !esVacio(v)))]);
  if (cargado.esTexto) {
    // Solo números "limpios" (1234, -5.5); los códigos con cero inicial quedan como texto.
    for (const f of tabla.filas)
      for (const c of tabla.columnas) {
        const v = f[c];
        if (typeof v === "string" && /^-?(0|[1-9]\d*)(\.\d+)?$/.test(v.trim())) f[c] = Number(v);
      }
  }
  cache.set(clave, tabla);
  return tabla;
}

/** Límites de una hoja de Excel (.xlsx). */
export const MAX_FILAS_EXCEL = 1_048_576; // con el encabezado
export const MAX_COLUMNAS_EXCEL = 16_384;
export const MAX_TEXTO_CELDA = 32_767;

const miles = (n: number) => n.toLocaleString("es-PE");

/**
 * Por qué estas hojas no caben en un Excel, o null si caben. Transponer
 * multiplica filas y es fácil pasarse del millón sin darse cuenta.
 */
export function problemaExcel(hojas: { nombre: string; tabla: Tabla }[]): string | null {
  for (const { nombre, tabla } of hojas) {
    if (tabla.filas.length + 1 > MAX_FILAS_EXCEL)
      return `«${nombre}» tiene ${miles(tabla.filas.length)} filas y una hoja de Excel admite ${miles(MAX_FILAS_EXCEL - 1)}. Descárgalo en CSV.`;
    if (tabla.columnas.length > MAX_COLUMNAS_EXCEL)
      return `«${nombre}» tiene ${miles(tabla.columnas.length)} columnas y una hoja de Excel admite ${miles(MAX_COLUMNAS_EXCEL)}. Descárgalo en CSV.`;
    for (const c of tabla.columnas) {
      if (c.length > MAX_TEXTO_CELDA) return `Un nombre de columna de «${nombre}» pasa de ${miles(MAX_TEXTO_CELDA)} caracteres.`;
      for (const f of tabla.filas) {
        const v = f[c];
        if (typeof v === "string" && v.length > MAX_TEXTO_CELDA)
          return `Una celda de la columna «${c}» tiene ${miles(v.length)} caracteres y Excel admite ${miles(MAX_TEXTO_CELDA)} por celda. Descárgalo en CSV.`;
      }
    }
  }
  return null;
}

function hojaDesdeTabla(tabla: Tabla) {
  return XLSX.utils.aoa_to_sheet(aMatriz(tabla), { cellDates: true });
}

export function libroDesdeTablas(hojas: { nombre: string; tabla: Tabla }[]) {
  const libro = XLSX.utils.book_new();
  const nombres = nombresHojaUnicos(hojas.map((h) => h.nombre));
  hojas.forEach((h, i) => XLSX.utils.book_append_sheet(libro, hojaDesdeTabla(h.tabla), nombres[i]));
  return libro;
}

export function excelBytes(hojas: { nombre: string; tabla: Tabla }[]): Uint8Array {
  return XLSX.write(libroDesdeTablas(hojas), { type: "array", bookType: "xlsx" });
}

function celdaCsv(v: Celda | undefined): string {
  const t = aTexto(v ?? null);
  return /[",\r\n]|^\s|\s$/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** CSV escrito a mano: no tiene el tope de filas de una hoja de Excel. */
export function csvTexto(tabla: Tabla): string {
  const lineas = [tabla.columnas.map(celdaCsv).join(",")];
  for (const f of tabla.filas) lineas.push(tabla.columnas.map((c) => celdaCsv(f[c])).join(","));
  // BOM para que Excel abra bien tildes y ñ
  return "\uFEFF" + lineas.join("\r\n") + "\r\n";
}

export function descargar(datos: BlobPart, nombre: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([datos], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Lanza un Error con el motivo si las hojas no caben en un Excel. */
export function descargarExcel(hojas: { nombre: string; tabla: Tabla }[], archivo: string) {
  const problema = problemaExcel(hojas);
  if (problema) throw new Error(problema);
  descargar(excelBytes(hojas) as BlobPart, `${archivo}.xlsx`, TIPO_XLSX);
}

export function descargarCsv(tabla: Tabla, archivo: string) {
  descargar(csvTexto(tabla), `${archivo}.csv`, "text/csv;charset=utf-8");
}

/** Un archivo por parte, todos dentro de un .zip. */
export async function descargarZip(
  partes: { nombre: string; tabla: Tabla }[],
  formato: "xlsx" | "csv",
  archivo: string,
) {
  if (formato === "xlsx") {
    const problema = problemaExcel(partes);
    if (problema) throw new Error(problema);
  }
  const zip = new JSZip();
  const nombres = nombresHojaUnicos(
    partes.map((p) => p.nombre),
    80,
  );
  partes.forEach((p, i) => {
    const n = `${nombreSeguro(nombres[i], 80)}.${formato}`;
    zip.file(n, formato === "xlsx" ? excelBytes([{ nombre: "Datos", tabla: p.tabla }]) : csvTexto(p.tabla));
  });
  const blob = await zip.generateAsync({ type: "blob" });
  descargar(blob, `${archivo}.zip`, "application/zip");
}

/** "ventas enero.xlsx" -> "ventas enero" */
export function sinExtension(nombre: string) {
  return nombre.replace(/\.[^.]+$/, "");
}
