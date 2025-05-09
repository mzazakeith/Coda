import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "AI Code Reviewer",
    template: `%s - AI Code Reviewer`,
  },
  description:
    "Submit code or GitHub PRs for AI-powered review and discussion.",
  keywords: ["AI", "Code Review", "LLM", "Gemini", "GitHub", "Developer Tools"],
  authors: [{ name: "Bolt", url: "https://bolt.dev" }], // Replace with your info
  creator: "Bolt", // Replace with your info
  // Add more metadata as needed, like openGraph, twitter cards, icons etc.
  icons: {
    icon: "/favicon.ico", // Make sure to add a favicon.ico to your public folder
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.variable
        )}
      >
        <Providers attribute="class" defaultTheme="system" enableSystem>
          <div className="relative flex min-h-dvh flex-col bg-background">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
