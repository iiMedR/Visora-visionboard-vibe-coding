import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Manrope,
  Space_Grotesk,
  Bricolage_Grotesque,
  Instrument_Serif,
} from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Visora",
  description:
    "Visora is an interactive annual vision board app where you can drag and arrange goals, wins, focus notes, text, emojis, and images in one private creative workspace.",
  metadataBase: new URL("https://makesomething.so"),
  openGraph: {
    title: "Visora",
    description:
      "Build your yearly vision board with goals, wins, focus notes, images, text, and emoji stamps in a freeform canvas.",
    siteName: "Visora",
  },
  twitter: {
    card: "summary_large_image",
    title: "Visora",
    description:
      "Create and organize your annual vision board with draggable goals, wins, focus notes, images, text, and emoji stamps.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} ${spaceGrotesk.variable} ${bricolageGrotesque.variable} ${instrumentSerif.variable} min-h-screen text-foreground bg-background font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
