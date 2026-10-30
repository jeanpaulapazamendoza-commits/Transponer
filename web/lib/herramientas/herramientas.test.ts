import { describe, expect, it } from "vitest";
import { aTexto, desdeMatriz, nombresUnicos } from "../tabla";
import {
  detectarGruposEmparejados,
  sugerirConfiguracion,
  transponerEmparejado,
  transponerSimple,
} from "./transponer";
import { unirTablas } from "./unir";
import { claveNormalizada, cruzarTablas, type OpcionesCruce } from "./cruzar";
import { limpiarTabla, textoANumero, type OpcionesLimpiar } from "./limpiar";
import { dividirPorColumna, nombresHojaUnicos } from "./dividir";

describe("tabla", () => {
  it("nombres de columna únicos y no vacíos", () => {
    expect(nombresUnicos(["A", "", "A", null, "A"])).toEqual([
      "A",
      "Columna 2",
      "A (2)",
      "Columna 4",
      "A (3)",
    ]);
  });

  it("aguanta cientos de miles de filas", () => {
    const matriz = [["A"], ...Array.from({ length: 300_000 }, (_, i) => [i])];
    expect(desdeMatriz(matriz).filas).toHaveLength(300_000);
  });

  it("las fechas se escriben en hora local, sin la Z de UTC", () => {
    // Así llegan de SheetJS: medianoche local, que en Lima son las 05:00 UTC.
    expect(aTexto(new Date(2026, 4, 6))).toBe("2026-05-06");
    expect(aTexto(new Date(2026, 4, 6, 14, 30))).toBe("2026-05-06 14:30");
    expect(aTexto(new Date(2026, 4, 6, 14, 29, 59, 999))).toBe("2026-05-06 14:30");
    expect(aTexto(new Date(2026, 4, 6, 8, 5, 9))).toBe("2026-05-06 08:05:09");
    expect(aTexto(new Date(Number.NaN))).toBe("");
  });
});

describe("transponer", () => {
  const ancha = desdeMatriz([
    ["Tienda", "P. 1", "Lt. 1", "P. 2", "Lt. 2"],
    ["T1", "A", 10, "B", 20],
    ["T2", "C", 5, null, null],
  ]);

  it("detecta grupos emparejados", () => {
    expect(detectarGruposEmparejados(ancha.columnas)).toEqual({
      P: { 1: "P. 1", 2: "P. 2" },
      Lt: { 1: "Lt. 1", 2: "Lt. 2" },
    });
    expect(sugerirConfiguracion(ancha).modo).toBe("emparejado");
  });

  it("emparejado mantiene la relación y quita posiciones vacías", () => {
    const g = detectarGruposEmparejados(ancha.columnas);
    const r = transponerEmparejado(ancha, ["Tienda"], g);
    expect(r.columnas).toEqual(["Tienda", "Posicion", "P", "Lt"]);
    expect(r.filas).toEqual([
      { Tienda: "T1", Posicion: 1, P: "A", Lt: 10 },
      { Tienda: "T1", Posicion: 2, P: "B", Lt: 20 },
      { Tienda: "T2", Posicion: 1, P: "C", Lt: 5 },
    ]);
    expect(transponerEmparejado(ancha, ["Tienda"], g, "Posicion", true).filas).toHaveLength(4);
  });

  it("simple sugiere el prefijo de tabla dinámica", () => {
    const t = desdeMatriz([
      ["Zona", "Suma de Lunes", "Suma de Martes"],
      ["Norte", 1, 0],
    ]);
    const cfg = sugerirConfiguracion(t);
    expect(cfg).toEqual({
      modo: "simple",
      columnasFijas: ["Zona"],
      columnasATransponer: ["Suma de Lunes", "Suma de Martes"],
    });
    const r = transponerSimple(t, ["Zona"], ["Suma de Lunes", "Suma de Martes"], "Dia", "Valor");
    // el 0 no es vacío
    expect(r.filas).toEqual([
      { Zona: "Norte", Dia: "Suma de Lunes", Valor: 1 },
      { Zona: "Norte", Dia: "Suma de Martes", Valor: 0 },
    ]);
  });

  it("las columnas nuevas no pisan a las fijas que se llaman igual", () => {
    const t = desdeMatriz([
      ["Valor", "Variable", "Ene", "Feb"],
      ["A", "x", 1, 2],
    ]);
    const r = transponerSimple(t, ["Valor", "Variable"], ["Ene", "Feb"]);
    expect(r.columnas).toEqual(["Valor", "Variable", "Variable (2)", "Valor (2)"]);
    expect(r.filas[0]).toEqual({ Valor: "A", Variable: "x", "Variable (2)": "Ene", "Valor (2)": 1 });
    // Mismo nombre para las dos columnas nuevas
    expect(transponerSimple(t, [], ["Ene"], "Dato", "Dato").columnas).toEqual(["Dato", "Dato (2)"]);
  });

  it("emparejado: una fija con el nombre de un grupo o de la posición no se pisa", () => {
    const t = desdeMatriz([
      ["P", "Posicion", "P 1", "P 2"],
      ["fijo", "x", "a", "b"],
    ]);
    const r = transponerEmparejado(t, ["P", "Posicion"], detectarGruposEmparejados(t.columnas));
    expect(r.columnas).toEqual(["P", "Posicion", "Posicion (2)", "P (2)"]);
    expect(r.filas[1]).toEqual({ P: "fijo", Posicion: "x", "Posicion (2)": 2, "P (2)": "b" });
  });
});

