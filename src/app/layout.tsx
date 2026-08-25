import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),

  title: {
    default:
      "Typecord — Conecte-se com sua comunidade",
    template: "%s | Typecord",
  },

  description:
    "Typecord é uma plataforma moderna de chat por texto e voz, servidores e comunidades inspirada no Discord e desenvolvida com TypeScript e Next.js.",

  keywords: [
    "typecord",
    "discord clone",
    "chat",
    "voip",
    "comunidades",
    "typescript",
    "nextjs",
    "livekit",
  ],

  authors: [
    {
      name: "ptrixia",
      url: "https://github.com/ptrixia",
    },
  ],

  creator: "ptrixia",
  publisher: "Typecord",

  robots: {
    index: true,
    follow: true,
  },

  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: APP_URL,

    title:
      "Typecord — Conecte-se com sua comunidade",

    description:
      "Plataforma de conversas em tempo real, servidores customizados e canais de voz.",

    siteName: "Typecord",

    images: [
      {
        url: "https://app.tysaiw.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Typecord Preview",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",

    title:
      "Typecord — Conecte-se com sua comunidade",

    description:
      "Plataforma de conversas em tempo real, servidores customizados e canais de voz.",

    images: [
      "https://app.tysaiw.com/og-image.png",
    ],
  },

  icons: {
    icon:
      "https://app.tysaiw.com/favicon.ico",

    shortcut:
      "https://app.tysaiw.com/favicon-16x16.png",

    apple:
      "https://app.tysaiw.com/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}