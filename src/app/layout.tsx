import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Hermes × Symphony Token Card", description: "GitHub-embeddable token usage cards for Hermes Agent and Symphony" };

export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="ja"><body>{children}</body></html>; }
