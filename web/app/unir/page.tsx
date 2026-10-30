import type { Metadata } from "next";
import { Titulo } from "@/components/ui";
import { Unir } from "@/components/herramientas/unir";

export const metadata: Metadata = { title: "Unir archivos" };

export default function Pagina() {
  return (
    <>
      <Titulo titulo="Unir archivos">Junta varios archivos u hojas en una sola tabla. Las columnas se alinean por nombre aunque vengan en otro orden.</Titulo>
      <Unir />
    </>
  );
}
