import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { EcoModeProvider } from "@/lib/eco-mode-context";
import { EcoModeToggle } from "@/components/eco-mode-toggle";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "charisma",
  description: "Investment strategies that outperform the market",
    generator: 'v0.app'
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <EcoModeProvider>
          {children}
          <EcoModeToggle />
        </EcoModeProvider>
      </body>
    </html>
  );
}