describe("unir", () => {
  const a = desdeMatriz([["Código", "Precio"], [1, 10]]);
  const b = desdeMatriz([[" precio ", "código", "Stock"], [20, 2, 5]]);

  it("alinea columnas aunque cambie orden y mayúsculas", () => {
    const { tabla, reporte } = unirTablas(
      [
        { origen: "a", tabla: a },
        { origen: "b", tabla: b },
      ],
      { columnas: "todas", ignorarMayusculas: true, columnaOrigen: "Archivo" },
    );
    expect(tabla.columnas).toEqual(["Archivo", "Código", "Precio", "Stock"]);
    expect(tabla.filas).toEqual([
      { Archivo: "a", Código: 1, Precio: 10, Stock: null },
      { Archivo: "b", Código: 2, Precio: 20, Stock: 5 },
    ]);
    expect(reporte[0].faltantes).toEqual(["Stock"]);
  });

  it("modo comunes descarta lo que no está en todas", () => {
    const { tabla, reporte } = unirTablas(
      [
        { origen: "a", tabla: a },
        { origen: "b", tabla: b },
      ],
      { columnas: "comunes", ignorarMayusculas: true, columnaOrigen: null },
    );
    expect(tabla.columnas).toEqual(["Código", "Precio"]);
    expect(reporte[1].descartadas).toEqual(["Stock"]);
  });

  it("la columna de origen no pisa una columna 'Origen' de los archivos", () => {
    const x = desdeMatriz([["Origen", "N"], ["Lima", 1]]);
    const { tabla } = unirTablas([{ origen: "x.xlsx", tabla: x }], {
      columnas: "todas",
      ignorarMayusculas: true,
      columnaOrigen: "Origen",
    });
    expect(tabla.columnas).toEqual(["Origen (2)", "Origen", "N"]);
    expect(tabla.filas).toEqual([{ "Origen (2)": "x.xlsx", Origen: "Lima", N: 1 }]);
  });
});

describe("cruzar", () => {
  const a = desdeMatriz([["DNI", "Nombre"], ["00123", "Ana"], [456, "Luis"], [789, "Eva"]]);
  const b = desdeMatriz([["dni", "Nombre", "Sueldo"], [123, "ANA", 1000], [456, "Luis", 2000], [456, "Luis", 2100], [999, "Zoe", 3000]]);
  const base: OpcionesCruce = {
    claveA: "DNI",
    claveB: "dni",
    traer: ["Nombre", "Sueldo"],
    tipo: "izquierda",
    duplicadosB: "primera",
    normalizar: true,
    ignorarCerosIzquierda: true,
    marcarCruce: true,
  };

  it("BUSCARV con ceros a la izquierda, duplicados y choque de nombres", () => {
    const { tabla, resumen } = cruzarTablas(a, b, base);
    expect(tabla.columnas).toEqual(["DNI", "Nombre", "Nombre (B)", "Sueldo", "¿Cruzó?"]);
    expect(tabla.filas.map((f) => [f.DNI, f.Sueldo, f["¿Cruzó?"]])).toEqual([
      ["00123", 1000, "Sí"],
      [456, 2000, "Sí"],
      [789, null, "No"],
    ]);
    expect(resumen).toEqual({ cruzadas: 2, sinCruceA: 1, sinCruceB: 1, clavesDuplicadasB: 1 });
  });

  it("tipos interna, completa y faltantes", () => {
    expect(cruzarTablas(a, b, { ...base, tipo: "interna", duplicadosB: "todas" }).tabla.filas).toHaveLength(3);
    const completa = cruzarTablas(a, b, { ...base, tipo: "completa" }).tabla.filas;
    expect(completa.at(-1)).toMatchObject({ DNI: 999, Sueldo: 3000, "¿Cruzó?": "Solo en B" });
    const falt = cruzarTablas(a, b, { ...base, tipo: "faltantes" }).tabla;
    expect(falt.columnas).toEqual(["DNI", "Nombre"]);
    expect(falt.filas).toEqual([{ DNI: 789, Nombre: "Eva" }]);
  });

  it("cruzar de nuevo un resultado no pisa «¿Cruzó?» ni los sufijos (B)", () => {
    const ya = desdeMatriz([["K", "X", "¿Cruzó?"], [1, "a", "Sí"]]);
    const otra = desdeMatriz([["K", "X", "X (B)"], [1, "b", "c"]]);
    const { tabla } = cruzarTablas(ya, otra, { ...base, claveA: "K", claveB: "K", traer: ["X", "X (B)"] });
    expect(tabla.columnas).toEqual(["K", "X", "¿Cruzó?", "X (B)", "X (B) (B)", "¿Cruzó? (2)"]);
    expect(tabla.filas[0]).toEqual({ K: 1, X: "a", "¿Cruzó?": "Sí", "X (B)": "b", "X (B) (B)": "c", "¿Cruzó? (2)": "Sí" });
  });

  it("una fecha cruza con la misma fecha escrita como texto", () => {
    const conFecha = desdeMatriz([["Día", "Venta"], [new Date(2026, 4, 6), 10], [new Date(2026, 11, 25), 20]]);
    const conTexto = desdeMatriz([["Día", "Feriado"], ["06/05/2026", "No"], ["25-12-2026", "Sí"], ["2026-01-01", "Sí"]]);
    const { resumen } = cruzarTablas(conFecha, conTexto, { ...base, claveA: "Día", claveB: "Día", traer: ["Feriado"] });
    expect(resumen.cruzadas).toBe(2);
    expect(claveNormalizada("6/5/2026", base)).toBe("2026-05-06");
    // Sin normalizar, el texto se compara tal cual
    expect(claveNormalizada("06/05/2026", { normalizar: false, ignorarCerosIzquierda: false })).toBe("06/05/2026");
  });
});

