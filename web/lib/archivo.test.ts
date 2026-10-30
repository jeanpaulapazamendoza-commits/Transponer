import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { csvTexto, leerArchivo, leerHoja, MAX_FILAS_EXCEL, problemaExcel, type LibroCargado } from "./archivo";
import { desdeMatriz, type Tabla } from "./tabla";

function libroDe(ws: XLSX.WorkSheet): LibroCargado {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, ws, "Hoja1");
  return { nombre: "x.xlsx", hojas: ["Hoja1"], libro, esTexto: false };
}

const archivo = (partes: BlobPart[], nombre: string) => new File(partes, nombre);

describe("leerArchivo rechaza lo que no es un Excel", () => {
  it("formato no admitido, vacío y extensión cambiada", async () => {
    await expect(leerArchivo(archivo(["hola"], "notas.pdf"))).rejects.toThrow(/no es un formato admitido/);
    await expect(leerArchivo(archivo([], "vacio.xlsx"))).rejects.toThrow(/vacío/);
    await expect(leerArchivo(archivo(["%PDF-1.7\n..."], "reporte.xlsx"))).rejects.toThrow(/no parece un archivo de Excel/);
    await expect(leerArchivo(archivo([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0])], "foto.xls"))).rejects.toThrow(
      /no parece un archivo de Excel/,
    );
  });

  it("un zip que no es Excel", async () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new Array(40).fill(0)]);
    await expect(leerArchivo(archivo([zip], "dañado.xlsx"))).rejects.toThrow();
  });

  it("un .xls que en realidad es HTML se lee", async () => {
    const html = "<table><tr><td>A</td><td>B</td></tr><tr><td>1</td><td>2</td></tr></table>";
    const l = await leerArchivo(archivo([html], "export.xls"));
    expect(leerHoja(l, l.hojas[0]).columnas).toEqual(["A", "B"]);
  });

  it("CSV en UTF-16 (Texto Unicode de Excel)", async () => {
    const texto = "﻿Nombre\tCódigo\nPeña\t00123\n";
    const bytes = new Uint8Array(texto.length * 2);
    for (let i = 0; i < texto.length; i++) {
      bytes[i * 2] = texto.charCodeAt(i) & 0xff;
      bytes[i * 2 + 1] = texto.charCodeAt(i) >> 8;
    }
    const l = await leerArchivo(archivo([bytes], "unicode.txt"));
    expect(leerHoja(l, l.hojas[0])).toEqual({
      columnas: ["Nombre", "Código"],
      filas: [{ Nombre: "Peña", Código: "00123" }],
    });
  });
});

describe("leerHoja", () => {
  it("las celdas combinadas repiten su valor y los errores no se pierden", () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Zona", "Ventas", null, null],
      [null, "Ene", "Feb", "Mar"],
      ["Norte", 1, 2, 3],
      [null, 4, 5, 6],
    ]);
    ws["!merges"] = [
      XLSX.utils.decode_range("B1:D1"), // encabezado combinado
      XLSX.utils.decode_range("A3:A4"), // zona combinada sobre dos filas
    ];
    ws["C3"] = { t: "e", v: 0x2a, w: "#N/A" };
    const l = libroDe(ws);
    expect(leerHoja(l, "Hoja1").columnas).toEqual(["Zona", "Ventas", "Ventas (2)", "Ventas (3)"]);
    const t = leerHoja(l, "Hoja1", 2);
    expect(t.columnas).toEqual(["Columna 1", "Ene", "Feb", "Mar"]);
    expect(t.filas).toEqual([
      { "Columna 1": "Norte", Ene: 1, Feb: "#N/A", Mar: 3 },
      { "Columna 1": "Norte", Ene: 4, Feb: 5, Mar: 6 },
    ]);
  });

  it("una fila de encabezado más allá del final da una tabla vacía", () => {
    const l = libroDe(XLSX.utils.aoa_to_sheet([["A"], [1]]));
    expect(leerHoja(l, "Hoja1", 50)).toEqual({ columnas: [], filas: [] });
    expect(leerHoja(l, "No existe")).toEqual({ columnas: [], filas: [] });
  });
});

describe("salida", () => {
  it("CSV con comillas, saltos de línea, fechas locales y sin tope de filas", () => {
    const t = desdeMatriz([
      ["Texto", "Fecha", "N"],
      ['dice "hola", y se va', new Date(2026, 4, 6), 0.1 + 0.2],
      ["dos\nlíneas", new Date(2026, 4, 6, 9, 15), null],
    ]);
    expect(csvTexto(t)).toBe(
      '﻿Texto,Fecha,N\r\n"dice ""hola"", y se va",2026-05-06,0.3\r\n"dos\nlíneas",2026-05-06 09:15,\r\n',
    );
  });

  it("avisa cuando el resultado no cabe en una hoja de Excel", () => {
    const grande: Tabla = { columnas: ["A"], filas: new Array(MAX_FILAS_EXCEL).fill({ A: 1 }) };
    expect(problemaExcel([{ nombre: "Transpuesto", tabla: grande }])).toMatch(/1\D?048\D?576 filas.*CSV/);
    const justa: Tabla = { columnas: ["A"], filas: grande.filas.slice(1) };
    expect(problemaExcel([{ nombre: "x", tabla: justa }])).toBeNull();
    const larga = desdeMatriz([["Nota"], ["x".repeat(40_000)]]);
    expect(problemaExcel([{ nombre: "x", tabla: larga }])).toMatch(/«Nota».*40\D?000 caracteres/);
  });
});
