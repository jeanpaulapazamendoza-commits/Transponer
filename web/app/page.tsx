import Link from "next/link";
import { HERRAMIENTAS } from "@/lib/catalogo";

export default function Inicio() {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Lo engorroso de Excel, en un clic</h1>
        <p className="max-w-2xl text-suave">
          Sube tu Excel o CSV, elige una herramienta y descarga el resultado. Todo pasa en tu
          navegador: tus datos no salen de tu computadora.
        </p>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {HERRAMIENTAS.map((h) => (
          <Link
            key={h.ruta}
            href={h.ruta}
            className="group rounded-xl border border-borde bg-tarjeta p-5 transition hover:border-acento hover:shadow-sm"
          >
            <svg
              viewBox="0 0 24 24"
              className="mb-3 size-9 rounded-lg bg-acento-suave p-1.5 text-acento"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d={h.icono} />
            </svg>
            <h2 className="font-semibold group-hover:text-acento">{h.titulo}</h2>
            <p className="mt-1 text-sm text-suave">{h.resumen}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
