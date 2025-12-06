"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/api";
import { t } from "@/lib/i18n";

interface Country {
  id: string;
  name: string;
  code: string;
}

export default function CreateBrandPage() {
  const router = useRouter();
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    countryIds: [] as string[],
    description: "",
    toneOfVoice: "",
  });

  useEffect(() => {
    loadCountries();
  }, []);

  const loadCountries = async () => {
    try {
      const data = await apiRequest<Country[]>("/org/countries");
      setCountries(data || []);
    } catch (error) {
      console.error("Failed to load countries:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCountryToggle = (countryId: string) => {
    setFormData((prev) => ({
      ...prev,
      countryIds: prev.countryIds.includes(countryId)
        ? prev.countryIds.filter((id) => id !== countryId)
        : [...prev.countryIds, countryId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await apiRequest("/bcm/brands", {
        method: "POST",
        body: JSON.stringify({
          name: formData.name,
          code: formData.code,
          countryIds: formData.countryIds,
          description: formData.description || undefined,
          toneOfVoice: formData.toneOfVoice || undefined,
        }),
      });
      router.push("/bcm/brands");
    } catch (error: any) {
      console.error("Failed to create brand:", error);
      alert(error.message || t("bcm.brand.create.messages.error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-8">{t("common.actions.loading")}</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("bcm.brand.create.title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("bcm.brand.create.subtitle")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("bcm.brand.edit.sections.brandInfo")}</CardTitle>
            <CardDescription>
              {t("bcm.brand.create.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("bcm.brand.create.fields.name")} *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">{t("bcm.brand.create.fields.code")} *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>{t("bcm.brand.create.fields.countries")} *</Label>
                <div className="border rounded-md p-4 space-y-2 max-h-60 overflow-y-auto">
                  {countries.map((country) => (
                    <div key={country.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`country-${country.id}`}
                        checked={formData.countryIds.includes(country.id)}
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
                {formData.countryIds.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t("bcm.brand.create.fields.countries")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Brand description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describe the brand, its positioning, audience, value proposition..."
                  rows={4}
                />
                <p className="text-sm text-muted-foreground">
                  This text will be used by AI agents to understand the brand.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="toneOfVoice">Tone of voice</Label>
                <Textarea
                  id="toneOfVoice"
                  value={formData.toneOfVoice}
                  onChange={(e) =>
                    setFormData({ ...formData, toneOfVoice: e.target.value })
                  }
                  placeholder="For example: Friendly, expert, a bit playful. Avoid jargon..."
                  rows={4}
                />
                <p className="text-sm text-muted-foreground">
                  Describe how the brand talks to customers. AI agents will follow this style.
                </p>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  {t("common.actions.cancel")}
                </Button>
                <Button type="submit" disabled={saving || formData.countryIds.length === 0}>
                  {saving ? t("common.actions.loading") : t("bcm.brand.create.actions.create")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

