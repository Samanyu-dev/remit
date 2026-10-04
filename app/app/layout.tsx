import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const font = Plus_Jakarta_Sans({ variable: "--font-app", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Remit",
  description: "Send dollars anywhere, as a link.",
  appleWebApp: { capable: true, title: "Remit", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#050814",
  viewportFit: "cover", // draw under the notch; safe-area padding is in globals.css
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${font.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
