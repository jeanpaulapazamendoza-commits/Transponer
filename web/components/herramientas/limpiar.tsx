"use client";

import { useMemo, useState } from "react";
import { CargaTabla, type TablaCargada } from "@/components/carga";
import { Aviso, Cifras, Descargas, Interruptor, Paso, Segmentado, SelectorColumnas, Vista } from "@/components/ui";
import { limpiarTabla, type Capitalizacion, type OpcionesLimpiar } from "@/lib/herramientas/limpiar";

const INICIALES: OpcionesLimpiar = {
  recortarEspacios: true,
  quitarFilasVacias: true,
  quitarColumnasVacias: true,
  capitalizacion: "ninguna",
  columnasCapitalizar: [],
  convertirNumeros: true,
  quitarDuplicados: true,
  columnasDuplicado: [],
  mantener: "primera",
  duplicadosSinMayusculas: false,
};

export function Limpiar() {
  const [datos, setDatos] = useState<TablaCargada | null>(null);
  const [op, setOp] = useState<OpcionesLimpiar>(INICIALES);
  const [verDuplicados, setVerDuplicados] = useState(false);
  const cambiar = (c: Partial<OpcionesLimpiar>) => setOp((o) => ({ ...o, ...c }));

  const res = useMemo(() => (datos ? limpiarTabla(datos.tabla, op) : null), [datos, op]);
  const columnas = datos?.tabla.columnas ?? [];

  return (
    <>
      <Paso n={1} titulo="Sube el archivo">
        <CargaTabla
          onCambio={(t) => {
            setDatos(t);
            setOp((o) => ({ ...o, columnasCapitalizar: [], columnasDuplicado: [] }));
          }}
        />
      </Paso>

      {datos && (
        <Paso n={2} titulo="Qué limpiar">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <Interruptor
                activo={op.recortarEspacios}
                onCambio={(v) => cambiar({ recortarEspacios: v })}
                ayuda="«  Juan   Pérez » → «Juan Pérez»"
              >
                Quitar espacios sobrantes
              </Interruptor>
              <Interruptor
                activo={op.convertirNumeros}
                onCambio={(v) => cambiar({ convertirNumeros: v })}
                ayuda="«1,200.50», «S/ 1 200,50» o «15%» pasan a número. Los códigos y DNI («00123», «7654321») se quedan como texto."
              >
                Convertir números guardados como texto
              </Interruptor>
              <Interruptor activo={op.quitarFilasVacias} onCambio={(v) => cambiar({ quitarFilasVacias: v })}>
                Quitar filas vacías
              </Interruptor>
              <Interruptor activo={op.quitarColumnasVacias} onCambio={(v) => cambiar({ quitarColumnasVacias: v })}>
                Quitar columnas vacías
              </Interruptor>
              <div className="space-y-2 pt-2">
                <span className="text-sm text-suave">Mayúsculas</span>
                <Segmentado<Capitalizacion>
                  valor={op.capitalizacion}
                  onCambio={(v) => cambiar({ capitalizacion: v })}
                  opciones={[
                    { valor: "ninguna", etiqueta: "Sin cambio" },
                    { valor: "mayusculas", etiqueta: "MAYÚSCULAS" },
                    { valor: "minusculas", etiqueta: "minúsculas" },
                    { valor: "titulo", etiqueta: "Tipo Título" },
                  ]}
                />
                {op.capitalizacion !== "ninguna" && (
                  <SelectorColumnas
                    etiqueta="Solo en estas columnas"
                    ayuda="Si no eliges ninguna, se aplica a todas."
                    columnas={columnas}
                    elegidas={op.columnasCapitalizar}
                    onCambio={(v) => cambiar({ columnasCapitalizar: v })}
                  />
                )}
              </div>
            </div>
            <div className="space-y-3">
              <Interruptor activo={op.quitarDuplicados} onCambio={(v) => cambiar({ quitarDuplicados: v })}>
                Quitar duplicados
              </Interruptor>
              {op.quitarDuplicados && (
                <div className="space-y-3 border-l-2 border-borde pl-4">
                  <SelectorColumnas
                    etiqueta="Una fila es duplicada si se repiten estas columnas"
                    ayuda="Si no eliges ninguna, se compara la fila entera."
                    columnas={columnas}
                    elegidas={op.columnasDuplicado}
                    onCambio={(v) => cambiar({ columnasDuplicado: v })}
                  />
                  <Segmentado<"primera" | "ultima">
                    valor={op.mantener}
                    onCambio={(v) => cambiar({ mantener: v })}
                    opciones={[
                      { valor: "primera", etiqueta: "Quedarse con la primera" },
                      { valor: "ultima", etiqueta: "Quedarse con la última" },
                    ]}
                  />
                  <Interruptor
                    activo={op.duplicadosSinMayusculas}
                    onCambio={(v) => cambiar({ duplicadosSinMayusculas: v })}
                  >
                    Al comparar, «ANA» y «ana» son iguales
                  </Interruptor>
                </div>
              )}
            </div>
          </div>
        </Paso>
      )}

      {datos && res && (
        <Paso
          n={3}
          titulo="Resultado"
          derecha={
            <Descargas
              tabla={res.tabla}
              archivo={`${datos.nombre}_limpio`}
              hoja="Limpio"
              extra={res.duplicados.filas.length ? [{ nombre: "Duplicados quitados", tabla: res.duplicados }] : undefined}
            />
          }
        >
          <div className="space-y-4">
            <Cifras
              items={[
                { etiqueta: "Celdas con espacios corregidos", valor: res.reporte.celdasRecortadas },
                { etiqueta: "Textos convertidos a número", valor: res.reporte.numerosConvertidos },
                { etiqueta: "Filas vacías quitadas", valor: res.reporte.filasVaciasQuitadas },
                { etiqueta: "Duplicados quitados", valor: res.reporte.duplicadosQuitados, tono: "aviso" },
              ]}
            />
            {res.reporte.columnasVaciasQuitadas.length > 0 && (
              <Aviso tono="ok">Columnas vacías quitadas: {res.reporte.columnasVaciasQuitadas.join(", ")}</Aviso>
            )}
            {res.duplicados.filas.length > 0 && (
              <p className="text-xs text-suave">
                El Excel descargado trae una hoja aparte con los duplicados quitados.{" "}
                <button type="button" className="text-acento hover:underline" onClick={() => setVerDuplicados(!verDuplicados)}>
                  {verDuplicados ? "Ver la tabla limpia" : "Verlos aquí"}
                </button>
              </p>
            )}
            <Vista tabla={verDuplicados && res.duplicados.filas.length ? res.duplicados : res.tabla} />
          </div>
        </Paso>
      )}
    </>
  );
}
