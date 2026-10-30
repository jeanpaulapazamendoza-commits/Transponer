"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HERRAMIENTAS } from "@/lib/catalogo";

export function Encabezado() {
  const ruta = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-borde bg-tarjeta/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid size-7 place-items-center rounded-md bg-acento text-sm font-bold text-white">
            X
          </span>
          Herramientas Excel
        </Link>
        <nav className="-mx-1 flex gap-1 overflow-x-auto text-sm">
          {HERRAMIENTAS.map((h) => (
            <Link
              key={h.ruta}
              href={h.ruta}
              className={`whitespace-nowrap rounded-md px-2.5 py-1.5 transition-colors ${
                ruta === h.ruta
                  ? "bg-acento-suave font-medium text-acento"
                  : "text-suave hover:bg-fondo hover:text-texto"
              }`}
            >
              {h.titulo}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
