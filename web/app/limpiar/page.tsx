import type { Metadata } from "next";
import { Titulo } from "@/components/ui";
import { Limpiar } from "@/components/herramientas/limpiar";

export const metadata: Metadata = { title: "Limpiar y deduplicar" };

export default function Pagina() {
  return (
    <>
      <Titulo titulo="Limpiar y deduplicar">Las correcciones de siempre en un solo paso: espacios, vacíos, duplicados, mayúsculas y números guardados como texto.</Titulo>
      <Limpiar />
    </>
  );
}
