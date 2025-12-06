import type { Metadata } from "next";
import "./globals.css";
import { AuthProviderWrapper } from "@/components/auth-provider-wrapper";

export const metadata: Metadata = {
  title: "Ly[x]an AOS",
  description: "Agentic Operating System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProviderWrapper>
          {children}
        </AuthProviderWrapper>
      </body>
    </html>
  );
}
