/**
 * Lectura y escritura de archivos en el navegador. Nada se sube a ningún
 * servidor: SheetJS lee y escribe los bytes aquí mismo.
 */

import * as XLSX from "xlsx";
import JSZip from "jszip";
import { aMatriz, desdeMatriz, esVacio, type Tabla } from "./tabla";
import { nombreSeguro, nombresHojaUnicos } from "./herramientas/dividir";

export interface LibroCargado {
  nombre: string;
  hojas: string[];
  libro: XLSX.WorkBook;
  /** CSV/TXT: todo llegó como texto y los números se reconocen al leer la hoja. */
  esTexto: boolean;
}

export const EXTENSIONES = ".xlsx,.xlsm,.xls,.xlsb,.ods,.csv,.tsv,.txt";

/** Los CSV llegan en UTF-8 o en Latin-1 (los que guarda Excel en Windows). */
function decodificarTexto(buf: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

export async function leerArchivo(archivo: File): Promise<LibroCargado> {
  const buf = await archivo.arrayBuffer();
  const esTexto = /\.(csv|tsv|txt)$/i.test(archivo.name);
  const libro = esTexto
    ? // raw: no adivinar tipos. Así "00123" no pierde ceros ni "05/06" se vuelve fecha gringa.
      XLSX.read(decodificarTexto(buf).replace(/^﻿/, ""), { type: "string", raw: true })
    : XLSX.read(buf, { type: "array", cellDates: true });
  return { nombre: archivo.name, hojas: libro.SheetNames, libro, esTexto };
}

/**
 * Convierte una hoja en tabla. `filaEncabezado` es 1-based: hay Excel con
 * títulos o logos arriba y el encabezado real empieza más abajo.
 */
export function leerHoja(cargado: LibroCargado, hoja: string, filaEncabezado = 1): Tabla {
  const ws = cargado.libro.Sheets[hoja];
  if (!ws) return { columnas: [], filas: [] };
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
    raw: true,
    // Con las filas en blanco incluidas, "fila N" es la fila N que se ve en Excel.
    blankrows: true,
  });
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
  return tabla;
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

export function csvTexto(tabla: Tabla): string {
  // BOM para que Excel abra bien tildes y ñ
  return "﻿" + XLSX.utils.sheet_to_csv(hojaDesdeTabla(tabla));
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

export function descargarExcel(hojas: { nombre: string; tabla: Tabla }[], archivo: string) {
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
