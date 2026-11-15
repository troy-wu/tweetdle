import type { Metadata, Viewport } from "next";
import { Libre_Franklin, Source_Serif_4 } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import "./globals.css";

const display = Source_Serif_4({ variable: "--font-display", subsets: ["latin"] });
const body = Libre_Franklin({ variable: "--font-body", subsets: ["latin"] });

const TITLE = "Tweetdle: guess who tweeted it";
const DESCRIPTION = "Five tweets. One author. Five guesses. A new one every day.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s | ${SITE_NAME}` },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f1ea",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <AppShell>{children}</AppShell>
        <footer className="mx-auto w-full max-w-[560px] px-4 py-6 text-center text-xs text-muted">
          Not affiliated with X or anyone quoted. Tweets belong to their authors.
        </footer>
      </body>
    </html>
  );
}
