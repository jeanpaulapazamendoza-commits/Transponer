import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Encabezado } from "@/components/encabezado";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Herramientas Excel", template: "%s · Herramientas Excel" },
  description:
    "Transponer, unir, cruzar, limpiar y dividir archivos de Excel y CSV en el navegador, sin subirlos a ningún servidor.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Encabezado />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-borde py-5 text-center text-xs text-suave">
          Tus archivos se procesan en tu navegador. No se suben ni se guardan en ningún servidor.
        </footer>
      </body>
    </html>
  );
}
