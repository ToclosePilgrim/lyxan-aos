"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api";
import { t } from "@/lib/i18n";

interface Country {
  id: string;
  name: string;
  code: string;
}

interface Marketplace {
  id: string;
  name: string;
  code: string;
  markets?: Array<{
    country: Country;
  }>;
}

export default function MarketplaceAvailabilityPage() {
  const searchParams = useSearchParams();
  const selectedMarketplaceId = searchParams.get("marketplace");

  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingMarketplace, setEditingMarketplace] = useState<Marketplace | null>(null);
  const [selectedCountryIds, setSelectedCountryIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedMarketplaceId && marketplaces.length > 0) {
      const marketplace = marketplaces.find((m) => m.id === selectedMarketplaceId);
      if (marketplace) {
        handleOpenEdit(marketplace);
      }
    }
  }, [selectedMarketplaceId, marketplaces]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [marketplacesData, countriesData] = await Promise.all([
        apiRequest<Marketplace[]>("/org/marketplaces"),
        apiRequest<Country[]>("/org/countries"),
      ]);
      setMarketplaces(marketplacesData || []);
      setCountries(countriesData || []);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (marketplace: Marketplace) => {
    setEditingMarketplace(marketplace);
    const currentCountryIds =
      marketplace.markets?.map((m) => m.country.id) || [];
    setSelectedCountryIds(currentCountryIds);
    setOpenDialog(true);
  };

  const handleCountryToggle = (countryId: string) => {
    setSelectedCountryIds((prev) =>
      prev.includes(countryId)
        ? prev.filter((id) => id !== countryId)
        : [...prev, countryId]
    );
  };

  const handleSave = async () => {
    if (!editingMarketplace) return;

    try {
      setSaving(true);
      await apiRequest(`/org/marketplaces/${editingMarketplace.id}/countries`, {
        method: "PUT",
        body: JSON.stringify({ countryIds: selectedCountryIds }),
      });
      alert(t("settings.marketplaceAvailability.messages.updated"));
      setOpenDialog(false);
      await loadData();
    } catch (error: any) {
      console.error("Failed to save marketplace countries:", error);
      alert(error.message || t("settings.marketplaceAvailability.messages.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("settings.marketplaceAvailability.title")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t("settings.marketplaceAvailability.subtitle")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.marketplaceAvailability.title")}</CardTitle>
            <CardDescription>
              {t("settings.marketplaceAvailability.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">{t("common.actions.loading")}</div>
            ) : marketplaces.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("settings.marketplaceAvailability.table.empty")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {t("settings.marketplaceAvailability.table.columns.marketplace")}
                    </TableHead>
                    <TableHead>
                      {t("settings.marketplaceAvailability.table.columns.countries")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("settings.marketplaceAvailability.table.columns.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marketplaces.map((marketplace) => (
                    <TableRow key={marketplace.id}>
                      <TableCell className="font-medium">
                        {marketplace.name} ({marketplace.code})
                      </TableCell>
                      <TableCell>
                        {marketplace.markets && marketplace.markets.length > 0
                          ? marketplace.markets.map((m) => m.country.name).join(", ")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(marketplace)}
                        >
                          {t("common.actions.edit")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {t("settings.marketplaceAvailability.form.title")}
              </DialogTitle>
              <DialogDescription>
                {editingMarketplace?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>
                  {t("settings.marketplaceAvailability.form.fields.countries")}
                </Label>
                <div className="border rounded-md p-4 space-y-2 max-h-60 overflow-y-auto">
                  {countries.map((country) => (
                    <div key={country.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`country-${country.id}`}
                        checked={selectedCountryIds.includes(country.id)}
                        onCheckedChange={() => handleCountryToggle(country.id)}
                      />
                      <label
                        htmlFor={`country-${country.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {country.name} ({country.code})
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpenDialog(false)}
                disabled={saving}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? t("common.actions.loading") : t("common.actions.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}





