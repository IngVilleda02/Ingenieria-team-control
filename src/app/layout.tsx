import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Ingeniería Team Control", template: "%s · Team Control" },
  description: "Centro de control de proyectos, actividades y equipo de Ingeniería.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#102542" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body className="min-h-screen font-sans text-[14px]">{children}</body>
    </html>
  );
}
