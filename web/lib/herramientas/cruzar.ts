/**
 * Cruzar: el BUSCARV masivo. Une la tabla A con la tabla B por una columna
 * clave y trae las columnas elegidas de B. Además cuenta lo que no cruzó,
 * que es justo lo que en Excel cuesta encontrar (#N/A escondidos).
 */

import { aTexto, esVacio, type Fila, type Tabla } from "../tabla";

export type TipoCruce =
  /** Todas las filas de A, con lo de B si existe (BUSCARV). */
  | "izquierda"
  /** Solo las filas de A que encontraron pareja en B. */
  | "interna"
  /** Todo A + lo de B que no cruzó. */
  | "completa"
  /** Solo las filas de A que NO están en B. */
  | "faltantes";

export interface OpcionesCruce {
  claveA: string;
  claveB: string;
  /** Columnas de B que se traen (sin la clave). */
  traer: string[];
  tipo: TipoCruce;
  /** Si B tiene la clave repetida: traer solo la primera o repetir la fila de A. */
  duplicadosB: "primera" | "todas";
  /** Ignora mayúsculas y espacios en la clave. */
  normalizar: boolean;
  /** "00123" cruza con 123. Útil para códigos y DNI. */
  ignorarCerosIzquierda: boolean;
  /** Añade una columna "¿Cruzó?" con Sí/No. */
  marcarCruce: boolean;
}

export const COLUMNA_CRUCE = "¿Cruzó?";

export function claveNormalizada(
  v: Fila[string] | undefined,
  op: Pick<OpcionesCruce, "normalizar" | "ignorarCerosIzquierda">,
): string {
  let t = aTexto(v ?? null);
  if (op.normalizar) t = t.trim().replace(/\s+/g, " ").toLowerCase();
  if (op.ignorarCerosIzquierda) t = t.replace(/^0+(?=.)/, "");
  return t;
}

export function cruzarTablas(a: Tabla, b: Tabla, op: OpcionesCruce) {
  // Columnas de B que chocan con nombres de A llevan sufijo " (B)".
  const nombreEnResultado = new Map<string, string>();
  for (const c of op.traer) {
    let n = a.columnas.includes(c) ? `${c} (B)` : c;
    while (a.columnas.includes(n)) n = `${n} (B)`;
    nombreEnResultado.set(c, n);
  }

  const indiceB = new Map<string, Fila[]>();
  let clavesDuplicadasB = 0;
  for (const f of b.filas) {
    if (esVacio(f[op.claveB])) continue;
    const k = claveNormalizada(f[op.claveB], op);
    const lista = indiceB.get(k);
    if (lista) {
      if (lista.length === 1) clavesDuplicadasB++;
      lista.push(f);
    } else indiceB.set(k, [f]);
  }

  const usadasB = new Set<string>();
  const filas: Fila[] = [];
  let cruzadas = 0;
  let sinCruceA = 0;

  const conB = (fa: Fila, fb: Fila | null): Fila => {
    const nueva: Fila = { ...fa };
    for (const c of op.traer) nueva[nombreEnResultado.get(c)!] = fb ? (fb[c] ?? null) : null;
    if (op.marcarCruce) nueva[COLUMNA_CRUCE] = fb ? "Sí" : "No";
    return nueva;
  };

  for (const fa of a.filas) {
    const k = esVacio(fa[op.claveA]) ? null : claveNormalizada(fa[op.claveA], op);
    const parejas = k === null ? undefined : indiceB.get(k);
    if (parejas) {
      cruzadas++;
      usadasB.add(k!);
      if (op.tipo === "faltantes") continue;
      const usar = op.duplicadosB === "primera" ? parejas.slice(0, 1) : parejas;
      for (const fb of usar) filas.push(conB(fa, fb));
    } else {
      sinCruceA++;
      if (op.tipo === "interna") continue;
      filas.push(op.tipo === "faltantes" ? { ...fa } : conB(fa, null));
    }
  }

  let sinCruceB = 0;
  for (const [k, lista] of indiceB) {
    if (usadasB.has(k)) continue;
    sinCruceB += lista.length;
    if (op.tipo !== "completa") continue;
    for (const fb of lista) {
      const vacia: Fila = Object.fromEntries(a.columnas.map((c) => [c, null]));
      vacia[op.claveA] = fb[op.claveB] ?? null;
      const nueva = conB(vacia, fb);
      if (op.marcarCruce) nueva[COLUMNA_CRUCE] = "Solo en B";
      filas.push(nueva);
    }
  }

  const columnas =
    op.tipo === "faltantes"
      ? [...a.columnas]
      : [
          ...a.columnas,
          ...op.traer.map((c) => nombreEnResultado.get(c)!),
          ...(op.marcarCruce ? [COLUMNA_CRUCE] : []),
        ];

  return {
    tabla: { columnas, filas } as Tabla,
    resumen: { cruzadas, sinCruceA, sinCruceB, clavesDuplicadasB },
  };
}
