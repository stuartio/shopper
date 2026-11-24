import type { ReactNode } from "react";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata = { title: "Shopper", description: "A test web shop" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header />
          <main>{children}</main>
          <footer className="footer">Shopper is a test application. No real payments are taken.</footer>
        </Providers>
      </body>
    </html>
  );
}
