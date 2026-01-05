import Link from "next/link";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function FinanceDocumentCreatePage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Create financial document
            </h1>
            <p className="text-muted-foreground mt-2">
              Manual document creation
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/finance/documents">Back</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coming soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Financial document create page is not implemented yet.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

