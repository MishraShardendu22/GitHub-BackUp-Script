import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Inter } from "next/font/google";
import { AppLayout } from "@/components/layout/AppLayout";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const instrumentSerif = Instrument_Serif({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://github.mishrashardendu22.is-a.dev"),
  title: {
    default: "Systems Lab | GitHub Backup Monitor",
    template: "%s | Systems Lab",
  },
  description:
    "Monitor your GitHub repository backup metrics, run execution health, repository archive sizes, and live backup workers in real-time.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Systems Lab | GitHub Backup Monitor",
    description: "Monitor your GitHub repository backup metrics, run execution health, repository archive sizes, and live backup workers in real-time.",
    url: "https://github.mishrashardendu22.is-a.dev",
    siteName: "Systems Lab",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Systems Lab | GitHub Backup Monitor",
    description: "Monitor your GitHub repository backup metrics, run execution health, repository archive sizes, and live backup workers in real-time.",
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
    <html lang="en" className={`${instrumentSerif.variable} ${inter.variable} ${ibmPlexMono.variable}`}>
      <Analytics />
      <body className="app-shell">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <AppLayout>
          <main id="main-content" className="app-main">
            {children}
          </main>
        </AppLayout>
      </body>
    </html>
  );
}
