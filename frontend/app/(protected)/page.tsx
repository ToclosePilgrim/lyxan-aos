import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const modules = [
  {
    name: "SCM",
    description: "Supply Chain Management - manage supply chain and inventory",
    href: "/scm",
  },
  {
    name: "BCM",
    description: "Brand & Catalog Management - manage brands and marketplace listings",
    href: "/bcm",
  },
  {
    name: "Finance",
    description: "Finance - manage financial reports and transactions",
    href: "/finance",
  },
  {
    name: "Advertising",
    description: "Advertising - manage advertising campaigns",
    href: "/advertising",
  },
  {
    name: "Support",
    description: "Support - manage customer support requests",
    href: "/support",
  },
  {
    name: "Analytics",
    description: "Analytics - data analysis and reports",
    href: "/analytics",
  },
  {
    name: "Settings",
    description: "Settings - system configuration",
    href: "/settings",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ly[x]an AOS</h1>
        <p className="text-muted-foreground mt-2">
          Agentic Operating System - business management system
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => (
          <Link key={module.href} href={module.href}>
            <Card className="hover:shadow-md transition-shadow h-full">
              <CardHeader>
                <CardTitle>{module.name}</CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}



