import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Cycling DB Dashboard",
  description: "Overzicht van total entries en laatste entry",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <nav className="site-nav">
          <a href="/" className="nav-link">DB Dashboard</a>
          <a href="/lineup" className="nav-link">Lineup Planner</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
