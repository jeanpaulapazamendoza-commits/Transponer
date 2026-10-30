import type { Metadata } from "next";
import { Titulo } from "@/components/ui";
import { Dividir } from "@/components/herramientas/dividir";

export const metadata: Metadata = { title: "Dividir por columna" };

export default function Pagina() {
  return (
    <>
      <Titulo titulo="Dividir por columna">Parte una tabla en varias según el valor de una columna: una hoja o un archivo por cada tienda, zona o vendedor.</Titulo>
      <Dividir />
    </>
  );
}
