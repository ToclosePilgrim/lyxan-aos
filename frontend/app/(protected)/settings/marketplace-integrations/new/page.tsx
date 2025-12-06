"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/api";
import { t } from "@/lib/i18n";

interface Marketplace {
  id: string;
  name: string;
  code: string;
}

interface Brand {
  id: string;
  name: string;
  code: string;
}

interface Country {
  id: string;
  name: string;
  code: string;
}

export default function NewMarketplaceIntegrationPage() {
  const router = useRouter();
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    marketplaceId: "",
    brandId: "",
    countryId: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [marketplacesData, brandsData, countriesData] = await Promise.all([
        apiRequest<Marketplace[]>("/org/marketplaces"),
        apiRequest<Brand[]>("/bcm/brands"),
        apiRequest<Country[]>("/org/countries"),
      ]);
      setMarketplaces(marketplacesData || []);
      setBrands(brandsData || []);
      setCountries(countriesData || []);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.marketplaceId || !formData.brandId) {
      alert("Please select marketplace and brand");
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        marketplaceId: formData.marketplaceId,
        brandId: formData.brandId,
      };
      if (formData.countryId) {
        payload.countryId = formData.countryId;
      }

      const integration = await apiRequest<{ id: string }>(
        "/settings/marketplace-integrations",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      alert(t("settings.marketplaceIntegrations.messages.created"));
      router.push(`/settings/marketplace-integrations/${integration.id}`);
    } catch (error: any) {
      console.error("Failed to create integration:", error);
      alert(error.message || t("settings.marketplaceIntegrations.messages.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("settings.marketplaceIntegrations.form.create.title")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t("settings.marketplaceIntegrations.subtitle")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.marketplaceIntegrations.form.create.title")}</CardTitle>
            <CardDescription>
              {t("settings.marketplaceIntegrations.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">{t("common.actions.loading")}</div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="marketplace">
                    {t("settings.marketplaceIntegrations.form.create.fields.marketplace")} *
                  </Label>
                  <Select
                    value={formData.marketplaceId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, marketplaceId: value })
                    }
                  >
                    <SelectTrigger id="marketplace">
                      <SelectValue placeholder="Select marketplace" />
                    </SelectTrigger>
                    <SelectContent>
                      {marketplaces.map((marketplace) => (
                        <SelectItem key={marketplace.id} value={marketplace.id}>
                          {marketplace.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brand">
                    {t("settings.marketplaceIntegrations.form.create.fields.brand")} *
                  </Label>
                  <Select
                    value={formData.brandId}
                    onValueChange={(value) => setFormData({ ...formData, brandId: value })}
                  >
                    <SelectTrigger id="brand">
                      <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">
                    {t("settings.marketplaceIntegrations.form.create.fields.country")}
                  </Label>
                  <Select
                    value={formData.countryId}
                    onValueChange={(value) => setFormData({ ...formData, countryId: value })}
                  >
                    <SelectTrigger id="country">
                      <SelectValue placeholder="Select country (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country.id} value={country.id}>
                          {country.name} ({country.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    If not selected, country will be taken from brand
                  </p>
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={saving}>
                    {saving
                      ? t("common.actions.loading")
                      : t("settings.marketplaceIntegrations.form.create.actions.create")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={saving}
                  >
                    {t("settings.marketplaceIntegrations.form.create.actions.cancel")}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}





