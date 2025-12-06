"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface Brand {
  id: string;
  name: string;
  code: string;
}

export default function CreateScmProductPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    internalName: "",
    sku: "",
    brandId: undefined as string | undefined,
    baseDescription: "",
    composition: "",
  });

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<Brand[]>("/bcm/brands");
      setBrands(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load brands:", error);
      toast.error("Failed to load brands");
      setBrands([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.internalName.trim()) {
      toast.error("Internal name is required");
      return;
    }

    try {
      setSaving(true);
      const payload: {
        internalName: string;
        sku?: string;
        brandId?: string;
        baseDescription?: string;
        composition?: string;
      } = {
        internalName: formData.internalName,
      };

      if (formData.sku) payload.sku = formData.sku;
      if (formData.brandId) payload.brandId = formData.brandId;
      if (formData.baseDescription) payload.baseDescription = formData.baseDescription;
      if (formData.composition) payload.composition = formData.composition;

      const newProduct = await apiRequest<{ id: string }>("/scm/products", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("SCM product created successfully");
      router.push(`/scm/products/${newProduct.id}`);
    } catch (error: any) {
      console.error("Failed to create SCM product:", error);
      toast.error("Failed to create SCM product", {
        description: error.message || "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create SCM Product</h1>
            <p className="text-muted-foreground mt-2">
              Create a new internal product for supply chain management
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>SCM Product Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="internalName" className="text-right">
                  Internal Name *
                </Label>
                <Input
                  id="internalName"
                  value={formData.internalName}
                  onChange={(e) =>
                    setFormData({ ...formData, internalName: e.target.value })
                  }
                  className="col-span-3"
                  required
                  disabled={saving}
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="sku" className="text-right">
                  SKU
                </Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="col-span-3"
                  disabled={saving}
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="brand" className="text-right">
                  Brand
                </Label>
                <Select
                  value={formData.brandId}
                  onValueChange={(value) => setFormData({ ...formData, brandId: value })}
                  disabled={saving || loading}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a brand (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {(brands || []).map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="baseDescription" className="text-right pt-2">
                  Base Description
                </Label>
                <Textarea
                  id="baseDescription"
                  value={formData.baseDescription}
                  onChange={(e) =>
                    setFormData({ ...formData, baseDescription: e.target.value })
                  }
                  className="col-span-3"
                  rows={4}
                  disabled={saving}
                />
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="composition" className="text-right pt-2">
                  Composition
                </Label>
                <Textarea
                  id="composition"
                  value={formData.composition}
                  onChange={(e) =>
                    setFormData({ ...formData, composition: e.target.value })
                  }
                  className="col-span-3"
                  rows={3}
                  disabled={saving}
                />
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/scm/products")}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

