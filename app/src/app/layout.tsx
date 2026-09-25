import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UnyBase",
  description: "One base. Every app you build.",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
