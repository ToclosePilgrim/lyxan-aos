"use client";

import { useAuth } from "@/context/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { TopNav } from "@/components/top-nav";
import { ScopeProvider } from "@/context/scope-context";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push(
        "/auth/login?redirect=" + encodeURIComponent(pathname || "/")
      );
    }
  }, [loading, user, router, pathname]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    // пока редирект срабатывает, можно ничего не рендерить
    return null;
  }

  return (
    <ScopeProvider>
      <div className="min-h-screen flex flex-col">
        <header className="border-b bg-background">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="text-lg font-semibold">Ly[x]an AOS</div>
            <TopNav user={user} />
          </div>
        </header>
        <main className="flex-1 bg-muted/40 p-4">{children}</main>
      </div>
    </ScopeProvider>
  );
}














