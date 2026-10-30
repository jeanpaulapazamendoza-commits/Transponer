/**
 * Transponer (de formato ancho a formato largo). Port del transponer.py de
 * la versión Streamlit, con los mismos dos modos:
 *
 *  1. SIMPLE     -> varias columnas de un mismo concepto se apilan en una:
 *                   "Suma de Lunes", "Suma de Martes" -> "Variable" + "Valor".
 *  2. EMPAREJADO -> grupos de columnas relacionadas por posición se despivotan
 *                   sin romper la relación: ("P. 1","Lt. 1"), ("P. 2","Lt. 2")
 *                   -> "Posicion" + "P." + "Lt.".
 */

import { esColumnaNumerica, esVacio, nombreLibre, type Fila, type Tabla } from "../tabla";

/** prefijo -> (número de posición -> nombre de columna original) */
export type Grupos = Record<string, Record<number, string>>;

export type Configuracion =
  | { modo: "simple"; columnasFijas: string[]; columnasATransponer: string[] }
  | { modo: "emparejado"; columnasFijas: string[]; grupos: Grupos };

/**
 * Agrupa las columnas que comparten prefijo y terminan en número.
 * Solo devuelve los prefijos que aparecen con 2+ números distintos.
 */
export function detectarGruposEmparejados(columnas: string[]): Grupos {
  const patron = /^(.*?)[\s._-]*(\d+)\s*$/;
  const grupos: Grupos = {};
  for (const col of columnas) {
    const m = patron.exec(col);
    if (!m) continue;
    const prefijo = m[1].trim().replace(/\.+$/, "").trim();
    if (!prefijo) continue;
    (grupos[prefijo] ??= {})[Number(m[2])] = col;
  }
  return Object.fromEntries(
    Object.entries(grupos).filter(([, d]) => Object.keys(d).length >= 2),
  );
}

/**
 * Columnas que comparten las dos primeras palabras, típico de tablas
 * dinámicas exportadas ("Suma de Lunes", "Suma de Martes"...).
 */
export function detectarPrefijoTexto(columnas: string[], minCols = 2) {
  const grupos = new Map<string, string[]>();
  for (const col of columnas) {
    const palabras = col.split(/\s+/).filter(Boolean);
    if (palabras.length >= 3) {
      const clave = palabras.slice(0, 2).join(" ");
      grupos.set(clave, [...(grupos.get(clave) ?? []), col]);
    }
  }
  let mejor: [string, string[]] | null = null;
  for (const g of grupos) if (!mejor || g[1].length > mejor[1].length) mejor = g;
  if (mejor && mejor[1].length >= minCols) return { prefijo: mejor[0], columnas: mejor[1] };
  return { prefijo: null, columnas: [] as string[] };
}

export function sugerirConfiguracion(tabla: Tabla): Configuracion {
  const { columnas } = tabla;
  const grupos = detectarGruposEmparejados(columnas);
  const nGrupos = Object.keys(grupos).length;

  // Prioridad 1: prefijo de texto repetido (ej: "Suma de ...")
  const txt = detectarPrefijoTexto(columnas);
  if (txt.prefijo && nGrupos < 2) {
    return {
      modo: "simple",
      columnasFijas: columnas.filter((c) => !txt.columnas.includes(c)),
      columnasATransponer: txt.columnas,
    };
  }

  if (nGrupos >= 2) {
    const enGrupos = new Set(Object.values(grupos).flatMap((d) => Object.values(d)));
    return {
      modo: "emparejado",
      columnasFijas: columnas.filter((c) => !enGrupos.has(c)),
      grupos,
    };
  }

  if (nGrupos === 1) {
    const cols = Object.values(Object.values(grupos)[0]);
    return {
      modo: "simple",
      columnasFijas: columnas.filter((c) => !cols.includes(c)),
      columnasATransponer: cols,
    };
  }

  // Sin patrón claro: las numéricas se transponen, el resto queda fijo.
  const numericas = columnas.filter((c) => esColumnaNumerica(tabla, c));
  const otras = columnas.filter((c) => !numericas.includes(c));
  if (numericas.length && otras.length) {
    return { modo: "simple", columnasFijas: otras, columnasATransponer: numericas };
  }

  // Último recurso: primera columna fija, el resto se transpone.
  return {
    modo: "simple",
    columnasFijas: columnas.slice(0, 1),
    columnasATransponer: columnas.slice(1),
  };
}

/** Apila varias columnas en una sola (melt clásico). Orden: por columna, luego por fila. */
export function transponerSimple(
  tabla: Tabla,
  columnasFijas: string[],
  columnasATransponer: string[],
  nombreCategoria = "Variable",
  nombreValor = "Valor",
  conservarVacios = false,
): Tabla {
  // Si una columna fija ya se llama "Valor", la nueva sale "Valor (2)" en vez de pisarla.
  const usados = new Set(columnasFijas);
  const categoria = nombreLibre(nombreCategoria, usados);
  const valor = nombreLibre(nombreValor, usados);
  const filas: Fila[] = [];
  for (const col of columnasATransponer) {
    for (const f of tabla.filas) {
      const v = f[col] ?? null;
      if (!conservarVacios && esVacio(v)) continue;
      const nueva: Fila = {};
      for (const c of columnasFijas) nueva[c] = f[c] ?? null;
      nueva[categoria] = col;
      nueva[valor] = v;
      filas.push(nueva);
    }
  }
  return { columnas: [...columnasFijas, categoria, valor], filas };
}

/**
 * Despivota grupos emparejados por posición. Cada fila original genera una
 * fila por posición (unión de las posiciones de todos los grupos), en orden.
 */
export function transponerEmparejado(
  tabla: Tabla,
  columnasFijas: string[],
  grupos: Grupos,
  nombrePosicion = "Posicion",
  conservarVacios = false,
): Tabla {
  const prefijos = Object.keys(grupos);
  const posiciones = [
    ...new Set(prefijos.flatMap((p) => Object.keys(grupos[p]).map(Number))),
  ].sort((a, b) => a - b);

  // Una fija "P" junto al grupo "P. 1", "P. 2" chocaría con la columna "P" del resultado.
  const usados = new Set(columnasFijas);
  const posicion = nombreLibre(nombrePosicion, usados);
  const nombres = prefijos.map((p) => nombreLibre(p, usados));

  const filas: Fila[] = [];
  for (const f of tabla.filas) {
    for (const pos of posiciones) {
      const valores = prefijos.map((p) => {
        const col = grupos[p][pos];
        return col === undefined ? null : (f[col] ?? null);
      });
      if (!conservarVacios && valores.every(esVacio)) continue;
      const nueva: Fila = {};
      for (const c of columnasFijas) nueva[c] = f[c] ?? null;
      nueva[posicion] = pos;
      nombres.forEach((n, i) => (nueva[n] = valores[i]));
      filas.push(nueva);
    }
  }
  return { columnas: [...columnasFijas, posicion, ...nombres], filas };
}
