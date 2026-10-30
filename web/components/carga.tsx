"use client";

import { useEffect, useEffectEvent, useId, useState } from "react";
import { EXTENSIONES, leerArchivo, leerHoja, sinExtension, type LibroCargado } from "@/lib/archivo";
import type { Tabla } from "@/lib/tabla";

/** Zona para soltar o elegir archivos. */
export function ZonaArchivos({
  multiple,
  onArchivos,
  texto,
  compacta,
}: {
  multiple?: boolean;
  onArchivos: (f: File[]) => void;
  texto?: string;
  compacta?: boolean;
}) {
  const [encima, setEncima] = useState(false);
  const id = useId();
  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        const f = [...e.dataTransfer.files];
        if (f.length) onArchivos(multiple ? f : f.slice(0, 1));
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-center transition ${
        compacta ? "px-4 py-4" : "px-6 py-10"
      } ${encima ? "border-acento bg-acento-suave" : "border-borde hover:border-acento"}`}
    >
      <svg viewBox="0 0 24 24" className="size-7 text-acento" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-sm font-medium">
        {texto ?? (multiple ? "Suelta aquí tus archivos o haz clic para elegirlos" : "Suelta aquí tu archivo o haz clic para elegirlo")}
      </span>
      <span className="text-xs text-suave">Excel (.xlsx, .xls, .xlsb, .ods) o CSV</span>
      <input
        id={id}
        type="file"
        accept={EXTENSIONES}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          const f = [...(e.target.files ?? [])];
          if (f.length) onArchivos(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

export interface TablaCargada {
  tabla: Tabla;
  /** Nombre del archivo sin extensión, para nombrar las descargas. */
  nombre: string;
}

/**
 * Carga un archivo y deja elegir hoja y fila de encabezado. Avisa al padre
 * cada vez que la tabla cambia.
 */
export function CargaTabla({
  onCambio,
  texto,
}: {
  onCambio: (t: TablaCargada | null) => void;
  texto?: string;
}) {
  const [libro, setLibro] = useState<LibroCargado | null>(null);
  const [hoja, setHoja] = useState("");
  const [filaEnc, setFilaEnc] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const avisar = useEffectEvent(onCambio);

  useEffect(() => {
    if (!libro || !hoja) {
      avisar(null);
      return;
    }
    avisar({ tabla: leerHoja(libro, hoja, filaEnc), nombre: sinExtension(libro.nombre) });
  }, [libro, hoja, filaEnc]);

  async function abrir(archivos: File[]) {
    setError(null);
    setCargando(true);
    try {
      const l = await leerArchivo(archivos[0]);
      if (!l.hojas.length) throw new Error("El archivo no tiene hojas.");
      setLibro(l);
      setHoja(l.hojas[0]);
      setFilaEnc(1);
    } catch (e) {
      setError(`No se pudo leer el archivo: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCargando(false);
    }
  }

  if (!libro) {
    return (
      <div className="space-y-2">
        <ZonaArchivos onArchivos={abrir} texto={texto} />
        {cargando && <p className="text-sm text-suave">Leyendo…</p>}
        {error && <p className="text-sm text-aviso">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3 text-sm">
      <div className="min-w-0 flex-1">
        <span className="mb-1 block text-suave">Archivo</span>
        <div className="flex items-center gap-2">
          <span className="truncate font-medium" title={libro.nombre}>
            {libro.nombre}
          </span>
          <button
            type="button"
            className="shrink-0 text-xs text-acento hover:underline"
            onClick={() => {
              setLibro(null);
              setHoja("");
            }}
          >
            Cambiar
          </button>
        </div>
      </div>
      {libro.hojas.length > 1 && (
        <label className="block">
          <span className="mb-1 block text-suave">Hoja</span>
          <select
            value={hoja}
            onChange={(e) => setHoja(e.target.value)}
            className="rounded-lg border border-borde bg-fondo px-3 py-2 outline-none focus:border-acento"
          >
            {libro.hojas.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-suave" title="Si el Excel tiene títulos arriba, indica en qué fila están los encabezados">
          Encabezados en la fila
        </span>
        <input
          type="number"
          min={1}
          value={filaEnc}
          onChange={(e) => setFilaEnc(Math.max(1, Number(e.target.value) || 1))}
          className="w-24 rounded-lg border border-borde bg-fondo px-3 py-2 outline-none focus:border-acento"
        />
      </label>
    </div>
  );
}
