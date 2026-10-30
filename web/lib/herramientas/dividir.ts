/**
 * Dividir: parte una tabla en varias según el valor de una columna
 * (una por tienda, por zona, por vendedor...).
 */

import { aTexto, type Fila, type Tabla } from "../tabla";

export const SIN_VALOR = "(vacío)";

export interface Parte {
  valor: string;
  tabla: Tabla;
}

export function dividirPorColumna(
  tabla: Tabla,
  columna: string,
  opciones: { ordenar: boolean; quitarColumna: boolean } = { ordenar: true, quitarColumna: false },
): Parte[] {
  const columnas = opciones.quitarColumna
    ? tabla.columnas.filter((c) => c !== columna)
    : [...tabla.columnas];
  const partes = new Map<string, Fila[]>();
  for (const f of tabla.filas) {
    const valor = aTexto(f[columna] ?? null).trim() || SIN_VALOR;
    let lista = partes.get(valor);
    if (!lista) partes.set(valor, (lista = []));
    if (opciones.quitarColumna) {
      const copia = { ...f };
      delete copia[columna];
      lista.push(copia);
    } else lista.push(f);
  }
  const resultado = [...partes].map(([valor, filas]) => ({
    valor,
    tabla: { columnas, filas },
  }));
  if (opciones.ordenar) {
    resultado.sort((x, y) =>
      x.valor === SIN_VALOR ? 1 : y.valor === SIN_VALOR ? -1 : x.valor.localeCompare(y.valor, "es", { numeric: true }),
    );
  }
  return resultado;
}

/** Nombre válido para archivo y para hoja de Excel (máx. 31, sin []:*?/\). */
export function nombreSeguro(valor: string, max = 31): string {
  const limpio = valor.replace(/[\[\]:*?/\\<>|"]/g, "_").replace(/^'+|'+$/g, "").trim();
  return (limpio || "Hoja").slice(0, max);
}

/** Hace únicos los nombres (Excel no distingue mayúsculas en hojas). */
export function nombresHojaUnicos(valores: string[], max = 31): string[] {
  const usados = new Set<string>();
  return valores.map((v) => {
    const base = nombreSeguro(v, max);
    let nombre = base;
    let n = 2;
    while (usados.has(nombre.toLowerCase())) {
      const suf = ` (${n++})`;
      nombre = base.slice(0, max - suf.length) + suf;
    }
    usados.add(nombre.toLowerCase());
    return nombre;
  });
}
