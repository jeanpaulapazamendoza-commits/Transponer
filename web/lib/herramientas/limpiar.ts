/**
 * Limpiar: las correcciones que siempre hay que hacer a mano antes de poder
 * usar un Excel ajeno. Cada paso es opcional y cuenta cuánto cambió.
 */

import { aTexto, esVacio, type Celda, type Fila, type Tabla } from "../tabla";

export type Capitalizacion = "ninguna" | "mayusculas" | "minusculas" | "titulo";

export interface OpcionesLimpiar {
  /** Quita espacios al inicio/final y deja uno solo entre palabras. */
  recortarEspacios: boolean;
  quitarFilasVacias: boolean;
  quitarColumnasVacias: boolean;
  capitalizacion: Capitalizacion;
  /** Columnas a las que se aplica la capitalización (vacío = todas). */
  columnasCapitalizar: string[];
  /** "1,234.50", "S/ 1 234,50" o "15%" escritos como texto pasan a número. */
  convertirNumeros: boolean;
  quitarDuplicados: boolean;
  /** Columnas que definen un duplicado (vacío = la fila entera). */
  columnasDuplicado: string[];
  mantener: "primera" | "ultima";
  /** Al comparar duplicados, "ANA" = "ana". */
  duplicadosSinMayusculas: boolean;
}

export interface ReporteLimpiar {
  celdasRecortadas: number;
  filasVaciasQuitadas: number;
  columnasVaciasQuitadas: string[];
  celdasCapitalizadas: number;
  numerosConvertidos: number;
  duplicadosQuitados: number;
}

function titulo(t: string) {
  return t.toLocaleLowerCase("es").replace(/(^|[\s\-/(])(\p{L})/gu, (_, sep, l) =>
    sep + l.toLocaleUpperCase("es"),
  );
}

/**
 * Interpreta un texto como número si TODO el texto es un número. Devuelve
 * null si no lo es. Respeta códigos con ceros a la izquierda ("00123").
 */
export function textoANumero(t: string): number | null {
  let s = t.trim();
  if (!s) return null;
  let porcentaje = false;
  if (s.endsWith("%")) {
    porcentaje = true;
    s = s.slice(0, -1).trim();
  }
  // Símbolos de moneda comunes al inicio o al final
  s = s.replace(/^(S\/\.?|US\$|\$|€|£|USD|PEN|EUR)\s*/i, "").replace(/\s*(USD|PEN|EUR|€)$/i, "");
  let signo = 1;
  if (/^\(.*\)$/.test(s)) {
    signo = -1; // (1,200) contable
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    signo *= -1;
    s = s.slice(1);
  } else if (s.startsWith("+")) s = s.slice(1);
  s = s.replace(/[\s ']/g, "");
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  if (/^0\d/.test(s)) return null; // código, no número

  const ultComa = s.lastIndexOf(",");
  const ultPunto = s.lastIndexOf(".");
  let normal: string;
  if (ultComa >= 0 && ultPunto >= 0) {
    // El separador que va último es el decimal
    normal = ultComa > ultPunto ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (ultComa >= 0) {
    // Solo comas: miles si son grupos exactos de 3 ("1,234,567"), si no decimal
    normal = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if ((s.match(/\./g) ?? []).length > 1) {
    // "1.234.567" -> miles con punto
    if (!/^\d{1,3}(\.\d{3})+$/.test(s)) return null;
    normal = s.replace(/\./g, "");
  } else normal = s;

  if (!/^\d+(\.\d+)?$/.test(normal) && !/^\d*\.\d+$/.test(normal)) return null;
  const n = Number(normal) * signo;
  if (!Number.isFinite(n)) return null;
  return porcentaje ? n / 100 : n;
}

export function limpiarTabla(tabla: Tabla, op: OpcionesLimpiar) {
  const r: ReporteLimpiar = {
    celdasRecortadas: 0,
    filasVaciasQuitadas: 0,
    columnasVaciasQuitadas: [],
    celdasCapitalizadas: 0,
    numerosConvertidos: 0,
    duplicadosQuitados: 0,
  };
  const capitalizar = new Set(
    op.columnasCapitalizar.length ? op.columnasCapitalizar : tabla.columnas,
  );

  let filas: Fila[] = tabla.filas.map((f) => {
    const nueva: Fila = {};
    for (const c of tabla.columnas) {
      let v: Celda = f[c] ?? null;
      if (typeof v === "string") {
        if (op.recortarEspacios) {
          const t = v.replace(/[\s ]+/g, " ").trim();
          if (t !== v) r.celdasRecortadas++;
          v = t;
        }
        // Solo dígitos ("7654321") se deja: si Excel lo guardó como texto, casi
        // siempre es un código o DNI. Se convierte lo que trae formato.
        if (op.convertirNumeros && !/^\d+$/.test(v.trim())) {
          const n = textoANumero(v);
          if (n !== null) {
            v = n;
            r.numerosConvertidos++;
          }
        }
        if (typeof v === "string" && op.capitalizacion !== "ninguna" && capitalizar.has(c)) {
          const t =
            op.capitalizacion === "mayusculas"
              ? v.toLocaleUpperCase("es")
              : op.capitalizacion === "minusculas"
                ? v.toLocaleLowerCase("es")
                : titulo(v);
          if (t !== v) r.celdasCapitalizadas++;
          v = t;
        }
        if (typeof v === "string" && v === "") v = null;
      }
      nueva[c] = v;
    }
    return nueva;
  });

  let columnas = [...tabla.columnas];

  if (op.quitarFilasVacias) {
    const antes = filas.length;
    filas = filas.filter((f) => columnas.some((c) => !esVacio(f[c])));
    r.filasVaciasQuitadas = antes - filas.length;
  }

  if (op.quitarColumnasVacias) {
    r.columnasVaciasQuitadas = columnas.filter((c) => filas.every((f) => esVacio(f[c])));
    columnas = columnas.filter((c) => !r.columnasVaciasQuitadas.includes(c));
    for (const f of filas) for (const c of r.columnasVaciasQuitadas) delete f[c];
  }

  let duplicados: Fila[] = [];
  if (op.quitarDuplicados) {
    const claveCols = op.columnasDuplicado.length
      ? op.columnasDuplicado.filter((c) => columnas.includes(c))
      : columnas;
    const clave = (f: Fila) =>
      JSON.stringify(
        claveCols.map((c) => {
          const t = aTexto(f[c] ?? null);
          return op.duplicadosSinMayusculas ? t.trim().toLowerCase() : t;
        }),
      );
    const orden = op.mantener === "ultima" ? [...filas].reverse() : filas;
    const vistos = new Set<string>();
    const quedan: Fila[] = [];
    for (const f of orden) {
      const k = clave(f);
      if (vistos.has(k)) duplicados.push(f);
      else {
        vistos.add(k);
        quedan.push(f);
      }
    }
    if (op.mantener === "ultima") {
      quedan.reverse();
      duplicados = duplicados.reverse();
    }
    r.duplicadosQuitados = duplicados.length;
    filas = quedan;
  }

  return {
    tabla: { columnas, filas } as Tabla,
    duplicados: { columnas, filas: duplicados } as Tabla,
    reporte: r,
  };
}
