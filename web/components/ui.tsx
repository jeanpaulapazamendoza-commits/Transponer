"use client";

import { useState, type ReactNode } from "react";
import { aTexto, type Tabla } from "@/lib/tabla";
import { descargarCsv, descargarExcel } from "@/lib/archivo";

export function Titulo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mb-6 space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
      <p className="max-w-3xl text-suave">{children}</p>
    </div>
  );
}

export function Paso({
  n,
  titulo,
  children,
  derecha,
}: {
  n: number;
  titulo: string;
  children: ReactNode;
  derecha?: ReactNode;
}) {
  return (
    <section className="mb-5 rounded-xl border border-borde bg-tarjeta p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-acento text-xs font-semibold text-white">
          {n}
        </span>
        <h2 className="font-semibold">{titulo}</h2>
        {derecha && <div className="ml-auto">{derecha}</div>}
      </div>
      {children}
    </section>
  );
}

export function Interruptor({
  activo,
  onCambio,
  children,
  ayuda,
}: {
  activo: boolean;
  onCambio: (v: boolean) => void;
  children: ReactNode;
  ayuda?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 size-4"
        checked={activo}
        onChange={(e) => onCambio(e.target.checked)}
      />
      <span>
        {children}
        {ayuda && <span className="block text-xs text-suave">{ayuda}</span>}
      </span>
    </label>
  );
}

export function Segmentado<T extends string>({
  valor,
  onCambio,
  opciones,
}: {
  valor: T;
  onCambio: (v: T) => void;
  opciones: { valor: T; etiqueta: string; ayuda?: string }[];
}) {
  const actual = opciones.find((o) => o.valor === valor);
  return (
    <div className="space-y-1.5">
      <div className="inline-flex flex-wrap rounded-lg border border-borde bg-fondo p-0.5 text-sm">
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            onClick={() => onCambio(o.valor)}
            className={`rounded-md px-3 py-1.5 transition ${
              o.valor === valor ? "bg-tarjeta font-medium shadow-sm" : "text-suave hover:text-texto"
            }`}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>
      {actual?.ayuda && <p className="text-xs text-suave">{actual.ayuda}</p>}
    </div>
  );
}

export function CampoTexto({
  etiqueta,
  valor,
  onCambio,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-suave">{etiqueta}</span>
      <input
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="w-full rounded-lg border border-borde bg-fondo px-3 py-2 outline-none focus:border-acento"
      />
    </label>
  );
}

