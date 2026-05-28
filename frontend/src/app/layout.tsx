import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Header from "@/components/layout/header";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Backup Observatory",
  description: "Monitor backup metrics and failures from the latest stored data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body>
        <Header />
        <main style={{ maxWidth: 1600, margin: "0 auto", padding: "28px 24px 44px" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
