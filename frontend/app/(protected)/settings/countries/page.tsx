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

interface Country {
  id: string;
  name: string;
  code: string;
}

export default function SettingsCountriesPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
  });

  useEffect(() => {
    loadCountries();
  }, []);

  const loadCountries = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<Country[]>("/org/countries");
      setCountries(data || []);
    } catch (error) {
      console.error("Failed to load countries:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingCountry(null);
    setFormData({ name: "", code: "" });
    setOpenDialog(true);
  };

  const handleOpenEdit = (country: Country) => {
    setEditingCountry(country);
    setFormData({ name: country.name, code: country.code });
    setOpenDialog(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (editingCountry) {
        await apiRequest(`/org/countries/${editingCountry.id}`, {
          method: "PATCH",
          body: JSON.stringify(formData),
        });
        alert(t("settings.countries.messages.updated"));
      } else {
        await apiRequest("/org/countries", {
          method: "POST",
          body: JSON.stringify(formData),
        });
        alert(t("settings.countries.messages.created"));
      }
      setOpenDialog(false);
      await loadCountries();
    } catch (error: any) {
      console.error("Failed to save country:", error);
      alert(error.message || t("settings.countries.messages.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (country: Country) => {
    if (!confirm(t("settings.countries.messages.deleteConfirm"))) return;

    try {
      await apiRequest(`/org/countries/${country.id}`, {
        method: "DELETE",
      });
      alert(t("settings.countries.messages.deleted"));
      await loadCountries();
    } catch (error: any) {
      console.error("Failed to delete country:", error);
      alert(error.message || t("settings.countries.messages.error"));
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t("settings.countries.title")}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t("settings.countries.subtitle")}
            </p>
          </div>
          <Button onClick={handleOpenCreate}>
            {t("settings.countries.actions.add")}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.countries.title")}</CardTitle>
            <CardDescription>
              {t("settings.countries.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">{t("common.actions.loading")}</div>
            ) : countries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("settings.countries.table.empty")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("settings.countries.table.columns.name")}</TableHead>
                    <TableHead>{t("settings.countries.table.columns.code")}</TableHead>
                    <TableHead className="text-right">
                      {t("settings.countries.table.columns.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {countries.map((country) => (
                    <TableRow key={country.id}>
                      <TableCell className="font-medium">{country.name}</TableCell>
                      <TableCell>{country.code}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(country)}
                          >
                            {t("settings.countries.actions.edit")}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(country)}
                          >
                            {t("settings.countries.actions.delete")}
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
                {editingCountry
                  ? t("settings.countries.form.edit.title")
                  : t("settings.countries.form.create.title")}
              </DialogTitle>
              <DialogDescription>
                {editingCountry
                  ? t("settings.countries.form.edit.title")
                  : t("settings.countries.form.create.title")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  {t("settings.countries.form.create.fields.name")}
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
                  {t("settings.countries.form.create.fields.code")}
                </Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
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
                  : editingCountry
                    ? t("settings.countries.form.edit.actions.save")
                    : t("settings.countries.form.create.actions.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}





