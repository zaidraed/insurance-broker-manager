import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Broker Seguros",
  description: "Panel interno de gestión de pólizas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
