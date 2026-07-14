import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import { AppLayout } from "@/components/layout/AppLayout";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { cn } from "@/lib/utils";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://github.mishrashardendu22.is-a.dev"),
  title: {
    default: "Backup Observatory | GitHub Backup Monitor",
    template: "%s | Backup Observatory",
  },
  description:
    "Monitor your GitHub repository backup metrics, run execution health, repository archive sizes, and live backup workers in real-time.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Backup Observatory | GitHub Backup Monitor",
    description:
      "Monitor your GitHub repository backup metrics, run execution health, repository archive sizes, and live backup workers in real-time.",
    url: "https://github.mishrashardendu22.is-a.dev",
    siteName: "Backup Observatory",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Backup Observatory | GitHub Backup Monitor",
    description:
      "Monitor your GitHub repository backup metrics, run execution health, repository archive sizes, and live backup workers in real-time.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("dark", inter.variable, instrumentSerif.variable)}
    >
      <Analytics />
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <AppLayout>
          <div
            id="main-content"
            className="w-full max-w-[1600px] mx-auto p-6 md:p-8"
          >
            {children}
          </div>
        </AppLayout>
      </body>
    </html>
  );
}
