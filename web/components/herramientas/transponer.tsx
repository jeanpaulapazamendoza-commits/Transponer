"use client";

import { useMemo, useState } from "react";
import { CargaTabla, type TablaCargada } from "@/components/carga";
import { Aviso, CampoTexto, Descargas, Interruptor, Paso, Segmentado, SelectorColumnas, Vista } from "@/components/ui";
import {
  detectarGruposEmparejados,
  sugerirConfiguracion,
  transponerEmparejado,
  transponerSimple,
  type Grupos,
} from "@/lib/herramientas/transponer";

type Modo = "simple" | "emparejado";

export function Transponer() {
  const [datos, setDatos] = useState<TablaCargada | null>(null);
  const [modo, setModo] = useState<Modo>("simple");
  const [fijas, setFijas] = useState<string[]>([]);
  const [aTransponer, setATransponer] = useState<string[]>([]);
  const [grupos, setGrupos] = useState<Grupos>({});
  const [prefijos, setPrefijos] = useState<string[]>([]);
  const [nombreCat, setNombreCat] = useState("Variable");
  const [nombreVal, setNombreVal] = useState("Valor");
  const [nombrePos, setNombrePos] = useState("Posicion");
  const [conservarVacios, setConservarVacios] = useState(false);

  function alCargar(t: TablaCargada | null) {
    setDatos(t);
    if (!t) return;
    const cfg = sugerirConfiguracion(t.tabla);
    const g = detectarGruposEmparejados(t.tabla.columnas);
    setModo(cfg.modo);
    setGrupos(g);
    setPrefijos(Object.keys(g));
    setFijas(cfg.columnasFijas);
    setATransponer(cfg.modo === "simple" ? cfg.columnasATransponer : t.tabla.columnas.filter((c) => !cfg.columnasFijas.includes(c)));
  }

  const columnas = datos?.tabla.columnas ?? [];
  const enGrupos = new Set(prefijos.flatMap((p) => Object.values(grupos[p] ?? {})));

  const resultado = useMemo(() => {
    if (!datos) return null;
    if (modo === "simple") {
      const trans = aTransponer.filter((c) => !fijas.includes(c));
      if (!trans.length) return null;
      return transponerSimple(datos.tabla, fijas, trans, nombreCat || "Variable", nombreVal || "Valor", conservarVacios);
    }
    if (!prefijos.length) return null;
    const sel = Object.fromEntries(prefijos.map((p) => [p, grupos[p]]));
    return transponerEmparejado(
      datos.tabla,
      fijas.filter((c) => !enGrupos.has(c)),
      sel,
      nombrePos || "Posicion",
      conservarVacios,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, modo, fijas, aTransponer, prefijos, grupos, nombreCat, nombreVal, nombrePos, conservarVacios]);

  return (
    <>
      <Paso n={1} titulo="Sube el archivo en formato ancho">
        <CargaTabla onCambio={alCargar} />
        {datos && (
          <div className="mt-4">
            <Vista tabla={datos.tabla} filas={10} />
          </div>
        )}
      </Paso>

      {datos && (
        <Paso n={2} titulo="Configura la transposición">
          <div className="space-y-5">
            <Segmentado<Modo>
              valor={modo}
              onCambio={setModo}
              opciones={[
                {
                  valor: "simple",
                  etiqueta: "Simple",
                  ayuda: "Apila varias columnas en una sola: Lunes, Martes, Miércoles… → Día + Valor.",
                },
                {
                  valor: "emparejado",
                  etiqueta: "Emparejado",
                  ayuda: "Columnas relacionadas por número: P.1/Lt.1, P.2/Lt.2… → Posición + P + Lt, sin romper la pareja.",
                },
              ]}
            />

            {modo === "simple" ? (
              <>
                <div className="grid gap-5 lg:grid-cols-2">
                  <SelectorColumnas
                    etiqueta="Columnas fijas (se repiten en cada fila)"
                    columnas={columnas}
                    elegidas={fijas}
                    onCambio={(v) => {
                      setFijas(v);
                      setATransponer((a) => a.filter((c) => !v.includes(c)));
                    }}
                  />
                  <SelectorColumnas
                    etiqueta="Columnas a transponer (se apilan)"
                    columnas={columnas.filter((c) => !fijas.includes(c))}
                    elegidas={aTransponer.filter((c) => !fijas.includes(c))}
                    onCambio={setATransponer}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <CampoTexto etiqueta="Nombre de la columna de categoría" valor={nombreCat} onCambio={setNombreCat} />
                  <CampoTexto etiqueta="Nombre de la columna de valor" valor={nombreVal} onCambio={setNombreVal} />
                </div>
              </>
            ) : Object.keys(grupos).length === 0 ? (
              <Aviso>
                No hay columnas emparejadas por número (como «P. 1», «Lt. 1»). Usa el modo Simple o renombra las
                columnas.
              </Aviso>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-2">
                  <SelectorColumnas
                    etiqueta="Grupos a incluir"
                    columnas={Object.keys(grupos)}
                    elegidas={prefijos}
                    onCambio={setPrefijos}
                  />
                  <ul className="space-y-0.5 text-xs text-suave">
                    {prefijos.map((p) => (
                      <li key={p}>
                        <b className="text-texto">{p}</b> ← {Object.values(grupos[p]).join(", ")}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-3">
                  <SelectorColumnas
                    etiqueta="Columnas fijas"
                    columnas={columnas.filter((c) => !enGrupos.has(c))}
                    elegidas={fijas.filter((c) => !enGrupos.has(c))}
                    onCambio={setFijas}
                  />
                  <CampoTexto etiqueta="Nombre de la columna de posición" valor={nombrePos} onCambio={setNombrePos} />
                </div>
              </div>
            )}

            <Interruptor
              activo={conservarVacios}
              onCambio={setConservarVacios}
              ayuda="Apagado: se descartan las filas que quedan sin valor. El 0 nunca se considera vacío."
            >
              Conservar filas con valores vacíos
            </Interruptor>
          </div>
        </Paso>
      )}

      {datos && (
        <Paso
          n={3}
          titulo="Resultado"
          derecha={resultado && resultado.filas.length > 0 && <Descargas tabla={resultado} archivo={`${datos.nombre}_transpuesto`} hoja="Transpuesto" />}
        >
          {!resultado ? (
            <Aviso>Elige al menos una columna a transponer.</Aviso>
          ) : resultado.filas.length === 0 ? (
            <Aviso>El resultado quedó vacío con esta configuración.</Aviso>
          ) : (
            <Vista tabla={resultado} />
          )}
        </Paso>
      )}
    </>
  );
}
