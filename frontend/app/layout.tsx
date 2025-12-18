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
  title: "Charisma Master - AI-анализ выступлений",
  description: "Улучшай свою речь с помощью AI-анализа. Транскрипция речи, выявление слов-паразитов, анализ темпа речи, метрики уверенности и жестикуляции. Персонализированные рекомендации для улучшения выступлений.",
  keywords: ["анализ выступлений", "AI-анализ речи", "транскрипция", "слова-паразиты", "метрики уверенности", "анализ жестикуляции", "улучшение речи"],
  openGraph: {
    title: "Charisma Master - AI-анализ выступлений",
    description: "Улучшай свою речь с помощью AI-анализа. Транскрипция речи, выявление слов-паразитов, анализ темпа речи, метрики уверенности и жестикуляции.",
    type: "website",
    locale: "ru_RU",
  },
  twitter: {
    card: "summary_large_image",
    title: "Charisma Master - AI-анализ выступлений",
    description: "Улучшай свою речь с помощью AI-анализа. Транскрипция речи, выявление слов-паразитов, анализ темпа речи, метрики уверенности и жестикуляции.",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
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
