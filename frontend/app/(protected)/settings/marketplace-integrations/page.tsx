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
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";
import { t } from "@/lib/i18n";

interface MarketplaceIntegration {
  id: string;
  name: string;
  marketplace: {
    id: string;
    code: string;
    name: string;
  };
  brand: {
    id: string;
    name: string;
  };
  country: {
    id: string;
    code: string;
    name: string;
  };
  status: "ACTIVE" | "INACTIVE" | "ERROR";
  lastSyncAt: string | null;
}

export default function MarketplaceIntegrationsPage() {
  const router = useRouter();
  const [integrations, setIntegrations] = useState<MarketplaceIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<MarketplaceIntegration[]>(
        "/settings/marketplace-integrations"
      );
      setIntegrations(data || []);
    } catch (error) {
      console.error("Failed to load integrations:", error);
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-600">ACTIVE</Badge>;
      case "INACTIVE":
        return <Badge variant="secondary">INACTIVE</Badge>;
      case "ERROR":
        return <Badge variant="destructive">ERROR</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t("settings.marketplaceIntegrations.title")}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t("settings.marketplaceIntegrations.subtitle")}
            </p>
          </div>
          <Button onClick={() => router.push("/settings/marketplace-integrations/new")}>
            {t("settings.marketplaceIntegrations.actions.add")}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.marketplaceIntegrations.title")}</CardTitle>
            <CardDescription>
              {t("settings.marketplaceIntegrations.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">{t("common.actions.loading")}</div>
            ) : integrations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("settings.marketplaceIntegrations.table.empty")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("settings.marketplaceIntegrations.table.columns.name")}</TableHead>
                    <TableHead>
                      {t("settings.marketplaceIntegrations.table.columns.marketplace")}
                    </TableHead>
                    <TableHead>{t("settings.marketplaceIntegrations.table.columns.brand")}</TableHead>
                    <TableHead>
                      {t("settings.marketplaceIntegrations.table.columns.country")}
                    </TableHead>
                    <TableHead>{t("settings.marketplaceIntegrations.table.columns.status")}</TableHead>
                    <TableHead>
                      {t("settings.marketplaceIntegrations.table.columns.lastSync")}
                    </TableHead>
                    <TableHead>{t("settings.marketplaceIntegrations.table.columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integrations.map((integration) => (
                    <TableRow key={integration.id}>
                      <TableCell className="font-medium">{integration.name}</TableCell>
                      <TableCell>{integration.marketplace.name}</TableCell>
                      <TableCell>{integration.brand.name}</TableCell>
                      <TableCell>{integration.country.name}</TableCell>
                      <TableCell>{getStatusBadge(integration.status)}</TableCell>
                      <TableCell>{formatDate(integration.lastSyncAt)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/settings/marketplace-integrations/${integration.id}`)
                          }
                        >
                          {t("settings.marketplaceIntegrations.actions.configure")}
                        </Button>
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





