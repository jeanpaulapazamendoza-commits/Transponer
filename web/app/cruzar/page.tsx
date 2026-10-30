import type { Metadata } from "next";
import { Titulo } from "@/components/ui";
import { Cruzar } from "@/components/herramientas/cruzar";

export const metadata: Metadata = { title: "Cruzar tablas" };

export default function Pagina() {
  return (
    <>
      <Titulo titulo="Cruzar tablas">Trae columnas de una tabla a otra usando una columna clave, como BUSCARV, y ve al instante qué no cruzó.</Titulo>
      <Cruzar />
    </>
  );
}
