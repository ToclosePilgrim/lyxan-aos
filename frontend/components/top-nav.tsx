"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n";

const navItems = [
  { labelKey: "layout.nav.scm", href: "/scm" },
  { labelKey: "layout.nav.bcm", href: "/bcm" },
  { labelKey: "layout.nav.finance", href: "/finance" },
  { labelKey: "layout.nav.advertising", href: "/advertising" },
  { labelKey: "layout.nav.support", href: "/support" },
  { labelKey: "layout.nav.analytics", href: "/analytics" },
  { labelKey: "layout.nav.settings", href: "/settings" },
];

type User = {
  id: string;
  email: string;
  role?: { name: string } | null;
};

export function TopNav({ user }: { user: User }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="flex items-center gap-6">
      <nav className="flex items-center gap-6">
        {navItems.map((item) => {
          const isActive =
            item.href === "/scm"
              ? pathname?.startsWith("/scm")
              : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                isActive
                  ? "text-primary border-b-2 border-primary pb-1"
                  : "text-muted-foreground"
              )}
            >
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2">
            <span className="text-sm">{user.email}</span>
            {user.role && (
              <Badge variant="secondary" className="text-xs">
                {user.role.name}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span>{user.email}</span>
              {user.role && (
                <span className="text-xs text-muted-foreground">
                  {user.role.name}
                </span>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            {t("auth.logout.title")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
