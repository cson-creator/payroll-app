import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Payroll App",
  description: "Payroll management application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>

      <body className="min-h-full flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}