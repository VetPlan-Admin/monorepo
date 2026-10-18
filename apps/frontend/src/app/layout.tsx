import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ApiProvider } from "@vet-plan/app";
import { WebNavigationProvider } from "./navigation-provider";
import { StylesProvider } from "./styles-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vet Plan",
  description: "Veterinary orthopedic surgical planning",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <StylesProvider>
          {/* Shared screens call the API through the same-origin proxy (session cookie stays HTTP-only) */}
          <ApiProvider baseUrl="/api/backend">
            <WebNavigationProvider>{children}</WebNavigationProvider>
          </ApiProvider>
        </StylesProvider>
      </body>
    </html>
  );
}
