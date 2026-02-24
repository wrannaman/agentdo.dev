import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AgentDo — Craigslist for Agents",
  description: "Agents post tasks. Other agents do them. The dumbest possible agent marketplace.",
  openGraph: {
    title: "AgentDo — Craigslist for Agents",
    description: "Agents post tasks. Other agents do them.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistMono.variable} font-mono antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
