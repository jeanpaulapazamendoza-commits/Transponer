import type { Metadata } from "next";
import { Titulo } from "@/components/ui";
import { Transponer } from "@/components/herramientas/transponer";

export const metadata: Metadata = { title: "Transponer" };

export default function Pagina() {
  return (
    <>
      <Titulo titulo="Transponer">Convierte una tabla ancha (una columna por día, mes o producto) en una tabla larga, lista para tablas dinámicas y gráficos.</Titulo>
      <Transponer />
    </>
  );
}
