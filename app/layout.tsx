import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { ThemeProvider } from "@/components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Voxs — P2P Chat & File Share",
  description: "Zero-install, anonymous peer-to-peer chat and file sharing over local Wi-Fi. No cloud. No accounts. Just connect.",
  keywords: ["local chat", "p2p", "file sharing", "webrtc", "offline", "mesh network"],
  authors: [{ name: "Voxs" }],
  manifest: "/manifest.json",

  // ----- Open Graph (Facebook, WhatsApp, LinkedIn, iMessage, Slack…) -----
  openGraph: {
    title: "Voxs — Local P2P Chat & File Share",
    description: "Zero-install. No accounts. No cloud. Chat and share files with anyone on your local network instantly.",
    url: "https://voxs.vercel.app",
    siteName: "Voxs",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Voxs — Local P2P Chat & File Share",
      },
    ],
  },

  // ----- Twitter / X Card -----
  twitter: {
    card: "summary_large_image",
    title: "Voxs — Local P2P Chat & File Share",
    description: "Zero-install. No accounts. No cloud. Chat and share files with anyone on your local network instantly.",
    images: ["/og-image.png"],
  },

  // ----- Apple PWA -----
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Voxs",
    startupImage: "/icon-512.png",
  },
  formatDetection: { telephone: false },
};


export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f11" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent Chrome Android from resizing layout when soft keyboard opens */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, interactive-widget=resizes-visual" />
        <link rel="icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          {children}
          <PWAInstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}