export function Selector({
  etiqueta,
  valor,
  onCambio,
  opciones,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  opciones: string[];
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-suave">{etiqueta}</span>
      <select
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="w-full rounded-lg border border-borde bg-fondo px-3 py-2 outline-none focus:border-acento"
      >
        {opciones.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Lista de columnas como fichas que se prenden y apagan. */
export function SelectorColumnas({
  etiqueta,
  columnas,
  elegidas,
  onCambio,
  ayuda,
}: {
  etiqueta: string;
  columnas: string[];
  elegidas: string[];
  onCambio: (v: string[]) => void;
  ayuda?: string;
}) {
  const set = new Set(elegidas);
  const alternar = (c: string) =>
    onCambio(columnas.filter((x) => (x === c ? !set.has(c) : set.has(x))));
  return (
    <div className="text-sm">
      <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3">
        <span className="text-suave">{etiqueta}</span>
        <span className="text-xs text-suave">
          {elegidas.length} de {columnas.length}
        </span>
        <button type="button" className="text-xs text-acento hover:underline" onClick={() => onCambio([...columnas])}>
          Todas
        </button>
        <button type="button" className="text-xs text-acento hover:underline" onClick={() => onCambio([])}>
          Ninguna
        </button>
      </div>
      {ayuda && <p className="mb-1.5 text-xs text-suave">{ayuda}</p>}
      <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
        {columnas.length === 0 && <span className="text-xs text-suave">No hay columnas disponibles.</span>}
        {columnas.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => alternar(c)}
            className={`max-w-full truncate rounded-md border px-2 py-1 text-xs transition ${
              set.has(c)
                ? "border-acento bg-acento-suave text-acento"
                : "border-borde text-suave hover:border-suave"
            }`}
            title={c}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

function celdaVisible(v: Tabla["filas"][number][string] | undefined) {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    const conHora = v.getHours() || v.getMinutes() || v.getSeconds();
    const fecha = v.toLocaleDateString("es-PE");
    return conHora ? `${fecha} ${v.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}` : fecha;
  }
  // Sin separador de miles: un DNI o un año no deben verse como "7,654,321"
  if (typeof v === "number") return v.toLocaleString("es-PE", { maximumFractionDigits: 6, useGrouping: false });
  return aTexto(v ?? null);
}

/** Vista previa con las primeras filas. */
export function Vista({ tabla, filas = 50 }: { tabla: Tabla; filas?: number }) {
  const [max, setMax] = useState(filas);
  const visibles = tabla.filas.slice(0, max);
  return (
    <div className="space-y-2">
      <div className="overflow-auto rounded-lg border border-borde" style={{ maxHeight: 420 }}>
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-fondo">
            <tr>
              <th className="border-b border-borde px-2 py-1.5 text-right font-normal text-suave">#</th>
              {tabla.columnas.map((c) => (
                <th key={c} className="whitespace-nowrap border-b border-borde px-2 py-1.5 text-left font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map((f, i) => (
              <tr key={i} className="odd:bg-tarjeta even:bg-fondo/50">
                <td className="px-2 py-1 text-right text-suave">{i + 1}</td>
                {tabla.columnas.map((c) => {
                  const v = f[c];
                  return (
                    <td
                      key={c}
                      className={`max-w-64 truncate whitespace-nowrap px-2 py-1 ${typeof v === "number" ? "text-right tabular-nums" : ""}`}
                    >
                      {celdaVisible(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-suave">
        <span>
          {tabla.filas.length.toLocaleString("es-PE")} filas × {tabla.columnas.length} columnas
          {tabla.filas.length > max && ` · mostrando ${max.toLocaleString("es-PE")}`}
        </span>
        {tabla.filas.length > max && (
          <button type="button" className="text-acento hover:underline" onClick={() => setMax(max + 200)}>
            Ver más
          </button>
        )}
      </div>
    </div>
  );
}

export function Boton({
  children,
  onClick,
  secundario,
  deshabilitado,
}: {
  children: ReactNode;
  onClick: () => void;
  secundario?: boolean;
  deshabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        secundario
          ? "border border-borde bg-tarjeta hover:border-acento hover:text-acento"
          : "bg-acento text-white hover:brightness-110"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Corre una descarga dejando pintar antes el «Generando…» (armar un Excel
 * grande bloquea la página unos segundos) y convierte cualquier fallo en un
 * mensaje visible en vez de un botón que no hace nada.
 */
export function useDescarga() {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function correr(fn: () => void | Promise<void>) {
    setError(null);
    setGenerando(true);
    try {
      await new Promise((r) => setTimeout(r, 30));
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerando(false);
    }
  }
  return { generando, error, correr };
}

export function Descargas({
  tabla,
  archivo,
  hoja = "Resultado",
  extra,
}: {
  tabla: Tabla;
  archivo: string;
  hoja?: string;
  extra?: { nombre: string; tabla: Tabla }[];
}) {
  const { generando, error, correr } = useDescarga();
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        <Boton
          deshabilitado={generando}
          onClick={() => correr(() => descargarExcel([{ nombre: hoja, tabla }, ...(extra ?? [])], archivo))}
        >
          {generando ? "Generando…" : "Descargar Excel"}
        </Boton>
        <Boton secundario deshabilitado={generando} onClick={() => correr(() => descargarCsv(tabla, archivo))}>
          Descargar CSV
        </Boton>
      </div>
      {error && <p className="max-w-sm text-xs text-aviso">{error}</p>}
    </div>
  );
}

export function Aviso({ children, tono = "aviso" }: { children: ReactNode; tono?: "aviso" | "ok" }) {
  return (
    <div
      className={`rounded-lg px-3 py-2 text-sm ${
        tono === "ok" ? "bg-acento-suave text-acento" : "bg-aviso-suave text-aviso"
      }`}
    >
      {children}
    </div>
  );
}

export function Cifras({ items }: { items: { etiqueta: string; valor: number | string; tono?: "aviso" }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.etiqueta} className="rounded-lg border border-borde bg-fondo px-3 py-2">
          <div className={`text-xl font-semibold tabular-nums ${i.tono === "aviso" && i.valor ? "text-aviso" : ""}`}>
            {typeof i.valor === "number" ? i.valor.toLocaleString("es-PE") : i.valor}
          </div>
          <div className="text-xs text-suave">{i.etiqueta}</div>
        </div>
      ))}
    </div>
  );
}
