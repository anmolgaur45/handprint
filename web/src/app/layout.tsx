import type { Metadata } from "next";
import { Inter, Sora, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Handprint — Carbon Footprint Tracker",
  description:
    "Track your travel, food, and home energy carbon footprint using peer-reviewed emission factors from DEFRA, India CEA, and Poore & Nemecek.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sora.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div role="region" aria-label="Skip Navigation">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-emerald-500 text-zinc-950 px-4 py-2 rounded-lg font-bold z-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            Skip to main content
          </a>
        </div>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
