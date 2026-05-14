import type { Metadata } from "next";
import "./globals.css";
import FloatingPumpLogos from "@/components/FloatingPumpLogos";
import MirrorFamilyNav from "@/components/MirrorFamilyNav";

export const metadata: Metadata = {
  title: "Mirror Marketplace — subscribe to top traders",
  description:
    "Subscribe to top Solana traders' AI-generated trade theses. Performance-verified, on-chain transparent.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <FloatingPumpLogos />
        <MirrorFamilyNav current="marketplace" />
        {children}
      </body>
    </html>
  );
}
