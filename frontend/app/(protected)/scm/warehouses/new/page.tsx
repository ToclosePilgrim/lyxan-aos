import Link from "next/link";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ScmWarehouseCreatePage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create warehouse</h1>
            <p className="text-muted-foreground mt-2">
              Add a new warehouse to the system
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/scm/warehouses">Back</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coming soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Warehouse create page is not implemented yet.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

