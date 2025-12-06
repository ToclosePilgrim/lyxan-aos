import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ContentWrapper } from "@/components/content-wrapper";

const sections = [
  {
    name: "Products",
    href: "/scm/products",
    description: "Manage internal products and SKU",
  },
  {
    name: "Suppliers",
    href: "/scm/suppliers",
    description: "Manage suppliers for SCM products",
  },
  {
    name: "Production",
    href: "/scm/production-orders",
    description: "Manage production orders",
  },
  {
    name: "Stocks",
    href: "/scm/stocks",
    description: "Manage warehouse stock levels",
  },
  {
    name: "Supplies",
    href: "/scm/supplies",
    description: "Manage product supplies",
  },
  {
    name: "Warehouses",
    href: "/scm/warehouses",
    description: "Manage warehouses and locations",
  },
];

export default function ScmPage() {
  return (
    <ContentWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SCM Module</h1>
          <p className="text-muted-foreground mt-2">
            Supply Chain Management - manage supply chain operations
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
    </ContentWrapper>
  );
}

