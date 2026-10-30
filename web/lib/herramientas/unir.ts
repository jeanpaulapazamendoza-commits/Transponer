/**
 * Unir: apila varias tablas (de archivos u hojas distintas) en una sola,
 * alineando las columnas por nombre aunque vengan en otro orden.
 */

import { nombreLibre, type Fila, type Tabla } from "../tabla";

export interface Entrada {
  /** "ventas_enero.xlsx › Hoja1" — se usa en la columna de origen y en el reporte */
  origen: string;
  tabla: Tabla;
}

export interface OpcionesUnir {
  /** "todas": unión de columnas (rellena con vacío). "comunes": solo las que están en todas. */
  columnas: "todas" | "comunes";
  /** Empareja "Precio", " precio " y "PRECIO" como la misma columna. */
  ignorarMayusculas: boolean;
  /** Si viene, añade una columna con el origen de cada fila. */
  columnaOrigen: string | null;
}

export interface ReporteUnir {
  origen: string;
  filas: number;
  /** Columnas del resultado que este origen no tenía (quedan vacías). */
  faltantes: string[];
  /** Columnas de este origen que no pasaron al resultado (modo "comunes"). */
  descartadas: string[];
}

export function unirTablas(entradas: Entrada[], op: OpcionesUnir) {
  const clave = (c: string) =>
    op.ignorarMayusculas ? c.trim().replace(/\s+/g, " ").toLowerCase() : c;

  // Nombre visible de cada clave: el de su primera aparición.
  const nombrePorClave = new Map<string, string>();
  const clavesPorEntrada = entradas.map((e) => {
    const m = new Map<string, string>(); // clave -> columna original en esta tabla
    for (const c of e.tabla.columnas) {
      const k = clave(c);
      if (!m.has(k)) m.set(k, c);
      if (!nombrePorClave.has(k)) nombrePorClave.set(k, c);
    }
    return m;
  });

  let claves = [...nombrePorClave.keys()];
  if (op.columnas === "comunes") {
    claves = claves.filter((k) => clavesPorEntrada.every((m) => m.has(k)));
  }
  const nombres = claves.map((k) => nombrePorClave.get(k)!);
  // Si los archivos ya traen una columna "Origen", la del origen sale "Origen (2)".
  const origen = op.columnaOrigen ? nombreLibre(op.columnaOrigen, new Set(nombres)) : null;

  const filas: Fila[] = [];
  const reporte: ReporteUnir[] = [];
  entradas.forEach((e, i) => {
    const m = clavesPorEntrada[i];
    for (const f of e.tabla.filas) {
      const nueva: Fila = {};
      if (origen) nueva[origen] = e.origen;
      claves.forEach((k, j) => {
        const orig = m.get(k);
        nueva[nombres[j]] = orig === undefined ? null : (f[orig] ?? null);
      });
      filas.push(nueva);
    }
    reporte.push({
      origen: e.origen,
      filas: e.tabla.filas.length,
      faltantes: claves.filter((k) => !m.has(k)).map((k) => nombrePorClave.get(k)!),
      descartadas: [...m.entries()]
        .filter(([k]) => !claves.includes(k))
        .map(([, c]) => c),
    });
  });

  const columnas = origen ? [origen, ...nombres] : nombres;
  return { tabla: { columnas, filas } as Tabla, reporte };
}
