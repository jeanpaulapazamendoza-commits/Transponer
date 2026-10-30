"use client";

import { useMemo, useState } from "react";
import { CargaTabla, type TablaCargada } from "@/components/carga";
import { Aviso, Boton, Interruptor, Paso, Segmentado, Selector, Vista } from "@/components/ui";
import { descargarExcel, descargarZip } from "@/lib/archivo";
import { dividirPorColumna } from "@/lib/herramientas/dividir";

type Salida = "hojas" | "zip-xlsx" | "zip-csv";

/** Más de esto y probablemente se eligió la columna equivocada (un ID, una fecha). */
const MUCHAS_PARTES = 200;

export function Dividir() {
  const [datos, setDatos] = useState<TablaCargada | null>(null);
  const [columna, setColumna] = useState("");
  const [ordenar, setOrdenar] = useState(true);
  const [quitarColumna, setQuitarColumna] = useState(false);
  const [salida, setSalida] = useState<Salida>("hojas");
  const [vista, setVista] = useState(0);
  const [generando, setGenerando] = useState(false);

  const partes = useMemo(
    () => (datos && columna ? dividirPorColumna(datos.tabla, columna, { ordenar, quitarColumna }) : []),
    [datos, columna, ordenar, quitarColumna],
  );

  async function descargar() {
    if (!datos) return;
    setGenerando(true);
    try {
      const lista = partes.map((p) => ({ nombre: p.valor, tabla: p.tabla }));
      const nombre = `${datos.nombre}_por_${columna}`;
      if (salida === "hojas") descargarExcel(lista, nombre);
      else await descargarZip(lista, salida === "zip-xlsx" ? "xlsx" : "csv", nombre);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <>
      <Paso n={1} titulo="Sube el archivo">
        <CargaTabla
          onCambio={(t) => {
            setDatos(t);
            setColumna(t?.tabla.columnas[0] ?? "");
            setVista(0);
          }}
        />
      </Paso>

      {datos && (
        <Paso n={2} titulo="Cómo dividir">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <Selector
                etiqueta="Dividir según la columna"
                valor={columna}
                onCambio={(c) => {
                  setColumna(c);
                  setVista(0);
                }}
                opciones={datos.tabla.columnas}
              />
              <Interruptor activo={ordenar} onCambio={setOrdenar} ayuda="Apagado: en el orden en que aparecen en el archivo.">
                Ordenar alfabéticamente
              </Interruptor>
              <Interruptor activo={quitarColumna} onCambio={setQuitarColumna} ayuda="Ya va en el nombre de la hoja o del archivo.">
                Quitar la columna de cada parte
              </Interruptor>
            </div>
            <div className="space-y-2">
              <span className="text-sm text-suave">Formato de salida</span>
              <Segmentado<Salida>
                valor={salida}
                onCambio={setSalida}
                opciones={[
                  { valor: "hojas", etiqueta: "Un Excel, una hoja por valor" },
                  { valor: "zip-xlsx", etiqueta: "ZIP de Excel" },
                  { valor: "zip-csv", etiqueta: "ZIP de CSV" },
                ]}
              />
            </div>
          </div>
        </Paso>
      )}

      {datos && partes.length > 0 && (
        <Paso
          n={3}
          titulo={`${partes.length} ${partes.length === 1 ? "parte" : "partes"}`}
          derecha={
            <Boton onClick={descargar} deshabilitado={generando}>
              {generando ? "Generando…" : "Descargar"}
            </Boton>
          }
        >
          <div className="space-y-4">
            {partes.length > MUCHAS_PARTES && (
              <Aviso>
                La columna «{columna}» genera {partes.length} partes. ¿Seguro que es la columna correcta?
              </Aviso>
            )}
            <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
              {partes.map((p, i) => (
                <button
                  key={p.valor}
                  type="button"
                  onClick={() => setVista(i)}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    i === vista ? "border-acento bg-acento-suave text-acento" : "border-borde text-suave hover:border-suave"
                  }`}
                >
                  {p.valor} <span className="opacity-70">({p.tabla.filas.length.toLocaleString("es-PE")})</span>
                </button>
              ))}
            </div>
            {partes[vista] && <Vista key={vista} tabla={partes[vista].tabla} filas={20} />}
          </div>
        </Paso>
      )}
    </>
  );
}
