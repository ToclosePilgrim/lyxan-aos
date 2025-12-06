"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest } from "@/lib/api";
import { t } from "@/lib/i18n";

interface Country {
  id: string;
  name: string;
  code: string;
}

interface Brand {
  id: string;
  name: string;
  code: string;
  countries: Country[];
  created_at: string;
}

export default function BrandsPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<Brand[]>("/bcm/brands");
      setBrands(data || []);
    } catch (error) {
      console.error("Failed to load brands:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (brandId: string) => {
    router.push(`/bcm/brands/${brandId}`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("bcm.brand.list.title")}</h1>
            <p className="text-muted-foreground mt-2">
              {t("bcm.brand.list.subtitle")}
            </p>
          </div>
          <Button onClick={() => router.push("/bcm/brands/create")}>
            {t("bcm.brand.list.actions.addBrand")}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("bcm.brand.list.title")}</CardTitle>
            <CardDescription>
              {t("bcm.brand.list.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">{t("common.actions.loading")}</div>
            ) : brands.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("bcm.brand.list.table.empty")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("bcm.brand.list.table.columns.name")}</TableHead>
                    <TableHead>{t("bcm.brand.list.table.columns.code")}</TableHead>
                    <TableHead>{t("bcm.brand.list.table.columns.countries")}</TableHead>
                    <TableHead>{t("bcm.brand.list.table.columns.createdAt")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brands.map((brand) => (
                    <TableRow
                      key={brand.id}
                      className="cursor-pointer"
                      onClick={() => handleRowClick(brand.id)}
                    >
                      <TableCell className="font-medium">
                        {brand.name}
                      </TableCell>
                      <TableCell>{brand.code}</TableCell>
                      <TableCell>
                        {brand.countries.length > 0
                          ? brand.countries.map((c) => c.name).join(", ")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {new Date(brand.created_at).toLocaleDateString("ru-RU")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

