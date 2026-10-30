"use client";

import { useMemo, useState } from "react";
import { CargaTabla, type TablaCargada } from "@/components/carga";
import { Aviso, Cifras, Descargas, Interruptor, Paso, Segmentado, Selector, SelectorColumnas, Vista } from "@/components/ui";
import { cruzarTablas, type TipoCruce } from "@/lib/herramientas/cruzar";

/** Adivina la columna clave de B: la que se llama igual que la de A, sin importar mayúsculas. */
function parecida(columnas: string[], nombre: string) {
  const n = nombre.trim().toLowerCase();
  return columnas.find((c) => c.trim().toLowerCase() === n) ?? columnas[0] ?? "";
}

export function Cruzar() {
  const [a, setA] = useState<TablaCargada | null>(null);
  const [b, setB] = useState<TablaCargada | null>(null);
  const [claveA, setClaveA] = useState("");
  const [claveB, setClaveB] = useState("");
  const [traer, setTraer] = useState<string[]>([]);
  const [tipo, setTipo] = useState<TipoCruce>("izquierda");
  const [duplicados, setDuplicados] = useState<"primera" | "todas">("primera");
  const [normalizar, setNormalizar] = useState(true);
  const [ceros, setCeros] = useState(false);
  const [marcar, setMarcar] = useState(true);

  function alCargarA(t: TablaCargada | null) {
    setA(t);
    const k = t?.tabla.columnas[0] ?? "";
    setClaveA(k);
    if (b) setClaveB(parecida(b.tabla.columnas, k));
  }
  function alCargarB(t: TablaCargada | null) {
    setB(t);
    if (!t) return;
    const k = parecida(t.tabla.columnas, claveA);
    setClaveB(k);
    setTraer(t.tabla.columnas.filter((c) => c !== k));
  }

  const resultado = useMemo(() => {
    if (!a || !b || !claveA || !claveB) return null;
    return cruzarTablas(a.tabla, b.tabla, {
      claveA,
      claveB,
      traer: traer.filter((c) => c !== claveB),
      tipo,
      duplicadosB: duplicados,
      normalizar,
      ignorarCerosIzquierda: ceros,
      marcarCruce: marcar,
    });
  }, [a, b, claveA, claveB, traer, tipo, duplicados, normalizar, ceros, marcar]);

  return (
    <>
      <div className="grid gap-x-5 lg:grid-cols-2">
        <Paso n={1} titulo="Tabla principal (A)">
          <CargaTabla onCambio={alCargarA} texto="La tabla a la que le quieres traer datos" />
          {a && (
            <div className="mt-3">
              <Selector etiqueta="Columna clave en A" valor={claveA} onCambio={setClaveA} opciones={a.tabla.columnas} />
            </div>
          )}
        </Paso>
        <Paso n={2} titulo="Tabla de búsqueda (B)">
          <CargaTabla onCambio={alCargarB} texto="La tabla de donde salen los datos" />
          {b && (
            <div className="mt-3">
              <Selector
                etiqueta="Columna clave en B"
                valor={claveB}
                onCambio={(k) => {
                  setClaveB(k);
                  setTraer((t) => t.filter((c) => c !== k));
                }}
                opciones={b.tabla.columnas}
              />
            </div>
          )}
        </Paso>
      </div>

      {a && b && (
        <Paso n={3} titulo="Qué traer y cómo cruzar">
          <div className="space-y-5">
            <SelectorColumnas
              etiqueta="Columnas de B que se agregan a A"
              columnas={b.tabla.columnas.filter((c) => c !== claveB)}
              elegidas={traer}
              onCambio={setTraer}
            />
            <Segmentado<TipoCruce>
              valor={tipo}
              onCambio={setTipo}
              opciones={[
                { valor: "izquierda", etiqueta: "Todo A", ayuda: "Como BUSCARV: todas las filas de A; lo que no está en B queda vacío." },
                { valor: "interna", etiqueta: "Solo coincidencias", ayuda: "Solo las filas de A que encontraron pareja en B." },
                { valor: "completa", etiqueta: "A + lo que sobra de B", ayuda: "Todo A, más las filas de B que no estaban en A." },
                { valor: "faltantes", etiqueta: "Lo que falta en B", ayuda: "Solo las filas de A que NO están en B: los #N/A, listos para revisar." },
              ]}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Interruptor activo={normalizar} onCambio={setNormalizar} ayuda="«ABC-1 » cruza con «abc-1»">
                Ignorar mayúsculas y espacios en la clave
              </Interruptor>
              <Interruptor activo={ceros} onCambio={setCeros} ayuda="«00123» cruza con 123. Útil para códigos y DNI.">
                Ignorar ceros a la izquierda
              </Interruptor>
              <Interruptor activo={marcar} onCambio={setMarcar} ayuda="Agrega la columna «¿Cruzó?» con Sí / No.">
                Marcar si cada fila cruzó
              </Interruptor>
              <Interruptor
                activo={duplicados === "todas"}
                onCambio={(v) => setDuplicados(v ? "todas" : "primera")}
                ayuda="Apagado: como BUSCARV, se toma la primera coincidencia. Encendido: una fila por cada coincidencia."
              >
                Si la clave se repite en B, traer todas
              </Interruptor>
            </div>
          </div>
        </Paso>
      )}

      {resultado && (
        <Paso
          n={4}
          titulo="Resultado"
          derecha={
            resultado.tabla.filas.length > 0 && (
              <Descargas tabla={resultado.tabla} archivo={`${a!.nombre}_cruzado`} hoja="Cruzado" />
            )
          }
        >
          <div className="space-y-4">
            <Cifras
              items={[
                { etiqueta: "Filas de A que cruzaron", valor: resultado.resumen.cruzadas },
                { etiqueta: "Filas de A sin pareja en B", valor: resultado.resumen.sinCruceA, tono: "aviso" },
                { etiqueta: "Filas de B que nadie usó", valor: resultado.resumen.sinCruceB },
                { etiqueta: "Claves repetidas en B", valor: resultado.resumen.clavesDuplicadasB, tono: "aviso" },
              ]}
            />
            {resultado.resumen.clavesDuplicadasB > 0 && duplicados === "primera" && (
              <Aviso>
                Hay {resultado.resumen.clavesDuplicadasB} claves repetidas en B; se tomó la primera coincidencia de cada
                una.
              </Aviso>
            )}
            {resultado.tabla.filas.length === 0 ? <Aviso>No quedó ninguna fila.</Aviso> : <Vista tabla={resultado.tabla} />}
          </div>
        </Paso>
      )}
    </>
  );
}
