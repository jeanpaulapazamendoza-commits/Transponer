/**
 * Modelo de datos común a todas las herramientas.
 *
 * Una tabla es una lista de columnas (en orden) y una lista de filas, donde
 * cada fila es un objeto columna -> valor. Las herramientas trabajan solo con
 * este modelo y no saben nada de Excel: así se pueden probar sin archivos.
 */

export type Celda = string | number | boolean | Date | null;
export type Fila = Record<string, Celda>;

export interface Tabla {
  columnas: string[];
  filas: Fila[];
}

/** Vacío = null/undefined o texto que solo tiene espacios. El 0 NO es vacío. */
export function esVacio(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (typeof v === "number") return Number.isNaN(v);
  return false;
}

/** Representación de texto estable de una celda (para claves y comparaciones). */
export function aTexto(v: Celda | undefined): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    // SheetJS entrega las fechas en hora local (la medianoche de Lima son las
    // 05:00 UTC), así que se leen con la hora local y no con toISOString().
    // Se redondea al segundo: la hora de Excel es un decimal y llega como 14:29:59.999.
    const d = new Date(Math.round(v.getTime() / 1000) * 1000);
    const p = (n: number) => String(n).padStart(2, "0");
    const fecha = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const [h, m, s] = [d.getHours(), d.getMinutes(), d.getSeconds()];
    if (!h && !m && !s) return fecha;
    return `${fecha} ${p(h)}:${p(m)}${s ? `:${p(s)}` : ""}`;
  }
  if (typeof v === "number") {
    // 123.0 -> "123", evita ruido de coma flotante (0.1+0.2)
    return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(15)));
  }
  return String(v);
}

/**
 * Convierte encabezados crudos en nombres de columna únicos y no vacíos:
 * ""  -> "Columna 3",  repetidos -> "Precio (2)".
 */
export function nombresUnicos(crudos: unknown[]): string[] {
  const usados = new Set<string>();
  return crudos.map((c, i) => {
    let base = aTexto((c ?? null) as Celda).trim();
    if (!base) base = `Columna ${i + 1}`;
    let nombre = base;
    let n = 2;
    while (usados.has(nombre)) nombre = `${base} (${n++})`;
    usados.add(nombre);
    return nombre;
  });
}

/**
 * Devuelve `nombre` si nadie lo usa, o "nombre (2)", "nombre (3)"… si ya
 * está tomado, y lo aparta en `usados`. Para las columnas que crea una
 * herramienta: si el archivo ya trae una "Valor", la nueva no la pisa.
 */
export function nombreLibre(nombre: string, usados: Set<string>): string {
  let n = nombre;
  let i = 2;
  while (usados.has(n)) n = `${nombre} (${i++})`;
  usados.add(n);
  return n;
}

/** Construye una tabla a partir de filas en forma de matriz (la primera es el encabezado). */
export function desdeMatriz(matriz: unknown[][]): Tabla {
  if (matriz.length === 0) return { columnas: [], filas: [] };
  // Sin Math.max(...): con cientos de miles de filas revienta la pila.
  const ancho = matriz.reduce((m, f) => Math.max(m, f.length), 0);
  const encabezado = Array.from({ length: ancho }, (_, i) => matriz[0][i]);
  const columnas = nombresUnicos(encabezado);
  const filas = matriz.slice(1).map((crudo) => {
    const fila: Fila = {};
    columnas.forEach((c, i) => {
      const v = crudo[i];
      fila[c] = v === undefined ? null : (v as Celda);
    });
    return fila;
  });
  return { columnas, filas };
}

/** Pasa la tabla a matriz (encabezado + filas), útil para exportar. */
export function aMatriz(tabla: Tabla): Celda[][] {
  return [
    tabla.columnas,
    ...tabla.filas.map((f) => tabla.columnas.map((c) => f[c] ?? null)),
  ];
}

/** ¿Todos los valores no vacíos de la columna son números? */
export function esColumnaNumerica(tabla: Tabla, columna: string): boolean {
  let alguno = false;
  for (const f of tabla.filas) {
    const v = f[columna];
    if (esVacio(v)) continue;
    if (typeof v !== "number") return false;
    alguno = true;
  }
  return alguno;
}
