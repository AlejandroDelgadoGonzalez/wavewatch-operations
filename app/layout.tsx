import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const hostname = new URL(`http://${host}`).hostname;
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);

  return {
    metadataBase: baseUrl,
    title: "WaveWatch Operations V2 | Blue Current",
    icons: { icon: "/favicon.svg" },
    description: "An event-driven fictional water park simulation and Operations Base dashboard.",
    openGraph: {
      title: "Blue Current Operations Dashboard",
      description: "Monitor 17 rotations across four fictional water park zones.",
      type: "website",
      images: [{
        url: new URL("/blue-current-og.png", baseUrl).toString(),
        width: 1200,
        height: 630,
        alt: "Blue Current Operations Dashboard",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Blue Current Operations Dashboard",
      description: "Monitor 17 rotations across four fictional water park zones.",
      images: [new URL("/blue-current-og.png", baseUrl).toString()],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
