"use client";

import { useMemo, useState } from "react";
import { ZonaArchivos } from "@/components/carga";
import { Aviso, CampoTexto, Descargas, Interruptor, Paso, Segmentado, Vista } from "@/components/ui";
import { leerArchivo, leerHoja, type LibroCargado } from "@/lib/archivo";
import { unirTablas } from "@/lib/herramientas/unir";

interface Archivo {
  id: number;
  libro: LibroCargado;
  /** Hojas elegidas de este archivo. */
  hojas: string[];
  filaEnc: number;
}

let siguienteId = 1;

export function Unir() {
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [errores, setErrores] = useState<string[]>([]);
  const [columnas, setColumnas] = useState<"todas" | "comunes">("todas");
  const [ignorarMayus, setIgnorarMayus] = useState(true);
  const [conOrigen, setConOrigen] = useState(true);
  const [nombreOrigen, setNombreOrigen] = useState("Origen");

  async function agregar(fs: File[]) {
    const nuevos: Archivo[] = [];
    const errs: string[] = [];
    for (const f of fs) {
      try {
        const libro = await leerArchivo(f);
        nuevos.push({ id: siguienteId++, libro, hojas: libro.hojas.slice(0, 1), filaEnc: 1 });
      } catch (e) {
        errs.push(`${f.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setErrores(errs);
    setArchivos((a) => [...a, ...nuevos]);
  }

  const cambiar = (id: number, cambio: Partial<Archivo>) =>
    setArchivos((a) => a.map((x) => (x.id === id ? { ...x, ...cambio } : x)));

  const resultado = useMemo(() => {
    const entradas = archivos.flatMap((a) =>
      a.hojas.map((h) => ({
        origen: a.libro.hojas.length > 1 ? `${a.libro.nombre} › ${h}` : a.libro.nombre,
        tabla: leerHoja(a.libro, h, a.filaEnc),
      })),
    );
    if (entradas.length < 1) return null;
    return unirTablas(entradas, {
      columnas,
      ignorarMayusculas: ignorarMayus,
      columnaOrigen: conOrigen ? nombreOrigen || "Origen" : null,
    });
  }, [archivos, columnas, ignorarMayus, conOrigen, nombreOrigen]);

  const totalEntradas = archivos.reduce((n, a) => n + a.hojas.length, 0);

  return (
    <>
      <Paso n={1} titulo="Sube los archivos">
        <div className="space-y-3">
          <ZonaArchivos multiple onArchivos={agregar} compacta={archivos.length > 0} />
          {errores.map((e) => (
            <Aviso key={e}>No se pudo leer {e}</Aviso>
          ))}
          {archivos.length > 0 && (
            <ul className="divide-y divide-borde rounded-lg border border-borde">
              {archivos.map((a) => (
                <li key={a.id} className="space-y-2 p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate font-medium" title={a.libro.nombre}>
                      {a.libro.nombre}
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-suave">
                      Encabezado en fila
                      <input
                        type="number"
                        min={1}
                        value={a.filaEnc}
                        onChange={(e) => cambiar(a.id, { filaEnc: Math.max(1, Number(e.target.value) || 1) })}
                        className="w-16 rounded-md border border-borde bg-fondo px-2 py-1"
                      />
                    </label>
                    <button
                      type="button"
                      className="text-xs text-aviso hover:underline"
                      onClick={() => setArchivos((x) => x.filter((y) => y.id !== a.id))}
                    >
                      Quitar
                    </button>
                  </div>
                  {a.libro.hojas.length > 1 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-suave">Hojas:</span>
                      {a.libro.hojas.map((h) => {
                        const on = a.hojas.includes(h);
                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() =>
                              cambiar(a.id, {
                                hojas: a.libro.hojas.filter((x) => (x === h ? !on : a.hojas.includes(x))),
                              })
                            }
                            className={`rounded-md border px-2 py-0.5 text-xs ${
                              on ? "border-acento bg-acento-suave text-acento" : "border-borde text-suave"
                            }`}
                          >
                            {h}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className="text-xs text-acento hover:underline"
                        onClick={() => cambiar(a.id, { hojas: [...a.libro.hojas] })}
                      >
                        Todas
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Paso>

      {archivos.length > 0 && (
        <Paso n={2} titulo="Cómo alinear las columnas">
          <div className="space-y-4">
            <Segmentado
              valor={columnas}
              onCambio={setColumnas}
              opciones={[
                { valor: "todas", etiqueta: "Todas las columnas", ayuda: "Si un archivo no tiene una columna, esa parte queda vacía." },
                { valor: "comunes", etiqueta: "Solo las comunes", ayuda: "Solo quedan las columnas que están en todos los archivos." },
              ]}
            />
            <Interruptor
              activo={ignorarMayus}
              onCambio={setIgnorarMayus}
              ayuda="«Precio», «PRECIO» y « precio » se tratan como la misma columna."
            >
              Ignorar mayúsculas y espacios en los nombres de columna
            </Interruptor>
            <div className="flex flex-wrap items-end gap-4">
              <Interruptor activo={conOrigen} onCambio={setConOrigen} ayuda="Para saber de qué archivo u hoja vino cada fila.">
                Añadir columna con el origen
              </Interruptor>
              {conOrigen && (
                <div className="w-56">
                  <CampoTexto etiqueta="Nombre de la columna" valor={nombreOrigen} onCambio={setNombreOrigen} />
                </div>
              )}
            </div>
          </div>
        </Paso>
      )}

      {resultado && (
        <Paso
          n={3}
          titulo={`Resultado: ${totalEntradas} ${totalEntradas === 1 ? "tabla" : "tablas"} unidas`}
          derecha={resultado.tabla.filas.length > 0 && <Descargas tabla={resultado.tabla} archivo="unido" hoja="Unido" />}
        >
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-suave">
                  <tr>
                    <th className="py-1 pr-3 font-normal">Origen</th>
                    <th className="py-1 pr-3 text-right font-normal">Filas</th>
                    <th className="py-1 font-normal">Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.reporte.map((r) => (
                    <tr key={r.origen} className="border-t border-borde align-top">
                      <td className="py-1.5 pr-3">{r.origen}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{r.filas.toLocaleString("es-PE")}</td>
                      <td className="py-1.5">
                        {r.faltantes.length === 0 && r.descartadas.length === 0 && <span className="text-acento">Todo alineado</span>}
                        {r.faltantes.length > 0 && <div className="text-aviso">Le faltan: {r.faltantes.join(", ")}</div>}
                        {r.descartadas.length > 0 && <div className="text-suave">No pasaron: {r.descartadas.join(", ")}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Vista tabla={resultado.tabla} />
          </div>
        </Paso>
      )}
    </>
  );
}
