"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import { t } from "@/lib/i18n";

interface Country {
  id: string;
  name: string;
  code: string;
}

interface LegalEntity {
  id: string;
  name: string;
  inn?: string;
  kpp?: string;
  ogrn?: string;
  legalAddr?: string;
  bankName?: string;
  bik?: string;
  account?: string;
  corrAccount?: string;
  director?: string;
}

interface BrandCountry {
  country: Country;
  legalEntity?: LegalEntity | null;
}

interface Brand {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  toneOfVoice?: string | null;
  countries: BrandCountry[];
}

export default function BrandEditPage() {
  const router = useRouter();
  const params = useParams();
  const brandId = params.id as string;

  const [brand, setBrand] = useState<Brand | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    toneOfVoice: "",
  });

  const [selectedCountryId, setSelectedCountryId] = useState<string>("");
  const [legalEntityDialogOpen, setLegalEntityDialogOpen] = useState(false);
  const [selectedBrandCountry, setSelectedBrandCountry] = useState<BrandCountry | null>(null);
  const [legalEntityForm, setLegalEntityForm] = useState({
    name: "",
    inn: "",
    kpp: "",
    ogrn: "",
    legalAddr: "",
    bankName: "",
    bik: "",
    account: "",
    corrAccount: "",
    director: "",
  });

  useEffect(() => {
    if (brandId) {
      loadBrand();
      loadCountries();
    }
  }, [brandId]);

  const loadBrand = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<Brand>(`/bcm/brands/${brandId}`);
      setBrand(data);
      setFormData({
        name: data.name,
        code: data.code,
        description: data.description || "",
        toneOfVoice: data.toneOfVoice || "",
      });
    } catch (error) {
      console.error("Failed to load brand:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCountries = async () => {
    try {
      const data = await apiRequest<Country[]>("/org/countries");
      setCountries(data || []);
    } catch (error) {
      console.error("Failed to load countries:", error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await apiRequest<Brand>(`/bcm/brands/${brandId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: formData.name,
          code: formData.code,
          description: formData.description || null,
          toneOfVoice: formData.toneOfVoice || null,
        }),
      });
      setBrand(updated);
      alert(t("bcm.brand.edit.messages.saved"));
    } catch (error: any) {
      console.error("Failed to save brand:", error);
      alert(error.message || t("bcm.brand.edit.messages.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleAddCountry = async () => {
    if (!selectedCountryId) return;

    try {
      await apiRequest(`/org/brands/${brandId}/countries`, {
        method: "POST",
        body: JSON.stringify({ countryId: selectedCountryId }),
      });
      await loadBrand();
      setSelectedCountryId("");
    } catch (error: any) {
      console.error("Failed to add country:", error);
      alert(error.message || t("common.messages.error"));
    }
  };

  const handleRemoveCountry = async (countryId: string) => {
    if (!confirm(t("bcm.legalEntity.removeCountry.confirm"))) return;

    try {
      await apiRequest(`/org/brands/${brandId}/countries/${countryId}`, {
        method: "DELETE",
      });
      await loadBrand();
    } catch (error: any) {
      console.error("Failed to remove country:", error);
      alert(error.message || t("common.messages.error"));
    }
  };

  const handleOpenLegalEntityDialog = (brandCountry: BrandCountry) => {
    setSelectedBrandCountry(brandCountry);
    if (brandCountry.legalEntity) {
      setLegalEntityForm({
        name: brandCountry.legalEntity.name || "",
        inn: brandCountry.legalEntity.inn || "",
        kpp: brandCountry.legalEntity.kpp || "",
        ogrn: brandCountry.legalEntity.ogrn || "",
        legalAddr: brandCountry.legalEntity.legalAddr || "",
        bankName: brandCountry.legalEntity.bankName || "",
        bik: brandCountry.legalEntity.bik || "",
        account: brandCountry.legalEntity.account || "",
        corrAccount: brandCountry.legalEntity.corrAccount || "",
        director: brandCountry.legalEntity.director || "",
      });
    } else {
      setLegalEntityForm({
        name: "",
        inn: "",
        kpp: "",
        ogrn: "",
        legalAddr: "",
        bankName: "",
        bik: "",
        account: "",
        corrAccount: "",
        director: "",
      });
    }
    setLegalEntityDialogOpen(true);
  };

  const handleSaveLegalEntity = async () => {
    if (!selectedBrandCountry) return;

    try {
      await apiRequest(
        `/org/brands/${brandId}/countries/${selectedBrandCountry.country.id}/legal-entity`,
        {
          method: "PUT",
          body: JSON.stringify(legalEntityForm),
        }
      );
      await loadBrand();
      setLegalEntityDialogOpen(false);
      setSelectedBrandCountry(null);
    } catch (error: any) {
      console.error("Failed to save legal entity:", error);
      alert(error.message || t("bcm.legalEntity.form.messages.error"));
    }
  };

  const getAvailableCountries = () => {
    if (!brand) return countries;
    const brandCountryIds = brand.countries.map((bc) => bc.country.id);
    return countries.filter((c) => !brandCountryIds.includes(c.id));
  };

  const isLegalEntityComplete = (legalEntity?: LegalEntity | null) => {
    if (!legalEntity) return false;
    return !!(
      legalEntity.name &&
      legalEntity.inn &&
      legalEntity.legalAddr &&
      legalEntity.bankName &&
      legalEntity.account
    );
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-8">{t("common.actions.loading")}</div>
      </MainLayout>
    );
  }

  if (!brand) {
    return (
      <MainLayout>
        <div className="text-center py-8 text-muted-foreground">
          {t("bcm.brand.edit.messages.notFound")}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("bcm.brand.edit.title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("bcm.brand.edit.subtitle")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("bcm.brand.edit.sections.brandInfo")}</CardTitle>
            <CardDescription>
              {t("bcm.brand.edit.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("bcm.brand.edit.fields.name")}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">{t("bcm.brand.edit.fields.code")}</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
              />
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

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? t("common.actions.loading") : t("common.actions.save")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("bcm.brand.edit.sections.presence")}</CardTitle>
            <CardDescription>
              {t("bcm.legalEntity.sectionTitle")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={selectedCountryId} onValueChange={setSelectedCountryId}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder={t("bcm.legalEntity.addCountry.placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableCountries().map((country) => (
                    <SelectItem key={country.id} value={country.id}>
                      {country.name} ({country.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAddCountry}
                disabled={!selectedCountryId || getAvailableCountries().length === 0}
              >
                {t("bcm.legalEntity.addCountry.button")}
              </Button>
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("bcm.legalEntity.table.columns.country")}</TableHead>
                    <TableHead>{t("bcm.legalEntity.table.columns.legalEntity")}</TableHead>
                    <TableHead>{t("bcm.legalEntity.table.columns.status")}</TableHead>
                    <TableHead className="text-right">{t("bcm.legalEntity.table.columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brand.countries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        {t("bcm.legalEntity.table.empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    brand.countries.map((bc) => (
                      <TableRow key={bc.country.id}>
                        <TableCell>
                          {bc.country.name} ({bc.country.code})
                        </TableCell>
                        <TableCell>
                          {bc.legalEntity?.name || (
                            <span className="text-muted-foreground">{t("bcm.legalEntity.table.status.empty")}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              isLegalEntityComplete(bc.legalEntity)
                                ? "default"
                                : "secondary"
                            }
                          >
                            {isLegalEntityComplete(bc.legalEntity)
                              ? t("bcm.legalEntity.table.status.filled")
                              : t("bcm.legalEntity.table.status.empty")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenLegalEntityDialog(bc)}
                            >
                              {bc.legalEntity ? t("bcm.legalEntity.table.actions.edit") : t("bcm.legalEntity.table.actions.add")}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveCountry(bc.country.id)}
                            >
                              {t("bcm.legalEntity.table.actions.remove")}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={legalEntityDialogOpen} onOpenChange={setLegalEntityDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedBrandCountry?.legalEntity
                  ? t("bcm.legalEntity.form.titleEdit")
                  : t("bcm.legalEntity.form.titleCreate")}
              </DialogTitle>
              <DialogDescription>
                {selectedBrandCountry?.country.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="legal-name">{t("bcm.legalEntity.form.fields.name")} *</Label>
                <Input
                  id="legal-name"
                  value={legalEntityForm.name}
                  onChange={(e) =>
                    setLegalEntityForm({ ...legalEntityForm, name: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inn">{t("bcm.legalEntity.form.fields.inn")}</Label>
                  <Input
                    id="inn"
                    value={legalEntityForm.inn}
                    onChange={(e) =>
                      setLegalEntityForm({ ...legalEntityForm, inn: e.target.value })
                    }
                    placeholder="1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kpp">{t("bcm.legalEntity.form.fields.kpp")}</Label>
                  <Input
                    id="kpp"
                    value={legalEntityForm.kpp}
                    onChange={(e) =>
                      setLegalEntityForm({ ...legalEntityForm, kpp: e.target.value })
                    }
                    placeholder="123456789"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ogrn">{t("bcm.legalEntity.form.fields.ogrn")}</Label>
                <Input
                  id="ogrn"
                  value={legalEntityForm.ogrn}
                  onChange={(e) =>
                    setLegalEntityForm({ ...legalEntityForm, ogrn: e.target.value })
                  }
                  placeholder="1234567890123"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="legalAddr">{t("bcm.legalEntity.form.fields.legalAddr")}</Label>
                <Textarea
                  id="legalAddr"
                  value={legalEntityForm.legalAddr}
                  onChange={(e) =>
                    setLegalEntityForm({
                      ...legalEntityForm,
                      legalAddr: e.target.value,
                    })
                  }
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankName">{t("bcm.legalEntity.form.fields.bankName")}</Label>
                <Input
                  id="bankName"
                  value={legalEntityForm.bankName}
                  onChange={(e) =>
                    setLegalEntityForm({ ...legalEntityForm, bankName: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bik">{t("bcm.legalEntity.form.fields.bik")}</Label>
                  <Input
                    id="bik"
                    value={legalEntityForm.bik}
                    onChange={(e) =>
                      setLegalEntityForm({ ...legalEntityForm, bik: e.target.value })
                    }
                    placeholder="044525225"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account">{t("bcm.legalEntity.form.fields.account")}</Label>
                  <Input
                    id="account"
                    value={legalEntityForm.account}
                    onChange={(e) =>
                      setLegalEntityForm({ ...legalEntityForm, account: e.target.value })
                    }
                    placeholder="40702810..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="corrAccount">{t("bcm.legalEntity.form.fields.corrAccount")}</Label>
                <Input
                  id="corrAccount"
                  value={legalEntityForm.corrAccount}
                  onChange={(e) =>
                    setLegalEntityForm({
                      ...legalEntityForm,
                      corrAccount: e.target.value,
                    })
                  }
                  placeholder="30101810..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="director">{t("bcm.legalEntity.form.fields.director")}</Label>
                <Input
                  id="director"
                  value={legalEntityForm.director}
                  onChange={(e) =>
                    setLegalEntityForm({ ...legalEntityForm, director: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setLegalEntityDialogOpen(false)}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button onClick={handleSaveLegalEntity}>{t("common.actions.save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
