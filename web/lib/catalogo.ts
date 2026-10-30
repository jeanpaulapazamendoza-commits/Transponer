/** Las herramientas que muestra el inicio y el menú. */
export const HERRAMIENTAS = [
  {
    ruta: "/transponer",
    titulo: "Transponer",
    resumen: "De formato ancho a largo: apila columnas como Lunes, Martes… o P.1/Lt.1, P.2/Lt.2 sin perder la relación.",
    icono: "M4 6h16M4 12h10M4 18h6M17 14l3 3-3 3M20 17h-6",
  },
  {
    ruta: "/unir",
    titulo: "Unir archivos",
    resumen: "Junta varios Excel o CSV (o todas las hojas de uno) en una sola tabla, aunque las columnas vengan en otro orden.",
    icono: "M4 5h7v6H4zM13 5h7v6h-7zM8 11v3h8v-3M12 14v5M9 19h6",
  },
  {
    ruta: "/cruzar",
    titulo: "Cruzar tablas",
    resumen: "El BUSCARV masivo: une dos tablas por una columna clave y te dice exactamente qué no cruzó.",
    icono: "M8 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM16 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z",
  },
  {
    ruta: "/limpiar",
    titulo: "Limpiar y deduplicar",
    resumen: "Quita espacios, filas y columnas vacías, duplicados; arregla mayúsculas y números guardados como texto.",
    icono: "M4 20l6-6M14 4l6 6-8 8-6-6zM9 9l6 6",
  },
  {
    ruta: "/dividir",
    titulo: "Dividir por columna",
    resumen: "Parte un Excel en varias hojas o archivos según una columna: uno por tienda, zona o vendedor.",
    icono: "M12 4v16M4 8h5M4 12h5M4 16h5M15 8h5M15 12h5M15 16h5",
  },
] as const;
