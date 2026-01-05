"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { ScopeSelector } from "@/components/scope-selector";

type User = {
  id: string;
  email: string;
  role?: { name: string } | null;
};

const NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: "/", label: "Home" },
  { href: "/scm", label: "SCM" },
  { href: "/bcm", label: "BCM" },
  { href: "/finance", label: "Finance" },
  { href: "/advertising", label: "Advertising" },
  { href: "/support", label: "Support" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" },
];

export function TopNav({ user }: { user: User }) {
  const pathname = usePathname() || "/";
  const { logout } = useAuth();

  return (
    <div className="flex items-center gap-6">
      <nav className="hidden md:flex items-center gap-1">
        {NAV_ITEMS.map((it) => {
          const active =
            it.href === "/"
              ? pathname === "/"
              : pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                active
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div className="hidden lg:block">
        <ScopeSelector />
      </div>

      <div className="flex items-center gap-3">
        <div className="text-sm text-muted-foreground">
          {user.email}
          {user.role?.name ? (
            <span className="ml-2 text-xs text-muted-foreground/70">
              ({user.role.name})
            </span>
          ) : null}
        </div>
        <Button variant="outline" size="sm" onClick={() => logout()}>
          Logout
        </Button>
      </div>
    </div>
  );
}

