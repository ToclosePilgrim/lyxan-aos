"use client";

import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useRouter } from "next/navigation";

interface Country {
  id: string;
  name: string;
  code: string;
}

interface Marketplace {
  id: string;
  name: string;
  code: string;
  logoUrl?: string | null;
  markets?: Array<{
    country: Country;
  }>;
}

export default function SettingsMarketplacesPage() {
  const router = useRouter();
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingMarketplace, setEditingMarketplace] = useState<Marketplace | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    logoUrl: "",
  });

  useEffect(() => {
    loadMarketplaces();
  }, []);

  const loadMarketplaces = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<Marketplace[]>("/org/marketplaces");
      setMarketplaces(data || []);
    } catch (error) {
      console.error("Failed to load marketplaces:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingMarketplace(null);
    setFormData({ name: "", code: "", logoUrl: "" });
    setOpenDialog(true);
  };

  const handleOpenEdit = (marketplace: Marketplace) => {
    setEditingMarketplace(marketplace);
    setFormData({
      name: marketplace.name,
      code: marketplace.code,
      logoUrl: marketplace.logoUrl || "",
    });
    setOpenDialog(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload: any = {
        name: formData.name,
        code: formData.code,
      };
      if (formData.logoUrl) {
        payload.logoUrl = formData.logoUrl;
      }

      if (editingMarketplace) {
        await apiRequest(`/org/marketplaces/${editingMarketplace.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        alert(t("settings.marketplaces.messages.updated"));
      } else {
        await apiRequest("/org/marketplaces", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        alert(t("settings.marketplaces.messages.created"));
      }
      setOpenDialog(false);
      await loadMarketplaces();
    } catch (error: any) {
      console.error("Failed to save marketplace:", error);
      alert(error.message || t("settings.marketplaces.messages.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (marketplace: Marketplace) => {
    if (!confirm(t("settings.marketplaces.messages.deleteConfirm"))) return;

    try {
      await apiRequest(`/org/marketplaces/${marketplace.id}`, {
        method: "DELETE",
      });
      alert(t("settings.marketplaces.messages.deleted"));
      await loadMarketplaces();
    } catch (error: any) {
      console.error("Failed to delete marketplace:", error);
      alert(error.message || t("settings.marketplaces.messages.error"));
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t("settings.marketplaces.title")}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t("settings.marketplaces.subtitle")}
            </p>
          </div>
          <Button onClick={handleOpenCreate}>
            {t("settings.marketplaces.actions.add")}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.marketplaces.title")}</CardTitle>
            <CardDescription>
              {t("settings.marketplaces.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">{t("common.actions.loading")}</div>
            ) : marketplaces.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("settings.marketplaces.table.empty")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("settings.marketplaces.table.columns.name")}</TableHead>
                    <TableHead>{t("settings.marketplaces.table.columns.code")}</TableHead>
                    <TableHead>{t("settings.marketplaces.table.columns.countries")}</TableHead>
                    <TableHead className="text-right">
                      {t("settings.marketplaces.table.columns.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marketplaces.map((marketplace) => (
                    <TableRow key={marketplace.id}>
                      <TableCell className="font-medium">{marketplace.name}</TableCell>
                      <TableCell>{marketplace.code}</TableCell>
                      <TableCell>
                        {marketplace.markets && marketplace.markets.length > 0
                          ? marketplace.markets.map((m) => m.country.name).join(", ")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(marketplace)}
                          >
                            {t("settings.marketplaces.actions.edit")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/settings/marketplace-availability?marketplace=${marketplace.id}`
                              )
                            }
                          >
                            {t("settings.marketplaces.actions.manageCountries")}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(marketplace)}
                          >
                            {t("settings.marketplaces.actions.delete")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingMarketplace
                  ? t("settings.marketplaces.form.edit.title")
                  : t("settings.marketplaces.form.create.title")}
              </DialogTitle>
              <DialogDescription>
                {editingMarketplace
                  ? t("settings.marketplaces.form.edit.title")
                  : t("settings.marketplaces.form.create.title")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  {t("settings.marketplaces.form.create.fields.name")}
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">
                  {t("settings.marketplaces.form.create.fields.code")}
                </Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logoUrl">
                  {t("settings.marketplaces.form.create.fields.logoUrl")}
                </Label>
                <Input
                  id="logoUrl"
                  value={formData.logoUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, logoUrl: e.target.value })
                  }
                  placeholder="https://example.com/logo.png"
                />
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
                {saving
                  ? t("common.actions.loading")
                  : editingMarketplace
                    ? t("settings.marketplaces.form.edit.actions.save")
                    : t("settings.marketplaces.form.create.actions.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}





