import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KitDesign — Creá la camiseta de tu club",
  description:
    "Diseñá tu equipación, visualizala en 3D y compartila con tu fabricante.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`}>
      <body className="h-full font-[family-name:var(--font-geist)]">
        {children}
      </body>
    </html>
  );
}
