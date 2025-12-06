"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";

interface ScmProduct {
  id: string;
  internalName: string;
  sku: string | null;
}

interface Country {
  id: string;
  name: string;
  code: string;
}

interface Supplier {
  id: string;
  name: string;
  code: string;
  country: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export default function NewProductionOrderPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ScmProduct[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [manufacturers, setManufacturers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    productId: "",
    quantityPlanned: "",
    unit: "pcs",
    code: "",
    name: "",
    plannedStartAt: "",
    plannedEndAt: "",
    productionSite: "",
    notes: "",
    productionCountryId: "",
    manufacturerId: "",
  });

  useEffect(() => {
    Promise.all([loadProducts(), loadCountries(), loadManufacturers()]);
  }, []);

  useEffect(() => {
    // Filter manufacturers by selected country if country is selected
    if (formData.productionCountryId) {
      loadManufacturers(formData.productionCountryId);
    } else {
      loadManufacturers();
    }
  }, [formData.productionCountryId]);

  const loadProducts = async () => {
    try {
      const data = await apiRequest<ScmProduct[]>("/scm/products");
      setProducts(Array.isArray(data) ? data.filter(p => p?.id) : []);
    } catch (error) {
      console.error("Failed to load products:", error);
      toast.error("Failed to load products");
      setProducts([]);
    }
  };

  const loadCountries = async () => {
    try {
      const data = await apiRequest<Country[]>("/org/countries?limit=100");
      setCountries(Array.isArray(data) ? data.filter(c => c?.id) : []);
    } catch (error) {
      console.error("Failed to load countries:", error);
      toast.error("Failed to load countries");
      setCountries([]);
    }
  };

  const loadManufacturers = async (countryId?: string) => {
    try {
      const params = new URLSearchParams();
      params.append("types", "MANUFACTURER");
      params.append("limit", "100");
      if (countryId) {
        params.append("countryId", countryId);
      }
      const query = params.toString();
      const data = await apiRequest<Supplier[]>(`/scm/suppliers?${query}`);
      setManufacturers(Array.isArray(data) ? data.filter(s => s?.id) : []);
    } catch (error) {
      console.error("Failed to load manufacturers:", error);
      // Don't show error toast for manufacturers, just log it
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.productId || !formData.quantityPlanned) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        productId: formData.productId,
        quantityPlanned: parseFloat(formData.quantityPlanned),
        unit: formData.unit,
      };

      if (formData.code) payload.code = formData.code;
      // Only send name if user explicitly provided it (not auto-generated)
      // If empty, backend will auto-generate it
      if (formData.name && formData.name.trim()) {
        payload.name = formData.name.trim();
      }
      if (formData.plannedStartAt) payload.plannedStartAt = formData.plannedStartAt;
      if (formData.plannedEndAt) payload.plannedEndAt = formData.plannedEndAt;
      if (formData.productionSite) payload.productionSite = formData.productionSite;
      if (formData.notes) payload.notes = formData.notes;
      if (formData.productionCountryId) payload.productionCountryId = formData.productionCountryId;
      if (formData.manufacturerId) payload.manufacturerId = formData.manufacturerId;

      const result = await apiRequest<{ order: { id: string } }>(
        "/scm/production-orders",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      toast.success("Production order created successfully");
      // Handle both formats: { order: { id } } and { id }
      const orderId = result?.order?.id || (result as any)?.id;
      if (orderId) {
        router.push(`/scm/production-orders/${orderId}`);
      } else {
        router.push("/scm/production-orders");
      }
    } catch (error: any) {
      console.error("Failed to create production order:", error);
      toast.error("Failed to create production order", {
        description: error.message || "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  // Auto-generate name when product and quantity are selected (only if name is empty)
  useEffect(() => {
    if (formData.productId && formData.quantityPlanned && !formData.name.trim()) {
      const product = products.find((p) => p.id === formData.productId);
      if (product) {
        const generatedName = `${product.internalName} — batch ${formData.quantityPlanned} ${formData.unit}`;
        setFormData((prev) => ({
          ...prev,
          name: generatedName,
        }));
      }
    }
  }, [formData.productId, formData.quantityPlanned, formData.unit, products]);

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-8">Loading...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="outline" asChild>
              <Link href="/scm/production-orders">← Back to list</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Production Order</CardTitle>
            <CardDescription>
              Create a new production order. Components will be automatically added from BOM if available.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="productId">Product *</Label>
              <Select
                value={formData.productId ?? ""}
                onValueChange={(value) =>
                  setFormData({ ...formData, productId: value })
                }
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.filter(p => p?.id).map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.internalName} {product.sku && `[${product.sku}]`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quantityPlanned">Quantity *</Label>
                <Input
                  id="quantityPlanned"
                  type="number"
                  step="0.01"
                  value={formData.quantityPlanned}
                  onChange={(e) =>
                    setFormData({ ...formData, quantityPlanned: e.target.value })
                  }
                  placeholder="5000"
                  disabled={saving}
                />
              </div>
              <div>
                <Label htmlFor="unit">Unit *</Label>
                <Input
                  id="unit"
                  value={formData.unit}
                  onChange={(e) =>
                    setFormData({ ...formData, unit: e.target.value })
                  }
                  placeholder="pcs"
                  disabled={saving}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="code">Code (auto-generated if empty)</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                placeholder="PR-2025-0001"
                disabled={saving}
              />
            </div>

            <div>
              <Label htmlFor="name">Custom name (optional)</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Leave empty to auto-generate"
                disabled={saving}
              />
              <p className="text-sm text-muted-foreground mt-1">
                If empty, the name will be generated automatically from product and quantity (e.g. "Vimty Serum — batch 5000 pcs").
              </p>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4">Production Details</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="productionCountryId">Production Country</Label>
                  <Select
                    value={formData.productionCountryId ?? ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, productionCountryId: value, manufacturerId: "" })
                    }
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {countries.filter(c => c?.id).map((country) => (
                        <SelectItem key={country.id} value={String(country.id)}>
                          {country.name} ({country.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="manufacturerId">Manufacturer</Label>
                  <Select
                    value={formData.manufacturerId ?? ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, manufacturerId: value })
                    }
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select manufacturer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {manufacturers.filter(m => m?.id).map((manufacturer) => (
                        <SelectItem key={manufacturer.id} value={String(manufacturer.id)}>
                          {manufacturer.name}
                          {manufacturer.country && ` — ${manufacturer.country.name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plannedStartAt">Planned Start Date</Label>
                <Input
                  id="plannedStartAt"
                  type="datetime-local"
                  value={formData.plannedStartAt}
                  onChange={(e) =>
                    setFormData({ ...formData, plannedStartAt: e.target.value })
                  }
                  disabled={saving}
                />
              </div>
              <div>
                <Label htmlFor="plannedEndAt">Planned End Date</Label>
                <Input
                  id="plannedEndAt"
                  type="datetime-local"
                  value={formData.plannedEndAt}
                  onChange={(e) =>
                    setFormData({ ...formData, plannedEndAt: e.target.value })
                  }
                  disabled={saving}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="productionSite">Production Site</Label>
              <Input
                id="productionSite"
                value={formData.productionSite}
                onChange={(e) =>
                  setFormData({ ...formData, productionSite: e.target.value })
                }
                placeholder="Завод X, Россия"
                disabled={saving}
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Additional notes about this production order"
                rows={3}
                disabled={saving}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/scm/production-orders">Cancel</Link>
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Creating..." : "Create Order"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

