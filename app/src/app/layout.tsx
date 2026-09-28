import type { Metadata } from "next";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/components/ThemeToggle";

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
    // suppressHydrationWarning because the init script below sets
    // data-theme before React hydrates, so the server-rendered
    // <html> intentionally differs from what the browser has by then.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before first paint so the correct theme is already
            applied — no flash of the wrong palette on load. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
