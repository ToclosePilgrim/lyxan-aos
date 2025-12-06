"use client";

import { AuthProvider } from "@/context/auth-context";
import { Toaster } from "sonner";

export function AuthProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster />
    </AuthProvider>
  );
}



