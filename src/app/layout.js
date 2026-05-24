import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MaintenanceGate from "../components/MaintenanceGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Álbum Yeissy",
  description: "El álbum de cromos de Yeissy",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MaintenanceGate>{children}</MaintenanceGate>
      </body>
    </html>
  );
}
