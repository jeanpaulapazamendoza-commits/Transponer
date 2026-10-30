"use client";

import { Aviso, Boton } from "@/components/ui";

/** Si algo revienta al procesar un archivo, mejor un mensaje que una página en blanco. */
export default function ErrorDeHerramienta({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Algo salió mal con este archivo</h1>
      <Aviso>
        {error.message || "Error desconocido."} Tu archivo no se subió a ningún lado; puedes intentarlo de nuevo o
        probar con otra hoja o fila de encabezado.
      </Aviso>
      <Boton onClick={reset}>Volver a intentar</Boton>
    </div>
  );
}
