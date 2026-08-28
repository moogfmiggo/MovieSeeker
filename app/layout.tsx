import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { th } from "@/lib/i18n";

export const metadata: Metadata = {
  title: th.meta.defaultTitle,
  description: th.meta.defaultDescription,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
