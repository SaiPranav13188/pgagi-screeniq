import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "ScreenIQ · RAG Interview Intelligence",
  description: "AI-powered, role-based candidate screening grounded in the textbooks that define the role.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${serif.variable} noise min-h-screen antialiased`}>
        <Navbar />
        {children}
        <Footer />
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: { background: "rgba(14,16,24,0.95)", border: "1px solid rgba(255,255,255,0.08)", color: "#e7e9f2", backdropFilter: "blur(16px)" },
          }}
        />
      </body>
    </html>
  );
}
