import type { Metadata } from "next";
import "./globals.css";
import FloatingPumpLogos from "@/components/FloatingPumpLogos";
import MirrorFamilyNav from "@/components/MirrorFamilyNav";
import WalletProviders from "@/components/WalletProviders";
import ConnectButton from "@/components/ConnectButton";

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
        <WalletProviders>
          <FloatingPumpLogos />
          <MirrorFamilyNav current="marketplace" />
          <div className="w-full flex justify-end px-6 pt-4">
            <ConnectButton />
          </div>
          {children}
        </WalletProviders>
      </body>
    </html>
  );
}
