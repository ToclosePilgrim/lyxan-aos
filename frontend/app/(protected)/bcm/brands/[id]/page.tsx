import Link from "next/link";
import { MainLayout } from "@/components/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BcmBrandDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Brand</h1>
            <p className="text-muted-foreground mt-2">ID: {params.id}</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/bcm/brands">Back</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coming soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Brand details page is not implemented yet.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