describe("limpiar", () => {
  it("convierte textos a número sin romper códigos", () => {
    expect(textoANumero("1,234.50")).toBe(1234.5);
    expect(textoANumero("1.234,50")).toBe(1234.5);
    expect(textoANumero("S/ 1 234,50")).toBe(1234.5);
    expect(textoANumero("1,5")).toBe(1.5);
    expect(textoANumero("15%")).toBe(0.15);
    expect(textoANumero("(200)")).toBe(-200);
    expect(textoANumero("0.5")).toBe(0.5);
    expect(textoANumero("00123")).toBeNull();
    expect(textoANumero("12-05")).toBeNull();
    expect(textoANumero("abc")).toBeNull();
  });

  const op: OpcionesLimpiar = {
    recortarEspacios: true,
    quitarFilasVacias: true,
    quitarColumnasVacias: true,
    capitalizacion: "titulo",
    columnasCapitalizar: ["Nombre"],
    convertirNumeros: true,
    quitarDuplicados: true,
    columnasDuplicado: [],
    mantener: "primera",
    duplicadosSinMayusculas: true,
  };

  it("aplica todos los pasos y reporta", () => {
    const t = desdeMatriz([
      ["Nombre", "Monto", "Nada"],
      ["  juan   pérez ", "1,200.00", null],
      [null, "  ", null],
      ["JUAN PÉREZ", 1200, ""],
      ["maría", "00123", null],
      ["luis", "7654321", null],
    ]);
    const { tabla, duplicados, reporte } = limpiarTabla(t, op);
    expect(tabla.columnas).toEqual(["Nombre", "Monto"]);
    expect(tabla.filas).toEqual([
      { Nombre: "Juan Pérez", Monto: 1200 },
      { Nombre: "María", Monto: "00123" },
      { Nombre: "Luis", Monto: "7654321" },
    ]);
    expect(duplicados.filas).toHaveLength(1);
    expect(reporte).toMatchObject({
      filasVaciasQuitadas: 1,
      columnasVaciasQuitadas: ["Nada"],
      numerosConvertidos: 1,
      duplicadosQuitados: 1,
    });
  });

  it("mantener la última aparición", () => {
    const t = desdeMatriz([["K", "V"], ["a", 1], ["a", 2]]);
    const { tabla } = limpiarTabla(t, { ...op, columnasDuplicado: ["K"], mantener: "ultima" });
    expect(tabla.filas).toEqual([{ K: "a", V: 2 }]);
  });
});

describe("dividir", () => {
  it("parte por valor, ordena y deja los vacíos al final", () => {
    const t = desdeMatriz([["Zona", "X"], ["Sur", 1], [null, 2], ["Norte", 3], ["Sur", 4]]);
    const partes = dividirPorColumna(t, "Zona", { ordenar: true, quitarColumna: true });
    expect(partes.map((p) => [p.valor, p.tabla.filas.length])).toEqual([
      ["Norte", 1],
      ["Sur", 2],
      ["(vacío)", 1],
    ]);
    expect(partes[0].tabla.columnas).toEqual(["X"]);
  });

  it("nombres de hoja válidos y únicos", () => {
    expect(nombresHojaUnicos(["Lima/Norte", "lima_norte", "x".repeat(40)])).toEqual([
      "Lima_Norte",
      "lima_norte (2)",
      "x".repeat(31),
    ]);
  });
});
