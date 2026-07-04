import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "ReplyFlow - WhatsApp AI Reply Manager",
  description:
    "Manage AI-generated WhatsApp replies for your business with intelligent signal detection and style customization.",
};

export const viewport: Viewport = {
  themeColor: "#0f1118",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>
          {children}
          <Toaster
            theme="dark"
            toastOptions={{
              style: {
                background: "oklch(0.17 0.005 260)",
                border: "1px solid oklch(0.26 0.01 260)",
                color: "oklch(0.95 0 0)",
              },
            }}
          />
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
