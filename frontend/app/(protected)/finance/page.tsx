import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const sections = [
  {
    name: "Documents",
    href: "/finance/documents",
    description: "Manage financial documents (invoices, bills, acts)",
  },
  {
    name: "Sales",
    href: "/finance/sales",
    description: "Sales financial reports",
  },
  {
    name: "P&L",
    href: "/finance/pnl",
    description: "Profit & Loss report",
  },
];

export default function FinancePage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance Module</h1>
          <p className="text-muted-foreground mt-2">
            Finance - manage financial reports
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => (
            <Link key={section.href} href={section.href}>
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle>{section.name}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}

